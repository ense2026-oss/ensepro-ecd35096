import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// DESTRUCTIVE bulk reset + import. Admin-only. Deletes every non-admin employee
// (and, via ON DELETE CASCADE, all their attendance/leave/OT/payslip history),
// then creates the employees from the uploaded file plus a username login for
// each (synthetic email <username>@ensepro.com, default password). Always call
// once with { dryRun: true } first to see exactly what it will do.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

interface InEmp {
  username: string;
  auth_email: string;
  password?: string;
  prefix?: string;
  first_name: string;
  last_name: string;
  nickname?: string;
  email?: string;
  gender?: string;
  national_id?: string;
  birth_date?: string;
  blood_group?: string;
  phone?: string;
  address?: string;
  home_address?: string;
  dept?: string;
  position?: string;
  start_date?: string;
  trial_end_date?: string;
  contract_end_date?: string;
  salary?: string;
  bank_account?: string;
  driver_license?: string;
  marital_status?: string;
  children?: number;
  sons?: number;
  daughters?: number;
  education_level?: string;
  education_major?: string;
  education_school?: string;
  note?: string;
  status?: string; // "active" | "inactive" | "leave"
}

const DEFAULT_PASSWORD = "123456";
const d = (s?: string) => (s ?? "").toString().trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: ures, error: uerr } = await caller.auth.getUser();
    if (uerr || !ures?.user) return json({ error: "Invalid session" }, 401);

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: roles } = await admin.from("user_roles").select("role_name").eq("user_id", ures.user.id);
    if (!(roles || []).some((r: { role_name: string }) => r.role_name === "admin")) {
      return json({ error: "Forbidden: admin role required" }, 403);
    }

    const body = await req.json();
    const dryRun = body?.dryRun === true;
    const emps = (body?.employees as InEmp[]) || [];
    if (!Array.isArray(emps) || emps.length === 0) return json({ error: "employees array is required" }, 400);

    // ── Validate the payload up front ────────────────────────────────────
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const seenU = new Set<string>();
    const seenE = new Set<string>();
    const problems: string[] = [];
    for (const [i, e] of emps.entries()) {
      const u = d(e.username).toLowerCase();
      const em = d(e.auth_email).toLowerCase();
      if (!u) problems.push(`แถว ${i + 1}: ไม่มี username`);
      if (!em || !emailRe.test(em)) problems.push(`แถว ${i + 1} (${u}): auth_email ไม่ถูกต้อง`);
      if (!d(e.first_name)) problems.push(`แถว ${i + 1} (${u}): ไม่มีชื่อ`);
      if (seenU.has(u)) problems.push(`username ซ้ำในไฟล์: ${u}`);
      if (seenE.has(em)) problems.push(`auth_email ซ้ำในไฟล์: ${em}`);
      seenU.add(u); seenE.add(em);
    }
    if (problems.length) return json({ error: "ข้อมูลนำเข้าไม่ผ่านการตรวจสอบ", problems }, 400);

    // ── Who stays / who goes ─────────────────────────────────────────────
    const { data: current, error: curErr } = await admin
      .from("employees")
      .select("id, user_id, first_name, last_name, national_id, face_scan_id, shift, role, is_protected");
    if (curErr) return json({ error: curErr.message }, 400);

    const keep = (current || []).filter((e: any) => d(e.role).toLowerCase() === "admin" || e.is_protected === true);
    const remove = (current || []).filter((e: any) => !(d(e.role).toLowerCase() === "admin" || e.is_protected === true));

    // Preserve the face-scan link: the Excel has no PIN, so remember each current
    // person's face_scan_id (and shift) by national id / name, then re-apply it to
    // the matching new employee after import. The device_users rows survive the
    // delete (matched_employee_id just goes NULL) and get re-linked below.
    const nidKey = (s?: string) => d(s).replace(/[^\d]/g, "");
    const nameKey = (f?: string, l?: string) => `${d(f)}|${d(l)}`.replace(/\s+/g, "");
    const scanByNid = new Map<string, string>();
    const scanByName = new Map<string, string>();
    const shiftByNid = new Map<string, string>();
    const shiftByName = new Map<string, string>();
    for (const e of (current || []) as any[]) {
      const nk = nidKey(e.national_id);
      const nmk = nameKey(e.first_name, e.last_name);
      if (d(e.face_scan_id)) { if (nk) scanByNid.set(nk, d(e.face_scan_id)); scanByName.set(nmk, d(e.face_scan_id)); }
      if (d(e.shift)) { if (nk) shiftByNid.set(nk, d(e.shift)); shiftByName.set(nmk, d(e.shift)); }
    }
    const scanFor = (e: InEmp) => scanByNid.get(nidKey(e.national_id)) || scanByName.get(nameKey(e.first_name, e.last_name)) || "";
    const shiftFor = (e: InEmp) => shiftByNid.get(nidKey(e.national_id)) || shiftByName.get(nameKey(e.first_name, e.last_name)) || "";

    // Map existing auth users by email so a re-run (or the 2 real @ensepro.com
    // accounts) updates in place instead of failing on "already registered".
    const authByEmail = new Map<string, string>();
    for (let page = 1; page <= 100; page++) {
      const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      const us = list?.users || [];
      for (const u of us) if (u.email) authByEmail.set(u.email.toLowerCase(), u.id);
      if (us.length < 200) break;
    }

    if (dryRun) {
      const willConflict = emps.filter((e) => authByEmail.has(d(e.auth_email).toLowerCase())).map((e) => e.auth_email);
      const scanMatched = emps.filter((e) => scanFor(e));
      const scanUnmatched = (current || []).filter((e: any) => d(e.face_scan_id) && !(d(e.role).toLowerCase() === "admin" || e.is_protected === true))
        .filter((e: any) => !emps.some((n) => nidKey(n.national_id) === nidKey(e.national_id) || nameKey(n.first_name, n.last_name) === nameKey(e.first_name, e.last_name)));
      return json({
        ok: true,
        dryRun: true,
        currentTotal: current?.length || 0,
        willKeep: keep.map((e: any) => `${e.first_name} ${e.last_name} (${e.role})`),
        willDeleteCount: remove.length,
        willCreateCount: emps.length,
        authEmailsAlreadyExist: willConflict, // will be updated, not created
        faceScan: {
          currentlyLinked: scanByName.size,
          willRelink: scanMatched.length,
          willLoseLink: scanUnmatched.map((e: any) => `${e.first_name} ${e.last_name} (PIN ${e.face_scan_id})`),
        },
        sample: emps.slice(0, 5).map((e) => ({ username: e.username, auth_email: e.auth_email, name: `${e.first_name} ${e.last_name}`, dept: e.dept, position: e.position, face_scan_id: scanFor(e) || "-" })),
        note: "ยังไม่มีการเขียนข้อมูลใด ๆ — เรียกซ้ำด้วย dryRun:false เพื่อทำจริง",
      });
    }

    // ── DESTRUCTIVE from here ────────────────────────────────────────────
    const report = { deletedEmployees: 0, deletedAuthUsers: 0, created: 0, updatedExistingAuth: 0, faceScanRelinked: 0, failed: [] as unknown[] };

    // 1) Delete the auth users linked to the employees we're removing, so no
    //    orphan logins are left behind. (Employee rows cascade on delete.)
    for (const e of remove as any[]) {
      if (e.user_id) {
        const { error } = await admin.auth.admin.deleteUser(e.user_id);
        if (!error) report.deletedAuthUsers++;
      }
    }
    // 2) Delete the employee rows (cascades all their history).
    const removeIds = (remove as any[]).map((e) => e.id);
    if (removeIds.length) {
      const { error } = await admin.from("employees").delete().in("id", removeIds);
      if (error) return json({ error: `ลบพนักงานเดิมไม่สำเร็จ: ${error.message}`, report }, 500);
      report.deletedEmployees = removeIds.length;
    }

    // 3) Create each new employee + its login.
    for (const e of emps) {
      const email = d(e.auth_email).toLowerCase();
      const username = d(e.username).toLowerCase();
      const password = d(e.password) || DEFAULT_PASSWORD;
      const fullName = `${d(e.first_name)} ${d(e.last_name)}`.trim();
      try {
        let userId = authByEmail.get(email);
        if (userId) {
          await admin.auth.admin.updateUserById(userId, { password, email_confirm: true, user_metadata: { full_name: fullName, role: "employee" } });
          report.updatedExistingAuth++;
        } else {
          const { data: created, error: cErr } = await admin.auth.admin.createUser({
            email, password, email_confirm: true, user_metadata: { full_name: fullName, role: "employee" },
          });
          if (cErr || !created?.user) throw new Error(cErr?.message || "createUser failed");
          userId = created.user.id;
        }

        // profiles + role
        await admin.from("profiles").upsert({ id: userId, full_name: fullName, username }, { onConflict: "id" });
        await admin.from("user_roles").delete().eq("user_id", userId);
        await admin.from("user_roles").insert({ user_id: userId, role: "employee", role_name: "employee" });

        const faceScanId = scanFor(e); // preserved PIN from the deleted record (by national id / name)
        const { data: inserted, error: insErr } = await admin.from("employees").insert({
          user_id: userId,
          username,
          email, // synthetic login email kept here so admin-reset-password/update-email resolve by it
          initial_password: password,
          prefix: d(e.prefix),
          first_name: d(e.first_name),
          last_name: d(e.last_name),
          nickname: d(e.nickname),
          gender: d(e.gender),
          national_id: d(e.national_id),
          birth_date: d(e.birth_date),
          blood_group: d(e.blood_group),
          phone: d(e.phone),
          address: d(e.address),
          home_address: d(e.home_address),
          dept: d(e.dept),
          position: d(e.position),
          employee_type: "พนักงานประจำ",
          nationality: "ไทย",
          face_scan_id: faceScanId,
          shift: shiftFor(e),
          start_date: d(e.start_date),
          trial_end_date: d(e.trial_end_date),
          contract_end_date: d(e.contract_end_date),
          salary: d(e.salary) || "0",
          bank_account: d(e.bank_account),
          driver_license: d(e.driver_license),
          marital_status: d(e.marital_status),
          children: Number(e.children) || 0,
          sons: Number(e.sons) || 0,
          daughters: Number(e.daughters) || 0,
          role: "Employee",
          status: d(e.status) || "active",
        }).select("id").single();
        if (insErr || !inserted) throw new Error(`insert employees: ${insErr?.message || "no row"}`);
        report.created++;

        // Re-link the face-scan device user back to this new employee row.
        if (faceScanId) {
          const { error: relErr } = await admin
            .from("face_scan_device_users")
            .update({ matched_employee_id: inserted.id })
            .eq("pin", faceScanId);
          if (!relErr) report.faceScanRelinked++;
        }
      } catch (err) {
        report.failed.push({ username, email, name: fullName, reason: (err as Error).message });
      }
    }

    console.log(`[import] admin ${ures.user.email} reset: deleted ${report.deletedEmployees} emp / ${report.deletedAuthUsers} auth, created ${report.created}, failed ${report.failed.length}`);
    return json({ ok: true, dryRun: false, ...report });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
