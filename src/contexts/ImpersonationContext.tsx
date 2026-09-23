import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Swaps the browser's real Supabase Auth session to the target employee's own
// session (via a service-role generated magiclink), so RLS and every role/
// permission check downstream run as that employee actually would — not a
// cosmetic UI role switch still authenticated as the admin.

const STASH_KEY = "impersonation_admin_session";
const FLAG_KEY = "impersonation_active_name";

interface StashedSession {
  access_token: string;
  refresh_token: string;
}

interface ImpersonationContextType {
  isImpersonating: boolean;
  impersonatedName: string | null;
  startImpersonation: (employeeId: string) => Promise<{ error: string | null }>;
  stopImpersonation: () => Promise<void>;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

export const ImpersonationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [impersonatedName, setImpersonatedName] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const name = sessionStorage.getItem(FLAG_KEY);
      if (name) setImpersonatedName(name);
    } catch {}
  }, []);

  const startImpersonation = useCallback(async (employeeId: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentSession = sessionData.session;
      if (!currentSession) return { error: "ไม่พบเซสชันผู้ดูแลระบบ" };

      const { data, error } = await supabase.functions.invoke("admin-impersonate-user", {
        body: { employeeId },
      });
      if (error || data?.error) {
        return { error: data?.error || error?.message || "เข้าสู่ระบบในฐานะพนักงานไม่สำเร็จ" };
      }

      const { tokenHash, targetName } = data as { tokenHash: string; targetName: string };

      const stash: StashedSession = {
        access_token: currentSession.access_token,
        refresh_token: currentSession.refresh_token,
      };
      sessionStorage.setItem(STASH_KEY, JSON.stringify(stash));
      sessionStorage.setItem(FLAG_KEY, targetName || "พนักงาน");

      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "magiclink",
      });
      if (verifyError) {
        sessionStorage.removeItem(STASH_KEY);
        sessionStorage.removeItem(FLAG_KEY);
        return { error: verifyError.message };
      }

      setImpersonatedName(targetName || "พนักงาน");
      navigate("/dashboard");
      return { error: null };
    } catch (err: any) {
      return { error: err.message || "เกิดข้อผิดพลาด" };
    }
  }, [navigate]);

  const stopImpersonation = useCallback(async () => {
    try {
      const raw = sessionStorage.getItem(STASH_KEY);
      if (raw) {
        const stash: StashedSession = JSON.parse(raw);
        await supabase.auth.setSession({
          access_token: stash.access_token,
          refresh_token: stash.refresh_token,
        });
      } else {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn("stopImpersonation error:", err);
    } finally {
      sessionStorage.removeItem(STASH_KEY);
      sessionStorage.removeItem(FLAG_KEY);
      setImpersonatedName(null);
      navigate("/employees");
    }
  }, [navigate]);

  return (
    <ImpersonationContext.Provider
      value={{
        isImpersonating: !!impersonatedName,
        impersonatedName,
        startImpersonation,
        stopImpersonation,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
};

export const useImpersonation = (): ImpersonationContextType => {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error("useImpersonation must be used within ImpersonationProvider");
  return ctx;
};
