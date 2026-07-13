import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller and enforce admin/hr role
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: roles } = await admin
      .from("user_roles")
      .select("role_name")
      .eq("user_id", userData.user.id);
    const roleNames = (roles || []).map((r: { role_name: string }) => r.role_name);
    if (!roleNames.includes("admin") && !roleNames.includes("hr")) {
      return new Response(JSON.stringify({ error: "Forbidden: admin or hr role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const email = (body.email || "").replace(/\s+/g, "").trim().toLowerCase();
    const password = body.password;
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "email and password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the target auth user by email
    const { data: empRow } = await admin
      .from("employees")
      .select("id, user_id")
      .ilike("email", email)
      .maybeSingle();

    let targetUserId = empRow?.user_id as string | null | undefined;

    if (!targetUserId) {
      // Fallback: search auth users by email
      const { data: list } = await admin.auth.admin.listUsers();
      const found = list?.users?.find((u) => (u.email || "").toLowerCase() === email);
      targetUserId = found?.id;
    }

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: `ไม่พบบัญชีของ ${email}` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(targetUserId, { password });
    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Keep initial_password in sync so the records match
    if (empRow?.id) {
      await admin.from("employees").update({ initial_password: password }).eq("id", empRow.id);
    }

    return new Response(JSON.stringify({ success: true, userId: targetUserId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
