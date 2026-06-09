// Edge Function: facescan-adms
// Speaks the ZKTeco/HIP ADMS ("iclock" push) protocol directly.
// The device pushes attendance logs over HTTP to a public relay, which forwards
// the request here. We authenticate by Serial Number (SN) matched to an enabled
// device whose connection_mode = 'adms'.
//
// Supported actions (last path segment, e.g. /facescan-adms/cdata):
//   GET  /cdata        -> handshake; returns device config (plain text)
//   POST /cdata        -> receives ATTLOG (tab-separated rows) -> check_in_records
//   GET  /getrequest   -> returns queued commands (or "OK")
//   POST /devicecmd    -> device acknowledges a command result
//   GET  /ping         -> liveness ("OK")
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const textHeaders = { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" };

function ok(body = "OK") {
  return new Response(body, { status: 200, headers: textHeaders });
}

// Status codes used by ZK/HIP ATTLOG to mark punch direction.
// 1 = check-out, 5 = OT check-out -> treat as check-out; everything else = check-in.
const CHECK_OUT_STATUS = new Set(["1", "5"]);

const VERIFY_MAP: Record<string, string> = {
  "0": "password",
  "1": "fingerprint",
  "2": "card",
  "15": "face",
  "20": "face",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  // Determine action from the final path segment (e.g. .../facescan-adms/cdata -> "cdata")
  const segments = url.pathname.split("/").filter(Boolean);
  const action = (segments[segments.length - 1] || "").toLowerCase();
  const sn = url.searchParams.get("SN") || url.searchParams.get("sn") || "";

  if (action === "ping") return ok();

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Identify the device by Serial Number.
    let device: { id: string; name: string; enabled: boolean } | null = null;
    if (sn) {
      const { data } = await supabaseAdmin
        .from("face_scan_devices")
        .select("id, name, enabled, connection_mode")
        .eq("serial_number", sn)
        .maybeSingle();
      if (data) device = data as any;
    }

    if (!device || !device.enabled) {
      // Unknown / disabled SN. Still reply 200 so the device doesn't error-loop,
      // but record a diagnostic log so the user can SEE that a device reached us
      // even though its SN didn't match an enabled ADMS device.
      console.warn("facescan-adms: unknown or disabled SN", sn, "action", action);
      const reason = !device
        ? `เครื่องส่งข้อมูลเข้ามาแล้ว แต่ไม่พบ SN นี้ในระบบ (SN="${sn || "ว่าง"}") — ตรวจ Serial Number ให้ตรงกับเครื่องในแท็บ "เครื่องสแกน"`
        : `เครื่อง SN="${sn}" ส่งข้อมูลเข้ามา แต่ถูกตั้งค่าเป็น "ปิดใช้" — เปิดใช้งานเครื่องก่อน`;
      try {
        await supabaseAdmin.from("face_scan_sync_logs").insert({
          device_id: device?.id ?? null,
          sync_type: "adms_handshake",
          status: "error",
          records_synced: 0,
          message: `[${req.method} /${action}] ${reason}`,
          command_payload: {},
          finished_at: new Date().toISOString(),
        });
      } catch (_e) {
        // best-effort diagnostics only
      }
      return ok();
    }

    // Mark device as seen.
    await supabaseAdmin
      .from("face_scan_devices")
      .update({ adms_last_seen: new Date().toISOString(), last_status: "success" })
      .eq("id", device.id);

    // ---- GET /cdata : handshake / config ----
    if (action === "cdata" && req.method === "GET") {
      const config = [
        `GET OPTION FROM: ${sn}`,
        "ATTLOGStamp=None",
        "OPERLOGStamp=None",
        "ATTPHOTOStamp=None",
        "ErrorDelay=30",
        "Delay=30",
        "TransTimes=00:00;23:59",
        "TransInterval=1",
        "TransFlag=1111000000",
        "TimeZone=7",
        "Realtime=1",
        "Encrypt=0",
      ].join("\n");
      return ok(config);
    }

    // ---- POST /cdata : receive ATTLOG ----
    if (action === "cdata" && req.method === "POST") {
      const table = (url.searchParams.get("table") || "").toUpperCase();
      const raw = await req.text();

      if (table && table !== "ATTLOG") {
        // OPERLOG / ATTPHOTO etc. — acknowledge but ignore.
        return ok(`OK: 0`);
      }

      const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
      const records = lines
        .map((line) => {
          const f = line.split("\t");
          return {
            enroll_number: (f[0] || "").trim(),
            datetime: (f[1] || "").trim(), // "YYYY-MM-DD HH:MM:SS"
            status: (f[2] || "").trim(),
            verify: (f[3] || "").trim(),
          };
        })
        .filter((r) => r.enroll_number && r.datetime);

      const { data: log } = await supabaseAdmin
        .from("face_scan_sync_logs")
        .insert({
          device_id: device.id,
          sync_type: "adms_push",
          status: "running",
          records_synced: 0,
          message: `ADMS push: ${records.length} rows`,
        })
        .select()
        .single();

      // Map enroll_number -> employee.id
      const enrollIds = [...new Set(records.map((r) => r.enroll_number))];
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
        const empId = empMap.get(rec.enroll_number);
        if (!empId) {
          skipped.push(rec.enroll_number);
          continue;
        }
        // ADMS datetime is device local time: "YYYY-MM-DD HH:MM:SS"
        const m = rec.datetime.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
        if (!m) {
          skipped.push(rec.enroll_number);
          continue;
        }
        const dateStr = `${m[1]}-${m[2]}-${m[3]}`;
        const timeStr = `${m[4]}:${m[5]}`;
        const isCheckOut = CHECK_OUT_STATUS.has(rec.status);

        const { error: insErr } = await supabaseAdmin.from("check_in_records").insert({
          employee_id: empId,
          date: dateStr,
          check_in: isCheckOut ? "-" : timeStr,
          check_out: isCheckOut ? timeStr : null,
          location: "Face Scanner",
          within_radius: true,
          source: "face_scan",
          remark: VERIFY_MAP[rec.verify] ?? "face",
        });
        if (!insErr) inserted++;
      }

      if (log) {
        await supabaseAdmin
          .from("face_scan_sync_logs")
          .update({
            status: "success",
            records_synced: inserted,
            finished_at: new Date().toISOString(),
            message: `Inserted ${inserted}/${records.length}. Unmapped: ${skipped.length}`,
          })
          .eq("id", log.id);
      }

      await supabaseAdmin
        .from("face_scan_devices")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", device.id);

      console.log("facescan-adms ATTLOG", { sn, received: records.length, inserted, skipped: skipped.length });
      // ZK devices expect "OK: <count>"
      return ok(`OK: ${inserted}`);
    }

    // ---- GET /getrequest : device polls for commands ----
    if (action === "getrequest" && req.method === "GET") {
      const { data: pending } = await supabaseAdmin
        .from("face_scan_sync_logs")
        .select("id, command_payload, sync_type")
        .eq("device_id", device.id)
        .eq("status", "queued")
        .order("started_at", { ascending: true })
        .limit(1);

      if (pending && pending.length > 0) {
        const cmd = pending[0];
        await supabaseAdmin
          .from("face_scan_sync_logs")
          .update({ status: "running", started_at: new Date().toISOString() })
          .eq("id", cmd.id);
        // Minimal command form; expand as needed for enroll/delete.
        const cmdText = (cmd.command_payload as any)?.raw || `C:${cmd.id}:CHECK`;
        return ok(cmdText);
      }
      return ok();
    }

    // ---- POST /devicecmd : command acknowledgement ----
    if (action === "devicecmd" && req.method === "POST") {
      const raw = await req.text();
      console.log("facescan-adms devicecmd ack", { sn, raw: raw.slice(0, 500) });
      return ok();
    }

    // Default: acknowledge so the device stays happy.
    return ok();
  } catch (err) {
    console.error("facescan-adms error", err);
    // Still return 200 OK text — ADMS devices retry aggressively on errors.
    return ok();
  }
});
