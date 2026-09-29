import React, { createContext, useContext, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// Swaps the browser's real Supabase Auth session to the target employee's own
// session (via a service-role generated magiclink), so RLS and every role/
// permission check downstream run as that employee actually would — not a
// cosmetic UI role switch still authenticated as the admin.
//
// Both entering and leaving impersonation finish with a FULL page reload
// (window.location), not a SPA navigate: after the auth session changes every
// context provider (permissions, org, employees, …) must re-initialise from the
// new session, and a clean boot is far more reliable than trying to refresh a
// dozen live providers in place — which caused the "stuck / can't go back" bug.

const STASH_KEY = "impersonation_admin_session";
const FLAG_KEY = "impersonation_active_name";

interface StashedSession {
  access_token: string;
  refresh_token: string;
}

interface ImpersonationContextType {
  isImpersonating: boolean;
  impersonatedName: string | null;
  busy: boolean;
  startImpersonation: (employeeId: string) => Promise<{ error: string | null }>;
  stopImpersonation: () => Promise<void>;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

const readFlag = (): string | null => {
  try {
    return sessionStorage.getItem(FLAG_KEY);
  } catch {
    return null;
  }
};

export const ImpersonationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [impersonatedName, setImpersonatedName] = useState<string | null>(readFlag);
  const [busy, setBusy] = useState(false);

  const startImpersonation = useCallback(async (employeeId: string): Promise<{ error: string | null }> => {
    setBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentSession = sessionData.session;
      if (!currentSession) {
        setBusy(false);
        return { error: "ไม่พบเซสชันผู้ดูแลระบบ" };
      }

      const { data, error } = await supabase.functions.invoke("admin-impersonate-user", {
        body: { employeeId },
      });
      if (error || data?.error) {
        setBusy(false);
        return { error: data?.error || error?.message || "เข้าสู่ระบบในฐานะพนักงานไม่สำเร็จ" };
      }

      const { tokenHash, targetName } = data as { tokenHash: string; targetName: string };

      // Stash the admin session BEFORE swapping so we can restore it on exit.
      const stash: StashedSession = {
        access_token: currentSession.access_token,
        refresh_token: currentSession.refresh_token,
      };
      try {
        sessionStorage.setItem(STASH_KEY, JSON.stringify(stash));
        sessionStorage.setItem(FLAG_KEY, targetName || "พนักงาน");
      } catch {
        setBusy(false);
        return { error: "เบราว์เซอร์ปิดการเก็บ session ชั่วคราว ไม่สามารถใช้ Login as ได้" };
      }

      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "magiclink",
      });
      if (verifyError) {
        try {
          sessionStorage.removeItem(STASH_KEY);
          sessionStorage.removeItem(FLAG_KEY);
        } catch {}
        setBusy(false);
        return { error: verifyError.message };
      }

      // Boot the app fresh as the target employee.
      window.location.assign("/dashboard");
      return { error: null };
    } catch (err: any) {
      setBusy(false);
      return { error: err?.message || "เกิดข้อผิดพลาด" };
    }
  }, []);

  const stopImpersonation = useCallback(async (): Promise<void> => {
    setBusy(true);
    let restored = false;
    try {
      const raw = sessionStorage.getItem(STASH_KEY);
      if (raw) {
        const stash: StashedSession = JSON.parse(raw);
        const { data, error } = await supabase.auth.setSession({
          access_token: stash.access_token,
          refresh_token: stash.refresh_token,
        });
        restored = !!data?.session && !error;
      }
    } catch (err) {
      console.warn("stopImpersonation restore failed:", err);
    }

    try {
      sessionStorage.removeItem(STASH_KEY);
      sessionStorage.removeItem(FLAG_KEY);
    } catch {}

    if (restored) {
      // Back to admin — full reload so every provider re-initialises cleanly.
      window.location.assign("/employees");
    } else {
      // The stashed admin session is gone/expired — don't leave the app in a
      // broken half-state. Sign out cleanly and send them to log in again.
      try {
        await supabase.auth.signOut();
      } catch {}
      window.location.assign("/login?expired=1");
    }
  }, []);

  return (
    <ImpersonationContext.Provider
      value={{
        isImpersonating: !!impersonatedName,
        impersonatedName,
        busy,
        startImpersonation,
        stopImpersonation,
      }}
    >
      {children}
      {busy && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-9 h-9 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-foreground">กำลังสลับสิทธิ์การเข้าใช้งาน...</p>
          </div>
        </div>
      )}
    </ImpersonationContext.Provider>
  );
};

export const useImpersonation = (): ImpersonationContextType => {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error("useImpersonation must be used within ImpersonationProvider");
  return ctx;
};
