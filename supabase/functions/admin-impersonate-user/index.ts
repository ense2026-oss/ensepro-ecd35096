import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Lets an admin obtain a REAL Supabase Auth session for another employee's
// linked login, so RLS and the rest of the app enforce that employee's actual
// permissions — not a UI-level role switch still running under the admin's
// own auth session. Uses generateLink (magiclink) instead of the target's
// password, which the admin never has.

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
    if (!roleNames.includes("admin")) {
      return json({ error: "Forbidden: admin role required" }, 403);
    }

    const body = await req.json();
    const employeeId = body.employeeId as string | undefined;
    if (!employeeId) return json({ error: "employeeId is required" }, 400);

    const { data: target, error: targetError } = await admin
      .from("employees")
      .select("id, email, user_id, role, is_protected, first_name, last_name")
      .eq("id", employeeId)
      .maybeSingle();
    if (targetError) return json({ error: targetError.message }, 400);
    if (!target) return json({ error: "ไม่พบข้อมูลพนักงาน" }, 404);
    if (!target.user_id) return json({ error: "พนักงานคนนี้ยังไม่มีบัญชีเข้าสู่ระบบ" }, 400);
    if (target.user_id === userData.user.id) return json({ error: "ไม่สามารถเข้าสู่ระบบในฐานะตัวเองได้" }, 400);
    if (target.is_protected) return json({ error: "ไม่สามารถเข้าสู่ระบบในฐานะบัญชีที่มีการป้องกันนี้ได้" }, 403);
    if ((target.role || "").toLowerCase() === "admin") {
      return json({ error: "ไม่สามารถเข้าสู่ระบบในฐานะผู้ดูแลระบบคนอื่นได้" }, 403);
    }
    if (!target.email) return json({ error: "พนักงานคนนี้ไม่มีอีเมลที่ผูกกับบัญชี" }, 400);

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: target.email,
    });
    if (linkError) return json({ error: linkError.message }, 400);

    const hashedToken = linkData?.properties?.hashed_token;
    if (!hashedToken) return json({ error: "สร้างลิงก์เข้าสู่ระบบไม่สำเร็จ" }, 500);

    console.log(
      `[impersonate] admin ${userData.user.id} (${userData.user.email}) started session as employee ${target.id} (${target.email})`,
    );

    return json({
      ok: true,
      tokenHash: hashedToken,
      targetName: `${target.first_name || ""} ${target.last_name || ""}`.trim(),
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
