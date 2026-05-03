// Edge Function: facescan-bridge-poll
// Bridge Service polls this endpoint (every ~30s) to:
//   1) refresh device list + employee enroll list
//   2) pick up pending command queue (test_connection / enroll_push / pull_logs / delete_user)
// Auth: Bridge Token via x-bridge-token header.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-bridge-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

async function sha256Hex(input: string) {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const token =
      req.headers.get("x-bridge-token") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      "";
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing bridge token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const tokenHash = await sha256Hex(token);
    const { data: tokenRow } = await supabaseAdmin
      .from("face_scan_bridge_tokens")
      .select("id, enabled")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (!tokenRow || !tokenRow.enabled) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: devices }, { data: employees }, { data: pending }] = await Promise.all([
      supabaseAdmin.from("face_scan_devices").select("*").eq("enabled", true).order("name"),
      supabaseAdmin
        .from("employees")
        .select("id, first_name, last_name, face_scan_id, status")
        .eq("status", "active")
        .neq("face_scan_id", ""),
      supabaseAdmin
        .from("face_scan_sync_logs")
        .select("id, device_id, sync_type, command_payload, message")
        .eq("status", "queued")
        .order("started_at", { ascending: true })
        .limit(50),
    ]);

    // Mark picked-up commands as 'running' so we don't dispatch twice
    const pendingIds = (pending ?? []).map((p: any) => p.id);
    if (pendingIds.length > 0) {
      await supabaseAdmin
        .from("face_scan_sync_logs")
        .update({ status: "running", started_at: new Date().toISOString() })
        .in("id", pendingIds);
    }

    await supabaseAdmin
      .from("face_scan_bridge_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", tokenRow.id);

    return new Response(
      JSON.stringify({
        success: true,
        poll_interval_seconds: 30,
        devices: devices ?? [],
        enroll_list: (employees ?? []).map((e: any) => ({
          employee_id: e.id,
          enroll_number: e.face_scan_id,
          name: `${e.first_name} ${e.last_name}`.trim(),
        })),
        commands: pending ?? [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("facescan-bridge-poll error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
