import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

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
// How long a prefetched login-as session stays usable (well under the magiclink
// session lifetime). Prefetching on hover makes the click itself as fast as the
// instant admin-restore: no network in the critical path, just a storage write.
const PREFETCH_TTL = 4 * 60 * 1000;

interface Prefetched {
  session?: { access_token?: string; refresh_token?: string };
  tokenHash?: string;
  targetName?: string;
  ts: number;
}

interface AdminSnapshot {
  authKey: string;
  blob: string;
}

interface ImpersonationContextType {
  isImpersonating: boolean;
  impersonatedName: string | null;
  busy: boolean;
  startImpersonation: (employeeId: string) => Promise<{ error: string | null }>;
  // Warm up a target's session ahead of the click (e.g. on hover) so the actual
  // switch is instant. Safe to call repeatedly; no-op if already warm/in-flight.
  prefetchImpersonation: (employeeId: string) => void;
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

  // Warm sessions keyed by employeeId, filled by prefetchImpersonation(hover).
  const prefetchRef = useRef<Map<string, Prefetched>>(new Map());
  const inflightRef = useRef<Set<string>>(new Set());

  // Call the edge function once and return what it gives (session or tokenHash).
  const callImpersonateFn = useCallback(async (employeeId: string) => {
    const { data, error } = await supabase.functions.invoke("admin-impersonate-user", {
      body: { employeeId },
    });
    if (error || (data as any)?.error) {
      return { error: (data as any)?.error || error?.message || "เข้าสู่ระบบในฐานะพนักงานไม่สำเร็จ" };
    }
    return data as { session?: { access_token?: string; refresh_token?: string }; tokenHash?: string; targetName?: string };
  }, []);

  const prefetchImpersonation = useCallback((employeeId: string) => {
    if (!employeeId) return;
    const cached = prefetchRef.current.get(employeeId);
    if (cached && Date.now() - cached.ts < PREFETCH_TTL) return; // already warm
    if (inflightRef.current.has(employeeId)) return;             // already fetching
    inflightRef.current.add(employeeId);
    callImpersonateFn(employeeId)
      .then((res) => {
        // Only cache a full SESSION (long-lived access token). We deliberately do
        // NOT cache a magiclink tokenHash: it is single-use and short-lived, so a
        // cached hash used on click later fails with "Email link is invalid or has
        // expired". With the old function (hash only), click just fetches fresh.
        if (!("error" in res) && res.session?.access_token && res.session?.refresh_token) {
          if (prefetchRef.current.size > 4) prefetchRef.current.clear();
          prefetchRef.current.set(employeeId, { session: res.session, targetName: res.targetName, ts: Date.now() });
        }
      })
      .catch(() => {})
      .finally(() => inflightRef.current.delete(employeeId));
  }, [callImpersonateFn]);

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

      // Use a prefetched (hover-warmed) result if we have one — this makes the
      // click itself instant, like the admin-restore. Otherwise fetch now.
      const warm = prefetchRef.current.get(employeeId);
      let data: { session?: { access_token?: string; refresh_token?: string }; tokenHash?: string; targetName?: string } | { error: string };
      if (warm && Date.now() - warm.ts < PREFETCH_TTL) {
        prefetchRef.current.delete(employeeId);
        data = { session: warm.session, tokenHash: warm.tokenHash, targetName: warm.targetName };
      } else {
        data = await callImpersonateFn(employeeId);
      }
      if ("error" in data) {
        setBusy(false);
        return { error: data.error };
      }

      // Apply one result: write the session directly, or exchange the magiclink.
      // `retriable` means the magiclink was invalid/expired/used — we can get a
      // fresh link and try again.
      const applyData = async (
        d: { session?: { access_token?: string; refresh_token?: string }; tokenHash?: string; targetName?: string },
      ): Promise<{ error: string | null; retriable?: boolean }> => {
        try {
          sessionStorage.setItem(STASH_KEY, JSON.stringify({ authKey, blob: adminBlob }));
          sessionStorage.setItem(FLAG_KEY, d.targetName || "พนักงาน");
        } catch {
          return { error: "เบราว์เซอร์ปิดการเก็บ session ชั่วคราว ไม่สามารถใช้ Login as ได้" };
        }

        // Fast path: a full session — write it to storage (lock-free) and reload.
        if (d.session?.access_token && d.session?.refresh_token) {
          try {
            localStorage.setItem(authKey, JSON.stringify(d.session));
          } catch {
            clearFlags();
            return { error: "เบราว์เซอร์ปิดการเก็บ session ไม่สามารถใช้ Login as ได้" };
          }
          window.location.assign("/dashboard");
          return { error: null };
        }

        // Fallback (older function): exchange the (fresh) magiclink here.
        if (!d.tokenHash) {
          clearFlags();
          return { error: "สร้างเซสชันเข้าสู่ระบบไม่สำเร็จ" };
        }
        const verifyRes = await withTimeout(
          supabase.auth.verifyOtp({ token_hash: d.tokenHash, type: "magiclink" }),
          20000,
        );
        if (verifyRes === TIMEOUT_SENTINEL) {
          clearFlags();
          return { error: "สลับสิทธิ์ช้าผิดปกติ กรุณาลองใหม่อีกครั้ง" };
        }
        if (verifyRes.error) {
          clearFlags();
          // Token invalid/expired/used — a fresh link will fix it.
          return { error: verifyRes.error.message, retriable: true };
        }
        window.location.assign("/dashboard");
        return { error: null };
      };

      let result = await applyData(data);
      // If the magiclink had expired or was already used, fetch a brand-new link
      // and try once more — this is what caused the occasional
      // "Email link is invalid or has expired" on Login as.
      if (result.error && result.retriable) {
        const fresh = await callImpersonateFn(employeeId);
        if (!("error" in fresh)) {
          result = await applyData(fresh);
        }
      }
      if (result.error) {
        setBusy(false);
        return { error: result.error };
      }
      return { error: null };
    } catch (err: any) {
      setBusy(false);
      return { error: err?.message || "เกิดข้อผิดพลาด" };
    }
  }, [callImpersonateFn]);

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
        prefetchImpersonation,
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
