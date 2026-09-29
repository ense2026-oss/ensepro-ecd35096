import React, { createContext, useContext, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FullScreenLoader } from "@/components/ui/dots-loader";

// Swaps the browser's real Supabase Auth session to the target employee's own
// session (via a service-role generated magiclink), so RLS and every role/
// permission check downstream run as that employee actually would — not a
// cosmetic UI role switch still authenticated as the admin.
//
// Restoring the admin session does NOT go through supabase.auth.setSession:
// that call acquires the auth lock and, in some environments, hangs long enough
// that the app either freezes on the overlay or reloads while the target's
// session is still the one in storage — leaving the admin stuck with the
// employee's rights. Instead we snapshot the admin's raw auth-token blob from
// storage on the way in, and on the way out write that blob straight back and
// reload. Storage writes are synchronous and lock-free, so the restore is
// deterministic; the fresh boot then reads the admin session and auto-refreshes
// its token if needed.

const STASH_KEY = "impersonation_admin_session";
const FLAG_KEY = "impersonation_active_name";
const AUTH_KEY_RE = /^sb-.*-auth-token$/;

interface AdminSnapshot {
  authKey: string;
  blob: string;
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

// The localStorage key Supabase stores the session under (sb-<ref>-auth-token).
const findAuthKey = (): string | null => {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && AUTH_KEY_RE.test(k)) return k;
    }
  } catch {}
  return null;
};

const clearFlags = () => {
  try {
    sessionStorage.removeItem(STASH_KEY);
    sessionStorage.removeItem(FLAG_KEY);
  } catch {}
};

// Supabase auth calls acquire an internal lock; in some environments a slow
// round-trip leaves the promise pending far too long. Race it against a timeout
// so the switch never freezes on the overlay.
const TIMEOUT_SENTINEL = Symbol("timeout");
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | typeof TIMEOUT_SENTINEL> {
  return Promise.race([p, new Promise<typeof TIMEOUT_SENTINEL>((resolve) => setTimeout(() => resolve(TIMEOUT_SENTINEL), ms))]);
}

export const ImpersonationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Set once from storage on mount; both entering and leaving impersonation do a
  // full reload, so this state is only ever read, never updated in place.
  const [impersonatedName] = useState<string | null>(readFlag);
  const [busy, setBusy] = useState(false);

  const startImpersonation = useCallback(async (employeeId: string): Promise<{ error: string | null }> => {
    setBusy(true);
    try {
      // Snapshot the admin's session blob straight from storage — this is what we
      // write back on exit, no auth-lock call needed to restore.
      const authKey = findAuthKey();
      const adminBlob = authKey ? localStorage.getItem(authKey) : null;
      if (!authKey || !adminBlob) {
        setBusy(false);
        return { error: "ไม่พบเซสชันผู้ดูแลระบบ กรุณาเข้าสู่ระบบใหม่" };
      }

      const { data, error } = await supabase.functions.invoke("admin-impersonate-user", {
        body: { employeeId },
      });
      if (error || data?.error) {
        setBusy(false);
        return { error: data?.error || error?.message || "เข้าสู่ระบบในฐานะพนักงานไม่สำเร็จ" };
      }

      const { tokenHash, targetName } = data as { tokenHash: string; targetName: string };

      const snapshot: AdminSnapshot = { authKey, blob: adminBlob };
      try {
        sessionStorage.setItem(STASH_KEY, JSON.stringify(snapshot));
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
    let restored = false;
    try {
      const raw = sessionStorage.getItem(STASH_KEY);
      if (raw) {
        const snap = JSON.parse(raw) as AdminSnapshot;
        if (snap?.authKey && snap?.blob) {
          // Write the admin session blob straight back over the target's — the
          // next boot reads it as the admin session. Synchronous, no lock, no hang.
          localStorage.setItem(snap.authKey, snap.blob);
          restored = true;
        }
      }
    } catch (err) {
      console.warn("stopImpersonation restore failed:", err);
    }

    clearFlags();

    if (restored) {
      window.location.assign("/employees");
    } else {
      // Nothing to restore — clear whatever session is there and send to login.
      try {
        const k = findAuthKey();
        if (k) localStorage.removeItem(k);
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
      {busy && <FullScreenLoader label="กำลังสลับสิทธิ์การเข้าใช้งาน..." />}
    </ImpersonationContext.Provider>
  );
};

export const useImpersonation = (): ImpersonationContextType => {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error("useImpersonation must be used within ImpersonationProvider");
  return ctx;
};
