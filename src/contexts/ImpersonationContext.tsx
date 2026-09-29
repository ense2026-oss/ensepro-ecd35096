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

// Supabase auth calls acquire an internal lock; in some environments a slow
// network/storage round-trip leaves that call pending for a long time, which
// would freeze the switch on the loading overlay forever. Race every auth call
// against a timeout so the flow always resolves and can fall back to a reload.
const TIMEOUT_SENTINEL = Symbol("timeout");
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | typeof TIMEOUT_SENTINEL> {
  return Promise.race([p, new Promise<typeof TIMEOUT_SENTINEL>((resolve) => setTimeout(() => resolve(TIMEOUT_SENTINEL), ms))]);
}

const clearFlags = () => {
  try {
    sessionStorage.removeItem(STASH_KEY);
    sessionStorage.removeItem(FLAG_KEY);
  } catch {}
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

      const verifyRes = await withTimeout(
        supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" }),
        20000,
      );
      if (verifyRes === TIMEOUT_SENTINEL) {
        clearFlags();
        setBusy(false);
        return { error: "สลับสิทธิ์ช้าผิดปกติ กรุณาลองใหม่อีกครั้ง" };
      }
      if (verifyRes.error) {
        clearFlags();
        setBusy(false);
        return { error: verifyRes.error.message };
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
    // true = admin session restored, false = definitely failed, null = unknown
    // (setSession took too long; it usually still wrote the tokens to storage, so
    // a fresh reload picks the admin session back up).
    let restored: boolean | null = false;
    try {
      const raw = sessionStorage.getItem(STASH_KEY);
      if (raw) {
        const stash: StashedSession = JSON.parse(raw);
        const res = await withTimeout(
          supabase.auth.setSession({
            access_token: stash.access_token,
            refresh_token: stash.refresh_token,
          }),
          8000,
        );
        restored = res === TIMEOUT_SENTINEL ? null : !!res.data?.session && !res.error;
      }
    } catch (err) {
      console.warn("stopImpersonation restore failed:", err);
    }

    clearFlags();

    if (restored === false) {
      // The stashed admin session is genuinely gone/expired — don't leave the app
      // in a broken half-state. Sign out cleanly and send them to log in again.
      try {
        await withTimeout(supabase.auth.signOut(), 5000);
      } catch {}
      window.location.assign("/login?expired=1");
    } else {
      // Restored, or unknown-but-likely-written — reload fresh as admin. The full
      // reload resets the auth client (clearing any stuck lock) and boots from the
      // admin tokens now in storage.
      window.location.assign("/employees");
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
