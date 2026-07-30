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
      pull_users: "ดึงรายชื่อผู้ใช้จากเครื่อง",
      pull_logs: "ดึง check-in/out logs จากเครื่อง",
      delete_user: "ลบผู้ใช้จากเครื่อง",
      test_connection: "ทดสอบการเชื่อมต่อ",
    };

    // Target devices (ADMS devices poll /getrequest for these commands).
    let deviceQuery = supabaseAdmin
      .from("face_scan_devices")
      .select("id, name, connection_mode")
      .eq("enabled", true);
    if (deviceId) deviceQuery = deviceQuery.eq("id", deviceId);
    const { data: devices } = await deviceQuery;
    const admsDevices = (devices ?? []).filter((d: any) => d.connection_mode === "adms");

    // --- Real ADMS command queueing ---
    if ((syncType === "pull_users" || syncType === "enroll_push") && admsDevices.length > 0) {
      const rows: any[] = [];

      if (syncType === "pull_users") {
        for (const d of admsDevices) {
          rows.push({
            device_id: d.id,
            sync_type: "pull_users",
            status: "queued",
            records_synced: 0,
            message: `ขอรายชื่อผู้ใช้จากเครื่อง "${d.name}"`,
            command_payload: { cmd_id: shortId(), raw: "DATA QUERY USERINFO PIN=" },
          });
          rows.push({
            device_id: d.id,
            sync_type: "pull_users",
            status: "queued",
            records_synced: 0,
            message: `สั่งให้เครื่อง "${d.name}" อัปโหลดข้อมูลค้าง (CHECK)`,
            command_payload: { cmd_id: shortId(), raw: "CHECK" },
          });
        }
      } else {
        const { data: employees } = await supabaseAdmin
          .from("employees")
          .select("id, first_name, last_name, face_scan_id, status")
          .eq("status", "active")
          .neq("face_scan_id", "");

        const list = employees ?? [];
        if (list.length === 0) {
          return new Response(
            JSON.stringify({ error: "ยังไม่มีพนักงานที่ผูกรหัสเครื่องสแกน" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        for (const d of admsDevices) {
          for (const e of list as any[]) {
            const pin = sanitize(String(e.face_scan_id));
            const name = sanitize(`${e.first_name} ${e.last_name}`);
            rows.push({
              device_id: d.id,
              sync_type: "enroll_push",
              status: "queued",
              records_synced: 0,
              message: `ส่งชื่อ "${name}" (PIN=${pin}) ไปเครื่อง "${d.name}"`,
              command_payload: {
                cmd_id: shortId(),
                employee_id: e.id,
                raw: `DATA UPDATE USERINFO PIN=${pin}\tName=${name}\tPri=0\tPasswd=\tCard=\tGrp=1\tTZ=0000000000000000`,
              },
            });
          }
          await supabaseAdmin.from("face_scan_enroll_status").upsert(
            (list as any[]).map((e) => ({
              employee_id: e.id,
              device_id: d.id,
              status: "pending",
              error_message: "",
              updated_at: new Date().toISOString(),
            })),
            { onConflict: "employee_id,device_id" }
          );
        }
      }

      const { error: insErr } = await supabaseAdmin.from("face_scan_sync_logs").insert(rows);
      if (insErr) throw insErr;

      return new Response(
        JSON.stringify({ success: true, queued: rows.length, devices: admsDevices.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
