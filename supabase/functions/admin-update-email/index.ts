import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Changes an employee's LOGIN email in Supabase Auth (auth.users), which only a
// service-role client can do. Editing employees.email alone never touched the
// credential, so a changed email could not be used to sign in.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller and enforce admin/hr role (same contract as admin-reset-password)
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData?.user) return json({ error: "Invalid session" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: roles } = await admin
      .from("user_roles")
      .select("role_name")
      .eq("user_id", userData.user.id);
    const roleNames = (roles || []).map((r: { role_name: string }) => r.role_name);
    if (!roleNames.includes("admin") && !roleNames.includes("hr")) {
      return json({ error: "Forbidden: admin or hr role required" }, 403);
    }

    const body = await req.json();
    const employeeId = body.employeeId as string | undefined;
    const newEmail = (body.newEmail || "").replace(/\s+/g, "").trim().toLowerCase();
    if (!employeeId || !newEmail) return json({ error: "employeeId and newEmail are required" }, 400);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail) || newEmail.includes("@.") || newEmail.includes(".@")) {
      return json({ error: `อีเมล "${newEmail}" มีรูปแบบไม่ถูกต้อง` }, 400);
    }

    const { data: emp, error: empError } = await admin
      .from("employees")
      .select("id, email, user_id")
      .eq("id", employeeId)
      .maybeSingle();
    if (empError) return json({ error: empError.message }, 400);
    if (!emp) return json({ error: "ไม่พบข้อมูลพนักงาน" }, 404);

    // No linked login yet: nothing to sync in Auth. The caller writes employees.email
    // itself, and create-employee-auth will use that address when the account is made.
    if (!emp.user_id) return json({ ok: true, linked: false });

    if ((emp.email || "").toLowerCase() === newEmail) return json({ ok: true, linked: true, unchanged: true });

    // Update the credential first; only if that succeeds do we touch the profile row,
    // so the two stores can never disagree.
    const { error: updateError } = await admin.auth.admin.updateUserById(emp.user_id, {
      email: newEmail,
      email_confirm: true,
    });
    if (updateError) return json({ error: updateError.message }, 400);

    const { error: rowError } = await admin.from("employees").update({ email: newEmail }).eq("id", emp.id);
    if (rowError) {
      // Auth already changed — report loudly rather than pretend nothing happened.
      return json({ error: `เปลี่ยนอีเมลเข้าสู่ระบบแล้ว แต่บันทึกลงข้อมูลพนักงานไม่สำเร็จ: ${rowError.message}` }, 500);
    }

    return json({ ok: true, linked: true, userId: emp.user_id });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
