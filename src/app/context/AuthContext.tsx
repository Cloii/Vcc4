import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getMyRole } from "../lib/api";

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

  const fetchRole = async () => {
    try {
      const { role: r, profile } = await getMyRole();
      setRole(r);
      if (profile) {
        setUser(prev => prev ? { ...prev, name: profile.name } : prev);
      }
    } catch {
      setRole("student");
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email!, name: session.user.user_metadata?.name });
        fetchRole().finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email!, name: session.user.user_metadata?.name });
        fetchRole();
      } else {
        setUser(null);
        setRole("public");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
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
