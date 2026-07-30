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

  // Origin fingerprint — helps prove that a request really came from the scanner
  // (through the relay) rather than from a browser test.
  const origin = {
    ip:
      req.headers.get("x-forwarded-for") ??
      req.headers.get("cf-connecting-ip") ??
      "unknown",
    user_agent: req.headers.get("user-agent") ?? "unknown",
    method: req.method,
    path: url.pathname,
    query: url.search,
    received_at: new Date().toISOString(),
  };

  if (action === "ping") return ok();

  // Server-side relay diagnostic (called from the settings UI).
  // Runs from the server so relays without CORS headers can still be tested.
  if (action === "relaytest") {
    let raw = url.searchParams.get("relay") || "";
    const testSn = url.searchParams.get("sn") || url.searchParams.get("SN") || "";
    raw = raw.trim().replace(/\/+$/, "");
    if (!raw) {
      return new Response(JSON.stringify({ ok: false, stage: "input", text: "ไม่ได้ระบุ Relay URL" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;

    const json = (b: unknown) =>
      new Response(JSON.stringify(b), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    try {
      const health = await fetch(`${raw}/health`, { signal: AbortSignal.timeout(12000) });
      const healthText = (await health.text()).trim();
      if (!health.ok || !/relay ok/i.test(healthText)) {
        return json({
          ok: false,
          stage: "health",
          text: `Relay ตอบกลับผิดปกติที่ /health (HTTP ${health.status} · "${healthText.slice(0, 60)}") — ตรวจว่า deploy โค้ด relay ถูกต้อง`,
        });
      }

      const hs = await fetch(
        `${raw}/iclock/cdata?SN=${encodeURIComponent(testSn)}&options=all`,
        { signal: AbortSignal.timeout(12000) }
      );
      const hsText = (await hs.text()).trim();
      const passed = hs.ok && hsText.includes("GET OPTION FROM");
      return json({
        ok: passed,
        stage: "handshake",
        text: passed
          ? "ครบวงจร ✓ relay ส่งต่อถึงระบบแล้ว และระบบรู้จัก SN นี้ (ดูรายการ handshake ในแท็บ Sync Logs)"
          : `Relay ทำงาน แต่ระบบยังไม่รู้จัก SN นี้ หรือเครื่องถูกปิดใช้ — ตรวจ Serial Number ให้ตรงกับเครื่องจริง (ตอบกลับ: "${hsText.slice(0, 80)}")`,
      });
    } catch (e) {
      return json({
        ok: false,
        stage: "network",
        text: `ติดต่อ Relay ไม่ได้: ${(e as Error)?.message ?? "unknown"} — ตรวจว่าโดเมนถูกต้องและ deploy แล้ว`,
      });
    }
  }


  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const writeLog = async (row: Record<string, unknown>) => {
    try {
      await supabaseAdmin.from("face_scan_sync_logs").insert({
        records_synced: 0,
        command_payload: { origin },
        finished_at: new Date().toISOString(),
        ...row,
      });
    } catch (_e) {
      // best-effort diagnostics only
    }
  };

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
      await writeLog({
        device_id: device?.id ?? null,
        sync_type: "adms_handshake",
        status: "error",
        message: `[${req.method} /${action}] ${reason}`,
      });
      return ok();
    }

    // Mark device as seen.
    await supabaseAdmin
      .from("face_scan_devices")
      .update({ adms_last_seen: new Date().toISOString(), last_status: "success" })
      .eq("id", device.id);

    // ---- GET /cdata : handshake / config ----
    if (action === "cdata" && req.method === "GET") {
      // Record a successful handshake so the user can confirm in Sync Logs that
      // the device is talking to us (even before any punch is scanned).
      await writeLog({
        device_id: device.id,
        sync_type: "adms_handshake",
        status: "success",
        message: `เครื่อง "${device.name}" (SN=${sn}) เชื่อมต่อสำเร็จ (handshake) — พร้อมรับข้อมูลการสแกน`,
      });
      const config = [
        `GET OPTION FROM: ${sn}`,
        "ATTLOGStamp=None",
        "OPERLOGStamp=9999",
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

    // ---- POST /cdata : receive ATTLOG / OPERLOG(USERINFO) ----
    if (action === "cdata" && req.method === "POST") {
      const table = (url.searchParams.get("table") || "").toUpperCase();
      const raw = await req.text();

      if (table && table !== "ATTLOG") {
        // OPERLOG carries "USER PIN=..." rows — the device user list we need
        // in order to map scanner enroll numbers to employees.
        const userRows = raw
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => /^USER\s+/i.test(l))
          .map((line) => {
            const fields = line.replace(/^USER\s+/i, "").split("\t");
            const kv: Record<string, string> = {};
            for (const f of fields) {
              const i = f.indexOf("=");
              if (i > 0) kv[f.slice(0, i).trim().toLowerCase()] = f.slice(i + 1).trim();
            }
            return {
              device_id: device.id,
              pin: (kv["pin"] || kv["pin2"] || "").trim(),
              name: kv["name"] || "",
              privilege: kv["pri"] || "",
              card_no: kv["card"] || "",
              last_seen_at: new Date().toISOString(),
            };
          })
          .filter((r) => r.pin);

        if (userRows.length > 0) {
          await supabaseAdmin
            .from("face_scan_device_users")
            .upsert(userRows, { onConflict: "device_id,pin" });
        }

        await writeLog({
          device_id: device.id,
          sync_type: userRows.length > 0 ? "adms_userinfo" : "adms_push",
          status: "success",
          records_synced: userRows.length,
          message:
            userRows.length > 0
              ? `ดึงรายชื่อผู้ใช้จากเครื่อง "${device.name}" ได้ ${userRows.length} รายการ`
              : `รับข้อมูลชนิด ${table} จาก "${device.name}" (ไม่ใช่ข้อมูลลงเวลา — ข้าม)`,
        });
        return ok(`OK: ${userRows.length}`);
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

      if (records.length === 0) {
        // The device reached us but sent nothing usable — still log it so the
        // connection itself is visibly confirmed.
        await writeLog({
          device_id: device.id,
          sync_type: "adms_push",
          status: "success",
          message: `เครื่อง "${device.name}" ส่ง POST เข้ามาแล้ว แต่ไม่มีแถวข้อมูลการสแกน (การเชื่อมต่อใช้งานได้)`,
        });
        return ok("OK: 0");
      }

      const { data: log } = await supabaseAdmin
        .from("face_scan_sync_logs")
        .insert({
          device_id: device.id,
          sync_type: "adms_push",
          status: "running",
          records_synced: 0,
          message: `ADMS push: ${records.length} rows`,
          command_payload: { origin },
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

      const unmapped = [...new Set(skipped)];
      if (log) {
        await supabaseAdmin
          .from("face_scan_sync_logs")
          .update({
            status: "success",
            records_synced: inserted,
            finished_at: new Date().toISOString(),
            message:
              `บันทึกแล้ว ${inserted}/${records.length} รายการ` +
              (unmapped.length
                ? ` · ข้าม ${skipped.length} รายการเพราะยังไม่ผูกรหัสพนักงาน (รหัสในเครื่อง: ${unmapped.slice(0, 10).join(", ")})`
                : ""),
            command_payload: { origin, unmapped },
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
        .limit(20);

      if (pending && pending.length > 0) {
        const lines: string[] = [];
        for (const cmd of pending) {
          const payload = (cmd.command_payload ?? {}) as any;
          const cmdId = payload.cmd_id ?? cmd.id.replace(/-/g, "").slice(0, 9);
          const body = payload.raw ?? "CHECK";
          lines.push(`C:${cmdId}:${body}`);
        }
        await supabaseAdmin
          .from("face_scan_sync_logs")
          .update({ status: "running", started_at: new Date().toISOString() })
          .in("id", pending.map((c: any) => c.id));
        console.log("facescan-adms getrequest", { sn, sent: lines.length });
        return ok(lines.join("\n"));
      }
      return ok();
    }

    // ---- POST /devicecmd : command acknowledgement ----
    if (action === "devicecmd" && req.method === "POST") {
      const raw = await req.text();
      console.log("facescan-adms devicecmd ack", { sn, raw: raw.slice(0, 500) });

      const acks = raw
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => {
          const kv: Record<string, string> = {};
          for (const part of line.split("&")) {
            const i = part.indexOf("=");
            if (i > 0) kv[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
          }
          return { id: kv["id"] || "", ret: kv["return"] ?? "0" };
        })
        .filter((a) => a.id);

      for (const ack of acks) {
        const success = ack.ret === "0" || ack.ret === "";
        const { data: rows } = await supabaseAdmin
          .from("face_scan_sync_logs")
          .select("id, command_payload, message")
          .eq("device_id", device.id)
          .eq("status", "running")
          .contains("command_payload", { cmd_id: ack.id })
          .limit(1);

        const row = rows?.[0];
        if (!row) continue;
        const payload = (row.command_payload ?? {}) as any;

        await supabaseAdmin
          .from("face_scan_sync_logs")
          .update({
            status: success ? "success" : "error",
            records_synced: success ? 1 : 0,
            finished_at: new Date().toISOString(),
            message: `${row.message} — เครื่องตอบกลับ Return=${ack.ret}`,
          })
          .eq("id", row.id);

        if (payload.employee_id) {
          await supabaseAdmin.from("face_scan_enroll_status").upsert(
            {
              employee_id: payload.employee_id,
              device_id: device.id,
              status: success ? "synced" : "error",
              synced_at: success ? new Date().toISOString() : null,
              error_message: success ? "" : `Return=${ack.ret}`,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "employee_id,device_id" }
          );
        }
      }
      return ok();
    }


    // Unknown action — log it so a wrong relay path is visible instead of silent.
    await writeLog({
      device_id: device.id,
      sync_type: "adms_handshake",
      status: "error",
      message: `ได้รับ request ที่ไม่รู้จัก [${req.method} /${action}] จาก "${device.name}" — ตรวจการตั้งค่า path ของ relay`,
    });
    return ok();
  } catch (err) {
    console.error("facescan-adms error", err);
    // Still return 200 OK text — ADMS devices retry aggressively on errors.
    return ok();
  }
});
