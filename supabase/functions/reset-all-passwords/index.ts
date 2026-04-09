import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { defaultPassword, excludeAdmins, batchStart = 0, batchSize = 20 } = await req.json();
    const password = defaultPassword || "Password123!";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get employees with user_id, with pagination
    let query = supabaseAdmin
      .from("employees")
      .select("id, first_name, last_name, user_id, role")
      .not("user_id", "is", null)
      .order("created_at", { ascending: true })
      .range(batchStart, batchStart + batchSize - 1);

    const { data: employees, error: empError } = await query;
    if (empError) throw empError;

    const results: { name: string; success: boolean; error?: string }[] = [];

    for (const emp of employees || []) {
      if (excludeAdmins && emp.role === "Admin") {
        results.push({ name: `${emp.first_name} ${emp.last_name}`, success: true, error: "skipped (admin)" });
        continue;
      }

      try {
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          emp.user_id,
          { password }
        );

        if (updateError) {
          results.push({ name: `${emp.first_name} ${emp.last_name}`, success: false, error: updateError.message });
        } else {
          await supabaseAdmin
            .from("employees")
            .update({ initial_password: password })
            .eq("id", emp.id);

          results.push({ name: `${emp.first_name} ${emp.last_name}`, success: true });
        }
      } catch (e) {
        results.push({ name: `${emp.first_name} ${emp.last_name}`, success: false, error: e.message });
      }
    }

    const successCount = results.filter(r => r.success && r.error !== "skipped (admin)").length;
    const skippedCount = results.filter(r => r.error === "skipped (admin)").length;
    const failedCount = results.filter(r => !r.success).length;
    const hasMore = (employees?.length || 0) >= batchSize;

    return new Response(JSON.stringify({
      message: `รีเซ็ตรหัสผ่านสำเร็จ ${successCount} คน, ข้าม ${skippedCount} คน, ล้มเหลว ${failedCount} คน`,
      results,
      successCount,
      skippedCount,
      failedCount,
      hasMore,
      nextBatchStart: batchStart + batchSize,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
