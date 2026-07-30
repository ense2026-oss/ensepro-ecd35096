// Edge Function: facescan-queue-command
// Admin/HR queues a command for the Bridge Service.
// Body: { device_id?: string|null, sync_type: 'enroll_push'|'pull_logs'|'delete_user'|'test_connection', payload?: object }
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_TYPES = new Set([
  "enroll_push",
  "pull_users",
  "pull_logs",
  "delete_user",
  "test_connection",
]);

const shortId = () =>
  Math.floor(Math.random() * 900000000 + 100000000).toString();

const sanitize = (v: string) => v.replace(/[\t\r\n]/g, " ").trim();


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAuthorized = (roles ?? []).some(
      (r: any) => r.role === "admin" || r.role === "hr" || r.role === "executive"
    );
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const syncType: string = (body.sync_type ?? "").toString();
    const deviceId: string | null = body.device_id ?? null;
    const payload = body.payload ?? {};

    if (!ALLOWED_TYPES.has(syncType)) {
      return new Response(
        JSON.stringify({ error: `Invalid sync_type. Allowed: ${[...ALLOWED_TYPES].join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messages: Record<string, string> = {
      enroll_push: deviceId ? "Push รายชื่อพนักงานไปเครื่อง" : "Push รายชื่อพนักงานไปทุกเครื่อง",
      pull_logs: "ดึง check-in/out logs จากเครื่อง",
      delete_user: "ลบผู้ใช้จากเครื่อง",
      test_connection: "ทดสอบการเชื่อมต่อ",
    };

    const { data: log, error } = await supabaseAdmin
      .from("face_scan_sync_logs")
      .insert({
        device_id: deviceId,
        sync_type: syncType,
        status: "queued",
        records_synced: 0,
        message: messages[syncType] ?? syncType,
        command_payload: payload,
      })
      .select()
      .single();
    if (error) throw error;

    return new Response(JSON.stringify({ success: true, log_id: log.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("facescan-queue-command error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
