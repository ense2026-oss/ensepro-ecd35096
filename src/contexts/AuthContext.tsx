import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { clearPersistedQueryCache } from "@/lib/queryPersist";
import { withRetry } from "@/lib/retry";
import { logInfo, logAction, logEventSync } from "@/lib/systemLog";

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
  currentUser: CurrentUser | null;
}

const AUTH_CACHE_KEY = "auth_profile_cache";

interface AuthCache {
  userId: string;
  profile: Profile | null;
  role: AppRole;
  employeeId: string | null;
  employeeData: any;
  timestamp: number;
}

function loadAuthCache(userId: string): AuthCache | null {
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    const cache: AuthCache = JSON.parse(raw);
    // ใช้ cache เฉพาะเมื่อเป็น user เดียวกัน และไม่เกิน 1 ชั่วโมง
    if (cache.userId === userId && Date.now() - cache.timestamp < 3600000) {
      return cache;
    }
  } catch {}
  return null;
}

function saveAuthCache(data: Omit<AuthCache, "timestamp">) {
  try {
    // Don't cache large photo_url (base64) data to keep localStorage small
    const safeData = { ...data };
    if (safeData.employeeData?.photo_url && safeData.employeeData.photo_url.length > 500) {
      safeData.employeeData = { ...safeData.employeeData, photo_url: null };
    }
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ ...safeData, timestamp: Date.now() }));
  } catch {}
}

function clearAuthCache() {
  try { localStorage.removeItem(AUTH_CACHE_KEY); } catch {}
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
  const queryClient = useQueryClient();

  const fetchProfileAndRole = useCallback(async (userId: string) => {
    try {
      // withRetry: Supabase intermittently answers 504. Without it a failed
      // lookup here was treated as "no employee row / role employee" AND cached
      // for an hour, which sent self-only staff to /employees/<auth id> and a
      // "ไม่พบข้อมูลพนักงาน" page until the cache expired.
      const [profileRes, roleRes, empRes] = await Promise.all([
        withRetry(() => supabase.from("profiles").select("*").eq("id", userId).maybeSingle()),
        withRetry(() => supabase.from("user_roles").select("role, role_name").eq("user_id", userId).maybeSingle()),
        // limit(1) rather than maybeSingle(): a duplicated user_id link would make
        // maybeSingle() error out and drop the employee entirely.
        withRetry(() =>
          supabase
            .from("employees")
            .select("id, photo_url, dept, position, first_name, last_name, avatar, avatar_color, avatar_text_color")
            .eq("user_id", userId)
            .order("created_at")
            .limit(1),
        ),
      ]);

      const newProfile = profileRes.data as Profile | null;
      if (newProfile) setProfile(newProfile);

      const roleOk = !roleRes.error;
      const empOk = !empRes.error;
      // role_name is the source of truth (supports custom roles); fall back to enum role
      const newRole = roleOk
        ? (((roleRes.data as any)?.role_name || (roleRes.data as any)?.role || "employee") as AppRole)
        : null;
      // undefined = lookup failed (keep whatever we had), null = genuinely no row
      const empRow: any | null | undefined = empOk ? ((empRes.data as any[] | null)?.[0] ?? null) : undefined;

      if (newRole) setRole(newRole);
      if (empRow !== undefined) {
        setEmployeeId(empRow?.id ?? null);
        setEmployeeData(empRow);
      }

      // Only cache a fully successful lookup; never persist a transient failure.
      if (roleOk && empOk && newRole) {
        saveAuthCache({ userId, profile: newProfile, role: newRole, employeeId: empRow?.id ?? null, employeeData: empRow });
      } else {
        console.warn("profile/role lookup incomplete; keeping previous values", {
          role: roleRes.error?.message,
          employee: empRes.error?.message,
        });
      }
    } catch (err) {
      console.error("Error fetching profile/role:", err);
    } finally {
      setProfileReady(true);
    }
  }, []);

  const initialized = useRef(false);
  const lastFetchedUserId = useRef<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!initialized.current) return;

        // จัดการ token หมดอายุ — ล้าง session แล้วกลับหน้า login
        if (event === "TOKEN_REFRESHED" && !newSession) {
          setUser(null);
          setSession(null);
          setProfile(null);
          setRole("employee");
          setEmployeeId(null);
          setEmployeeData(null);
          setProfileReady(true);
          setLoading(false);
          clearAuthCache();
          return;
        }

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          if (lastFetchedUserId.current === newSession.user.id) {
            setLoading(false);
            return;
          }
          lastFetchedUserId.current = newSession.user.id;
          await fetchProfileAndRole(newSession.user.id);
        } else {
          lastFetchedUserId.current = null;
          setProfile(null);
          setRole("employee");
          setEmployeeId(null);
          setEmployeeData(null);
          setProfileReady(false);
          clearAuthCache();
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        const uid = initialSession.user.id;
        lastFetchedUserId.current = uid;

        // โหลด cache ก่อน → แสดง UI ทันที → แล้วค่อย refresh จาก DB
        const cached = loadAuthCache(uid);
        if (cached) {
          if (cached.profile) setProfile(cached.profile);
          setRole(cached.role);
          setEmployeeId(cached.employeeId);
          setEmployeeData(cached.employeeData);
          setProfileReady(true);
          setLoading(false);
          initialized.current = true;
          // refresh ข้อมูลจาก DB เบื้องหลัง
          fetchProfileAndRole(uid);
        } else {
          await fetchProfileAndRole(uid);
          setLoading(false);
          initialized.current = true;
        }
      } else {
        setProfileReady(true);
        setLoading(false);
        initialized.current = true;
      }
    }).catch(() => {
      // กรณี refresh token หมดอายุ
      setProfileReady(true);
      setLoading(false);
      initialized.current = true;
      clearAuthCache();
    });

    return () => subscription.unsubscribe();
  }, [fetchProfileAndRole]);

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      logAction("warning", "auth", `เข้าสู่ระบบไม่สำเร็จ: ${email}`, { email, reason: error.message });
      return { error: error.message };
    }
    logInfo("auth", `เข้าสู่ระบบสำเร็จ: ${email}`, { email, userId: data.user?.id });

    // Pre-fetch profile ทันทีหลัง login สำเร็จ — ไม่ต้องรอ onAuthStateChange
    if (data.user) {
      lastFetchedUserId.current = data.user.id;
      setUser(data.user);
      setSession(data.session);
      fetchProfileAndRole(data.user.id);
    }

    return { error: null };
  }, [fetchProfileAndRole]);

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
    // Log (and wait) before clearing state/session so the event still carries
    // the user and persists before any redirect.
    await logEventSync({ level: "info", category: "auth", message: "ออกจากระบบ" });
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole("employee");
    setEmployeeId(null);
    setEmployeeData(null);
    setProfileReady(false);
    clearAuthCache();
    // Drop cached page data (memory + the persisted localStorage snapshot) so the
    // next account on this browser never sees the previous user's data.
    queryClient.clear();
    clearPersistedQueryCache();
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("signOut error (state already cleared):", err);
    }
  }, [queryClient]);


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
