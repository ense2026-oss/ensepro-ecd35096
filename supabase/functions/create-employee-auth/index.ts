import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const email = (body.email || "").replace(/\s+/g, "").trim();
    const { password, fullName, role, employeeId } = body;

    if (!email || !password || !employeeId) {
      return new Response(JSON.stringify({ error: "email, password, and employeeId are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    console.log("Creating auth user for:", email, "with role:", role);

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Map role string to app_role enum value
    const roleMap: Record<string, string> = {
      "Admin": "admin",
      "HR": "hr",
      "Manager": "manager",
      "Employee": "employee",
      "Accountant": "accountant",
      "Executive": "executive",
    };
    const appRole = roleMap[role] || "employee";

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName || email, role: appRole },
    });

    if (authError) {
      console.error("Auth error:", JSON.stringify(authError));
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;
    console.log("Auth user created:", userId);

    // Manually create profile if trigger doesn't exist
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        full_name: fullName || email,
        username: email.split("@")[0],
      }, { onConflict: "id" });

    if (profileError) {
      console.error("Profile upsert error:", JSON.stringify(profileError));
    }

    // Manually create user_role if trigger doesn't exist
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({
        user_id: userId,
        role: appRole,
      }, { onConflict: "user_id,role" });

    if (roleError) {
      console.error("Role upsert error:", JSON.stringify(roleError));
      // Try insert instead
      await supabaseAdmin.from("user_roles").insert({
        user_id: userId,
        role: appRole,
      });
    }

    // Link employee record to auth user and save initial password
    const { error: updateError } = await supabaseAdmin
      .from("employees")
      .update({ user_id: userId, initial_password: password })
      .eq("id", employeeId);

    if (updateError) {
      console.error("Failed to link employee:", JSON.stringify(updateError));
    }

    console.log("Employee linked successfully:", employeeId, "->", userId);

    return new Response(JSON.stringify({ userId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err.message, err.stack);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
