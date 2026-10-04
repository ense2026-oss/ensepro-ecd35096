import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Change an employee's login username. Username is the login identity; the auth
// account stores it as <username>@ensepro.com. Admin/HR only. Keeps the three
// stores in sync: auth.users.email, employees.email, employees.username.

const DOMAIN = "ensepro.com";
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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
    const names = (roles || []).map((r: { role_name: string }) => r.role_name);
    if (!names.includes("admin") && !names.includes("hr")) return json({ error: "Forbidden: admin or hr role required" }, 403);

    const body = await req.json();
    const employeeId = body.employeeId as string | undefined;
    const newUsername = (body.newUsername || "").toString().trim().toLowerCase().replace(/\s+/g, "");
    if (!employeeId || !newUsername) return json({ error: "employeeId และ newUsername จำเป็น" }, 400);
    if (!/^[a-z0-9._-]+$/.test(newUsername)) return json({ error: "username ใช้ได้เฉพาะ a-z, 0-9, . _ - (ห้ามเว้นวรรค/ภาษาไทย)" }, 400);

    const newEmail = `${newUsername}@${DOMAIN}`;

    // Uniqueness: no other employee may already use this username.
    const { data: clash } = await admin.from("employees").select("id").eq("username", newUsername).neq("id", employeeId).maybeSingle();
    if (clash) return json({ error: `ชื่อผู้ใช้ "${newUsername}" ถูกใช้แล้ว` }, 409);

    const { data: emp, error: empErr } = await admin.from("employees").select("id, user_id, username").eq("id", employeeId).maybeSingle();
    if (empErr) return json({ error: empErr.message }, 400);
    if (!emp) return json({ error: "ไม่พบข้อมูลพนักงาน" }, 404);
    if (emp.username === newUsername) return json({ ok: true, unchanged: true });
    if (!emp.user_id) return json({ error: "พนักงานคนนี้ยังไม่มีบัญชีเข้าสู่ระบบ" }, 400);

    // Auth email first, then the profile columns, so they can't drift apart.
    const { error: upErr } = await admin.auth.admin.updateUserById(emp.user_id, { email: newEmail, email_confirm: true });
    if (upErr) return json({ error: upErr.message }, 400);

    const { error: rowErr } = await admin.from("employees").update({ username: newUsername, email: newEmail }).eq("id", emp.id);
    if (rowErr) return json({ error: `เปลี่ยนชื่อผู้ใช้ฝั่งเข้าสู่ระบบแล้ว แต่บันทึกลงข้อมูลพนักงานไม่สำเร็จ: ${rowErr.message}` }, 500);

    await admin.from("profiles").update({ username: newUsername }).eq("id", emp.user_id);
    return json({ ok: true, username: newUsername, email: newEmail });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
