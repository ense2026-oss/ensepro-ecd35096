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

interface CurrentUser {
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
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  role: AppRole;
  session: Session | null;
  loading: boolean;
  profileReady: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  signup: (email: string, password: string, fullName: string, role?: AppRole) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isManager: boolean;
  isHR: boolean;
  isEmployee: boolean;
  isAccountant: boolean;
  hasAdminAccess: boolean;
  currentUser: CurrentUser | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole>("employee");
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profileReady, setProfileReady] = useState(false);

  const fetchProfileAndRole = useCallback(async (userId: string) => {
    try {
      const [profileRes, roleRes, empRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
        supabase.from("employees").select("id, photo_url, dept, position, first_name, last_name, avatar, avatar_color, avatar_text_color").eq("user_id", userId).maybeSingle(),
      ]);

      if (profileRes.data) setProfile(profileRes.data as Profile);
      if (roleRes.data) setRole(roleRes.data.role as AppRole);
      setEmployeeId(empRes.data?.id ?? null);
      setEmployeeData(empRes.data ?? null);
    } catch (err) {
      console.error("Error fetching profile/role:", err);
    } finally {
      setProfileReady(true);
    }
  }, []);

  const initialized = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!initialized.current) return;

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Don't reset profileReady here — let fetch complete
          await fetchProfileAndRole(newSession.user.id);
        } else {
          setProfile(null);
          setRole("employee");
          setEmployeeId(null);
          setEmployeeData(null);
          setProfileReady(false);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        await fetchProfileAndRole(initialSession.user.id);
      } else {
        setProfileReady(true);
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
      options: { data: { full_name: fullName, role: signupRole } },
    });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole("employee");
    setEmployeeId(null);
    setEmployeeData(null);
    setProfileReady(false);
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

  // Build currentUser: available as soon as user exists (with fallback if profile not loaded yet)
  let currentUser: CurrentUser | null = null;
  if (user) {
    const empFirstName = employeeData?.first_name || "";
    const empLastName = employeeData?.last_name || "";
    const nameParts = (profile?.full_name || user.user_metadata?.full_name || user.email || "").split(" ");
    const firstName = empFirstName || nameParts[0] || "";
    const lastName = empLastName || nameParts.slice(1).join(" ") || "";
    currentUser = {
      id: user.id,
      firstName,
      lastName,
      role: role === "hr" ? "HR" : role.charAt(0).toUpperCase() + role.slice(1),
      avatar: employeeData?.avatar || firstName.charAt(0) || "U",
      avatarColor: employeeData?.avatar_color || "hsl(30 70% 90%)",
      avatarTextColor: employeeData?.avatar_text_color || "hsl(30 70% 35%)",
      photoUrl: employeeData?.photo_url || profile?.avatar_url || undefined,
      username: profile?.username || user.email || "",
      email: user.email || "",
      dept: employeeData?.dept || "",
      position: employeeData?.position || "",
      employeeId,
    };
  }

  return (
    <AuthContext.Provider
      value={{
        user, profile, role, session, loading, profileReady,
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
