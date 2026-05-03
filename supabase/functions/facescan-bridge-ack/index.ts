// Edge Function: facescan-bridge-ack
// Bridge Service reports the result of a queued command.
// Body: { log_id, status: 'success'|'error', message?, records_synced?, enroll_results?: [{employee_id, status, error_message}] }
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-bridge-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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

    const body = await req.json().catch(() => ({}));
    const logId: string | undefined = body.log_id;
    const status: string = body.status === "success" ? "success" : "error";
    const message: string = (body.message ?? "").toString().slice(0, 500);
    const recordsSynced: number = Number(body.records_synced ?? 0);
    const enrollResults: any[] = Array.isArray(body.enroll_results) ? body.enroll_results : [];

    if (!logId) {
      return new Response(JSON.stringify({ error: "log_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update log row
    const { data: log } = await supabaseAdmin
      .from("face_scan_sync_logs")
      .update({
        status,
        records_synced: recordsSynced,
        finished_at: new Date().toISOString(),
        message,
      })
      .eq("id", logId)
      .select()
      .maybeSingle();

    // If enroll results provided → upsert into face_scan_enroll_status
    if (log && enrollResults.length > 0 && log.device_id) {
      const rows = enrollResults
        .filter((r) => r && r.employee_id)
        .map((r) => ({
          employee_id: r.employee_id,
          device_id: log.device_id,
          status: r.status === "success" ? "synced" : "error",
          synced_at: r.status === "success" ? new Date().toISOString() : null,
          error_message: (r.error_message ?? "").toString().slice(0, 500),
        }));
      if (rows.length > 0) {
        await supabaseAdmin
          .from("face_scan_enroll_status")
          .upsert(rows, { onConflict: "employee_id,device_id" });
      }
    }

    // Update device last_status
    if (log?.device_id) {
      await supabaseAdmin
        .from("face_scan_devices")
        .update({ last_sync_at: new Date().toISOString(), last_status: status })
        .eq("id", log.device_id);
    }

    await supabaseAdmin
      .from("face_scan_bridge_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", tokenRow.id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("facescan-bridge-ack error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
