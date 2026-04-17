// Edge Function: facescan-ingest
// Receives attendance records from Bridge Service and inserts into check_in_records.
// Auth: validates Bridge Token from face_scan_bridge_tokens (SHA-256 hashed).
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

interface IngestRecord {
  enroll_number: string; // device user id (mapped to employees.face_scan_id)
  datetime: string; // ISO 8601
  verify_mode?: string; // 'face' | 'card' | 'fingerprint' | 'password'
  in_out?: number; // 0=in, 1=out
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

    // Validate token
    const tokenHash = await sha256Hex(token);
    const { data: tokenRow, error: tokenErr } = await supabaseAdmin
      .from("face_scan_bridge_tokens")
      .select("id, enabled")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (tokenErr || !tokenRow || !tokenRow.enabled) {
      return new Response(JSON.stringify({ error: "Invalid or disabled token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const deviceId: string | null = body.device_id ?? null;
    const records: IngestRecord[] = Array.isArray(body.records) ? body.records : [];

    // Create a sync log entry
    const { data: log } = await supabaseAdmin
      .from("face_scan_sync_logs")
      .insert({
        device_id: deviceId,
        sync_type: "ingest",
        status: "running",
        records_synced: 0,
        message: `Received ${records.length} records`,
      })
      .select()
      .single();

    // Build a map: face_scan_id -> employee.id
    const enrollIds = [...new Set(records.map((r) => String(r.enroll_number)).filter(Boolean))];
    let empMap = new Map<string, string>();
    if (enrollIds.length > 0) {
      const { data: emps } = await supabaseAdmin
        .from("employees")
        .select("id, face_scan_id")
        .in("face_scan_id", enrollIds);
      empMap = new Map((emps ?? []).map((e: any) => [String(e.face_scan_id), e.id as string]));
    }

    let inserted = 0;
    const skipped: string[] = [];

    for (const rec of records) {
      const empId = empMap.get(String(rec.enroll_number));
      if (!empId) {
        skipped.push(rec.enroll_number);
        continue;
      }
      const dt = new Date(rec.datetime);
      if (isNaN(dt.getTime())) {
        skipped.push(rec.enroll_number);
        continue;
      }
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      const hh = String(dt.getHours()).padStart(2, "0");
      const mi = String(dt.getMinutes()).padStart(2, "0");
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const timeStr = `${hh}:${mi}`;
      const isCheckOut = rec.in_out === 1;

      const { error: insErr } = await supabaseAdmin.from("check_in_records").insert({
        employee_id: empId,
        date: dateStr,
        check_in: isCheckOut ? "-" : timeStr,
        check_out: isCheckOut ? timeStr : null,
        location: "Face Scanner",
        within_radius: true,
        source: "face_scan",
        remark: rec.verify_mode ?? "face",
      });
      if (!insErr) inserted++;
    }

    // Update log + token last_used + device last_sync
    await Promise.all([
      log
        ? supabaseAdmin
            .from("face_scan_sync_logs")
            .update({
              status: "success",
              records_synced: inserted,
              finished_at: new Date().toISOString(),
              message: `Inserted ${inserted} of ${records.length}. Unmapped: ${skipped.length}`,
            })
            .eq("id", log.id)
        : Promise.resolve(),
      supabaseAdmin
        .from("face_scan_bridge_tokens")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", tokenRow.id),
      deviceId
        ? supabaseAdmin
            .from("face_scan_devices")
            .update({ last_sync_at: new Date().toISOString(), last_status: "success" })
            .eq("id", deviceId)
        : Promise.resolve(),
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        received: records.length,
        inserted,
        skipped: skipped.length,
        unmapped_enroll_ids: skipped,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("facescan-ingest error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
