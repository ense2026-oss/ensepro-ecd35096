import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "admin" | "hr" | "manager" | "employee" | "accountant" | "executive";

interface Profile {
  id: string;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  role: AppRole;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  signup: (email: string, password: string, fullName: string, role?: AppRole) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isManager: boolean;
  isHR: boolean;
  isEmployee: boolean;
  isAccountant: boolean;
  hasAdminAccess: boolean;
  // Legacy compat: currentUser maps to a minimal Employee-like shape
  currentUser: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    avatar: string;
    avatarColor: string;
    avatarTextColor: string;
    photoUrl?: string;
    username: string;
    email: string;
    dept: string;
    position: string;
    employeeId: string | null;
  } | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole>("employee");
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfileAndRole = useCallback(async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileData) {
        setProfile(profileData as Profile);
      }

      // Fetch role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (roleData) {
        setRole(roleData.role as AppRole);
      }

      // Fetch linked employee ID
      const { data: empData } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      setEmployeeId(empData?.id ?? null);
    } catch (err) {
      console.error("Error fetching profile/role:", err);
    }
  }, []);

  const initialized = useRef(false);

  useEffect(() => {
    // Listen for auth state changes FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        // Skip if this is the initial event — getSession handles it
        if (!initialized.current) return;

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          await fetchProfileAndRole(newSession.user.id);
        } else {
          setProfile(null);
          setRole("employee");
        }
        setLoading(false);
      }
    );

    // THEN get initial session
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        await fetchProfileAndRole(initialSession.user.id);
      }
      setLoading(false);
      initialized.current = true;
    });

    return () => subscription.unsubscribe();
  }, [fetchProfileAndRole]);

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signup = useCallback(async (email: string, password: string, fullName: string, signupRole: AppRole = "employee") => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: signupRole,
        },
      },
    });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const logout = useCallback(async () => {
    // Clear state FIRST to ensure UI reacts immediately
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole("employee");
    setEmployeeId(null);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("signOut error (state already cleared):", err);
    }
  }, []);

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isHR = role === "hr";
  const isEmployee = role === "employee";
  const isAccountant = role === "accountant";
  const hasAdminAccess = isAdmin || isManager || isHR || isAccountant;

  // Legacy compat currentUser
  const nameParts = (profile?.full_name || "").split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  const currentUser = user && profile ? {
    id: user.id,
    firstName,
    lastName,
    role: role === "hr" ? "HR" : role.charAt(0).toUpperCase() + role.slice(1), // "Admin", "HR", "Manager", etc.
    avatar: firstName.charAt(0) || "U",
    avatarColor: "hsl(30 70% 90%)",
    avatarTextColor: "hsl(30 70% 35%)",
    photoUrl: profile.avatar_url || undefined,
    username: profile.username || user.email || "",
    email: user.email || "",
    dept: "",
    position: "",
    employeeId,
  } : null;

  return (
    <AuthContext.Provider
      value={{
        user, profile, role, session, loading,
        login, signup, logout,
        isAdmin, isManager, isHR, isEmployee, isAccountant, hasAdminAccess,
        currentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
