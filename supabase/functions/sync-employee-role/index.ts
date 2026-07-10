import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    // Verify token by getting user directly
    const { data: { user: callingUser }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !callingUser) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = callingUser.id;

    // Check caller is authorized: admin/hr role OR has edit access to the "settings" module
    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const roles = (callerRoles ?? []).map((r) => r.role);
    let authorized = roles.some((r) => ["admin", "hr"].includes(r));

    if (!authorized) {
      const { data: canEditSettings } = await supabaseAdmin.rpc("can_access_module", {
        _user_id: userId,
        _module: "settings",
        _action: "edit",
      });
      authorized = canEditSettings === true;
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, employeeId, newRole } = await req.json();

    const roleMap: Record<string, string> = {
      "Admin": "admin", "HR": "hr", "Manager": "manager",
      "Employee": "employee", "Accountant": "accountant", "Executive": "executive",
    };

    if (action === "sync_role") {
      if (!employeeId || !newRole) {
        return new Response(JSON.stringify({ error: "employeeId and newRole required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const appRole = roleMap[newRole] || newRole; // base roles map to enum text; custom roles kept verbatim to match role_permissions.role_name

      const { data: emp } = await supabaseAdmin
        .from("employees")
        .select("user_id")
        .eq("id", employeeId)
        .single();

      if (!emp?.user_id) {
        return new Response(JSON.stringify({ ok: true, message: "No linked auth account" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Base roles map to the app_role enum; custom roles are stored only in role_name.
      const baseRoles = ["admin", "hr", "manager", "employee", "accountant", "executive"];
      const enumRole = baseRoles.includes(appRole) ? appRole : null;

      // Replace the user's role entirely (supports switching to/from custom roles)
      await supabaseAdmin.from("user_roles").delete().eq("user_id", emp.user_id);

      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: emp.user_id, role: enumRole, role_name: appRole });

      if (roleError) {
        console.error("Role sync error:", roleError);
      }

      await supabaseAdmin.auth.admin.updateUserById(emp.user_id, {
        user_metadata: { role: appRole },
      });


      console.log(`Role synced: employee ${employeeId} -> ${appRole}`);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "cleanup_employee") {
      if (!employeeId) {
        return new Response(JSON.stringify({ error: "employeeId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: emp } = await supabaseAdmin
        .from("employees")
        .select("user_id, email")
        .eq("id", employeeId)
        .single();

      // Protect the primary admin account from deletion regardless of role
      if (emp?.email && emp.email.toLowerCase() === "ense2026@gmail.com") {
        return new Response(JSON.stringify({ error: "ไม่สามารถลบบัญชีผู้ดูแลระบบหลักนี้ได้" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (emp?.user_id) {
        await supabaseAdmin.from("user_roles").delete().eq("user_id", emp.user_id);
        await supabaseAdmin.from("profiles").delete().eq("id", emp.user_id);
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(emp.user_id);
        if (deleteError) {
          console.error("Failed to delete auth user:", deleteError);
        }
        console.log(`Cleaned up auth account for employee ${employeeId}, user ${emp.user_id}`);
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("Unexpected error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
