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
      // Fallback: search auth users by email, paging through all users so an
      // account past the first page is still found (listUsers defaults to 50).
      for (let page = 1; page <= 100 && !targetUserId; page++) {
        const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        const users = list?.users || [];
        const found = users.find((u) => (u.email || "").toLowerCase() === email);
        if (found) targetUserId = found.id;
        if (users.length < 200) break; // last page reached
      }
    }

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: `ไม่พบบัญชีของ ${email}` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // email_confirm: true guarantees the account can sign in right after the
    // reset — an unconfirmed account accepts the new password but is blocked at
    // login with "Email not confirmed", which reads as "the reset didn't work".
    const { error: updateError } = await admin.auth.admin.updateUserById(targetUserId, {
      password,
      email_confirm: true,
    });
    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Keep initial_password in sync so the records match, and backfill the
    // employees.user_id link if it was missing (found via the fallback), so
    // future operations resolve the account directly without paging.
    if (empRow?.id) {
      const patch: { initial_password: string; user_id?: string } = { initial_password: password };
      if (!empRow.user_id) patch.user_id = targetUserId;
      await admin.from("employees").update(patch).eq("id", empRow.id);
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
