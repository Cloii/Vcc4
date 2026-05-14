import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  role: string;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, role: "public", loading: true,
  signIn: async () => {}, signOut: async () => {}, refreshRole: async () => {},
});

// ✅ Module-level flag: set to true to pause the auth listener during admin user creation.
// This prevents onAuthStateChange from reacting to the temporary signUp session change
// and redirecting the admin away from the dashboard.
export const authListenerPaused = { current: false };

export const useAuth = () => useContext(AuthContext);

/** Supabase can emit `session: null` briefly during token refresh — don't wipe auth until we confirm */
const NULL_SESSION_DEBOUNCE_MS = 220;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState("public");
  const [loading, setLoading] = useState(true);
  const nullSessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearNullSessionTimer = () => {
    if (nullSessionTimerRef.current) {
      clearTimeout(nullSessionTimerRef.current);
      nullSessionTimerRef.current = null;
    }
  };

  const fetchRole = useCallback(async (uid?: string) => {
    try {
      const id = uid || (await supabase.auth.getUser()).data.user?.id;
      if (!id) {
        setRole("public");
        return;
      }
      const { data, error } = await supabase.from("profiles").select("name, role, email, id").eq("id", id).single();
      if (error) throw error;
      setRole(data?.role || "student");
      setUser(prev =>
        prev
          ? { ...prev, name: data?.name || prev.name }
          : data
            ? { id: data.id, email: data.email || "", name: data.name || undefined }
            : prev
      );
    } catch {
      setRole("student");
    }
  }, []);

  // On mount: restore Supabase session + keep session aligned when the tab wakes from sleep / refresh
  useEffect(() => {
    let unsub: { unsubscribe: () => void } | undefined;

    const mapSessionUser = (
      sUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null,
    ): AuthUser | null =>
      sUser
        ? {
            id: sUser.id,
            email: sUser.email || "",
            name: (sUser.user_metadata as { name?: string } | undefined)?.name,
          }
        : null;

    const applySessionUser = async (sUser: AuthUser) => {
      setUser(sUser);
      await fetchRole(sUser.id);
    };

    const scheduleNullSessionCheck = () => {
      clearNullSessionTimer();
      nullSessionTimerRef.current = setTimeout(async () => {
        nullSessionTimerRef.current = null;
        if (authListenerPaused.current) return;
        const { data } = await supabase.auth.getSession();
        const sUser = mapSessionUser(data.session?.user ?? null);
        if (!sUser) {
          setUser(null);
          setRole("public");
        } else {
          await applySessionUser(sUser);
        }
      }, NULL_SESSION_DEBOUNCE_MS);
    };

    const syncFromStoredSession = async () => {
      if (authListenerPaused.current) return;
      const { data } = await supabase.auth.getSession();
      const sUser = mapSessionUser(data.session?.user ?? null);
      if (!sUser) return;
      setUser(prev => (prev?.id === sUser.id ? prev : sUser));
      await fetchRole(sUser.id);
    };

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      void syncFromStoredSession();
    };

    const onResume = () => {
      void syncFromStoredSession();
    };

    (async () => {
      const { data } = await supabase.auth.getSession();
      const sUser = mapSessionUser(data.session?.user ?? null);
      if (sUser) {
        setUser(sUser);
        await fetchRole(sUser.id);
      } else {
        setUser(null);
        setRole("public");
      }
      setLoading(false);

      unsub = supabase.auth.onAuthStateChange(async (_evt, session) => {
        if (authListenerPaused.current) return;
        const u = session?.user;
        if (!u) {
          scheduleNullSessionCheck();
          return;
        }
        clearNullSessionTimer();
        const mapped = mapSessionUser(u);
        if (mapped) await applySessionUser(mapped);
      }).data.subscription;

      document.addEventListener("visibilitychange", onVisibility);
      document.addEventListener("resume", onResume);
    })();

    return () => {
      clearNullSessionTimer();
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("resume", onResume);
      unsub?.unsubscribe();
    };
  }, [fetchRole]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const u = data.user;
    if (u) {
      setUser({ id: u.id, email: u.email || "", name: (u.user_metadata as { name?: string } | undefined)?.name });
      await fetchRole(u.id);
    }
  };

  const signOut = async () => {
    clearNullSessionTimer();
    await supabase.auth.signOut();
    setUser(null);
    setRole("public");
  };

  const refreshRole = fetchRole;

  return (
    <AuthContext.Provider value={{ user, role, loading, signIn, signOut, refreshRole }}>
      {children}
    </AuthContext.Provider>
  );
};
