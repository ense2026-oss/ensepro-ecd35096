import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Shield, CheckCircle2, XCircle } from "lucide-react";

// Local typed wrapper — supabase.auth.oauth is a beta namespace that the
// generated types may not surface yet.
type AuthorizationDetails = {
  client?: { name?: string; client_id?: string; client_uri?: string; logo_uri?: string };
  scope?: string;
  redirect_uri?: string;
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthResult = { data: AuthorizationDetails | null; error: { message: string } | null };
const oauthApi = (supabase.auth as unknown as {
  oauth: {
    getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
    approveAuthorization: (id: string) => Promise<OAuthResult>;
    denyAuthorization: (id: string) => Promise<OAuthResult>;
  };
}).oauth;

const OAuthConsent = () => {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        setLoading(false);
        return;
      }
      if (!oauthApi) {
        setError("OAuth server is not enabled on this project yet.");
        setLoading(false);
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        // Preserve the full consent URL so /login returns the user here after sign-in.
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauthApi.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  const decide = async (approve: boolean) => {
    setBusy(true);
    setError(null);
    const call = approve ? oauthApi.approveAuthorization : oauthApi.denyAuthorization;
    const { data, error } = await call(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  };

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md card-base p-6 space-y-5">{children}</div>
    </div>
  );

  if (loading) {
    return shell(
      <div className="flex flex-col items-center gap-3 py-8">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">กำลังโหลดคำขอเชื่อมต่อ...</p>
      </div>,
    );
  }

  if (error) {
    return shell(
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-destructive">
          <XCircle className="w-5 h-5" />
          <h1 className="text-lg font-bold font-display">เชื่อมต่อไม่สำเร็จ</h1>
        </div>
        <p className="text-sm text-muted-foreground break-words">{error}</p>
      </div>,
    );
  }

  if (!details) return null;

  const clientName = details.client?.name ?? "แอปพลิเคชันภายนอก";
  const scopes = (details.scope ?? "").split(/\s+/).filter(Boolean);

  return shell(
    <div className="space-y-5">
      <div
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
        style={{
          background: "hsl(var(--primary) / 0.15)",
          color: "hsl(var(--primary))",
          border: "1px solid hsl(var(--primary) / 0.3)",
        }}
      >
        <Shield className="w-3.5 h-3.5" /> อนุญาตการเชื่อมต่อ
      </div>
      <div>
        <h1 className="text-xl font-bold font-display">
          เชื่อมต่อ <span style={{ color: "hsl(var(--primary))" }}>{clientName}</span> กับบัญชีของคุณ
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {clientName} จะสามารถเรียกใช้ tools ของแอปนี้ในนามของคุณได้ ในขณะที่คุณลงชื่อเข้าใช้อยู่
        </p>
      </div>

      <div className="rounded-xl p-3 text-sm space-y-1.5" style={{ background: "hsl(var(--muted) / 0.4)" }}>
        <div className="font-semibold">การเข้าถึงที่จะได้รับ</div>
        <ul className="space-y-1 text-muted-foreground">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "hsl(var(--primary))" }} />
            <span>อ่านข้อมูลโปรไฟล์พนักงาน คำขอลา บันทึกเวลา และคำขอ OT ของคุณ</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "hsl(var(--primary))" }} />
            <span>ยึดตามสิทธิ์การใช้งานและ RLS ของบัญชีคุณ ไม่ข้ามการควบคุมสิทธิ์ใดๆ</span>
          </li>
        </ul>
        {scopes.length > 0 && (
          <div className="pt-2 text-xs text-muted-foreground">
            Scopes: <span className="font-mono">{scopes.join(" ")}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          disabled={busy}
          onClick={() => decide(false)}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all disabled:opacity-50"
          style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}
        >
          ปฏิเสธ
        </button>
        <button
          disabled={busy}
          onClick={() => decide(true)}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))",
            color: "hsl(var(--primary-foreground))",
            boxShadow: "0 4px 14px hsl(var(--primary) / 0.35)",
          }}
        >
          {busy ? "กำลังดำเนินการ..." : "อนุญาต"}
        </button>
      </div>
    </div>,
  );
};

export default OAuthConsent;
