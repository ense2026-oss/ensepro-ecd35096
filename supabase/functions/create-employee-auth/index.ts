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
    const { email, password, fullName, role, employeeId } = await req.json();

    if (!email || !password || !employeeId) {
      return new Response(JSON.stringify({ error: "email, password, and employeeId are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

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
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;

    // Link employee record to auth user
    const { error: updateError } = await supabaseAdmin
      .from("employees")
      .update({ user_id: userId })
      .eq("id", employeeId);

    if (updateError) {
      console.error("Failed to link employee:", updateError);
    }

    return new Response(JSON.stringify({ userId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
