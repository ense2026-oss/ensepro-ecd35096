// Edge Function: facescan-test-connection
// Triggered from the UI to test if a Bridge Service can reach a specific device.
// Strategy: write a 'test_request' row to face_scan_sync_logs that the bridge
// service polls and responds to, OR allow the bridge to call back with results.
//
// Since the bridge runs on a private LAN and cannot be reached directly, we use
// a "command queue" pattern: the UI inserts a queued log entry; the bridge
// (on its next poll) sees it via facescan-bridge-config?include_pending=1,
// performs the test, and updates the row via facescan-ingest-status (or the
// existing ingest function with a special payload).
//
// For an immediate "is the bridge alive?" indicator, this function returns the
// most recent successful sync time per device + checks if there is any active
// (enabled) bridge token whose last_used_at is within the last 2 minutes.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user is authenticated and is admin/hr
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData } = await supabaseUser.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!roleRow || !["admin", "hr"].includes(roleRow.role as string)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const deviceId: string | undefined = body.device_id;
    if (!deviceId) {
      return new Response(JSON.stringify({ error: "device_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Check device exists
    const { data: device } = await supabaseAdmin
      .from("face_scan_devices")
      .select("*")
      .eq("id", deviceId)
      .maybeSingle();
    if (!device) {
      return new Response(JSON.stringify({ error: "Device not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Check bridge liveness — any bridge token used in last 2 minutes?
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: liveTokens } = await supabaseAdmin
      .from("face_scan_bridge_tokens")
      .select("id, name, last_used_at")
      .eq("enabled", true)
      .gte("last_used_at", twoMinAgo)
      .order("last_used_at", { ascending: false })
      .limit(1);

    const bridgeOnline = !!(liveTokens && liveTokens.length > 0);

    // 3. Queue a test command for the bridge to pick up on next poll
    const { data: cmdLog } = await supabaseAdmin
      .from("face_scan_sync_logs")
      .insert({
        device_id: deviceId,
        sync_type: "test_connection",
        status: "queued",
        records_synced: 0,
        message: `Test connection requested for ${device.name} (${device.device_ip})`,
      })
      .select()
      .single();

    // 4. Build response
    return new Response(
      JSON.stringify({
        success: true,
        bridge_online: bridgeOnline,
        bridge_last_seen: liveTokens?.[0]?.last_used_at ?? null,
        bridge_token_name: liveTokens?.[0]?.name ?? null,
        device: {
          id: device.id,
          name: device.name,
          device_ip: device.device_ip,
          last_sync_at: device.last_sync_at,
          last_status: device.last_status,
        },
        queued_log_id: cmdLog?.id ?? null,
        message: bridgeOnline
          ? `Bridge online. คำสั่ง test ถูก queue ไว้แล้ว — bridge จะทดสอบในรอบ poll ถัดไป (≤30 วินาที)`
          : `Bridge offline (ไม่มี token ที่ใช้งานใน 2 นาทีที่ผ่านมา) — ตรวจสอบว่า Bridge Service กำลังรันอยู่บน PC ในออฟฟิศ`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("facescan-test-connection error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
