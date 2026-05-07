import React, { createContext, useContext, useEffect, useState } from "react";
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

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState("public");
  const [loading, setLoading] = useState(true);

  const fetchRole = async (uid?: string) => {
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
  };

  // On mount: restore Supabase session
  useEffect(() => {
    let unsub: any;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const sUser = data.session?.user;
      if (sUser) {
        setUser({ id: sUser.id, email: sUser.email || "", name: (sUser.user_metadata as any)?.name });
        await fetchRole(sUser.id);
      } else {
        setUser(null);
        setRole("public");
      }
      setLoading(false);
      unsub = supabase.auth.onAuthStateChange(async (_evt, session) => {
        const u = session?.user;
        if (!u) {
          setUser(null);
          setRole("public");
          return;
        }
        setUser({ id: u.id, email: u.email || "", name: (u.user_metadata as any)?.name });
        await fetchRole(u.id);
      }).data.subscription;
    })();
    return () => unsub?.unsubscribe?.();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const u = data.user;
    if (u) {
      setUser({ id: u.id, email: u.email || "", name: (u.user_metadata as any)?.name });
      await fetchRole(u.id);
    }
  };

  const signOut = async () => {
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
