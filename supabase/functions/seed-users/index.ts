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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Employees that need auth accounts
    const employeesToCreate = [
      { id: "821e9bf1-abfc-4b06-a269-0ad2dec1c974", name: "สุดา ดีใจ", role: "accountant", email: "suda@example.com" },
      { id: "afc2debf-d56f-4410-82fb-57e8afd17de9", name: "กาญจนา ใสซื่อ", role: "admin", email: "kanjana@example.com" },
      { id: "408c135b-2f28-4936-9316-60a87f99145f", name: "นิดา สุขใจ", role: "employee", email: "nida@example.com" },
      { id: "6fe12fc8-19e8-4b81-a386-58d323702cf8", name: "ประสิทธิ์ ทำได้", role: "employee", email: "prasit@example.com" },
      { id: "12c92dd4-0c19-495a-883e-c199d4ba986e", name: "มานะ ขยัน", role: "employee", email: "mana@example.com" },
      { id: "fb70ad9e-e340-4658-8291-a95efb4f94a4", name: "ทดสอบ ทองดี", role: "employee", email: "test.tongdee@example.com" },
      { id: "92bb7a6c-4a5e-40f7-b9a7-8d243d99eaf2", name: "วิชัย เก่งมาก", role: "employee", email: "wichai@example.com" },
      { id: "f8f6eaca-7774-4bc4-8124-ecac002d9040", name: "ทดสอบ สมจริง", role: "employee", email: "test.somjing@example.com" },
      { id: "c665adc0-2599-48ff-80e2-8d8b669627d1", name: "ธนกร บริหาร", role: "executive", email: "thanakorn@example.com" },
      { id: "f57a0655-959e-469b-9343-08689e50b112", name: "สมหญิง รักงาน", role: "hr", email: "somying@example.com" },
    ];

    const results = [];

    for (const emp of employeesToCreate) {
      // Create auth user
      const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: emp.email,
        password: "Test1234!",
        email_confirm: true,
        user_metadata: { full_name: emp.name, role: emp.role },
      });

      if (createError) {
        results.push({ employee: emp.name, error: createError.message });
        continue;
      }

      const userId = userData.user.id;

      // Link employee to auth user
      const { error: updateError } = await supabaseAdmin
        .from("employees")
        .update({ user_id: userId })
        .eq("id", emp.id);

      if (updateError) {
        results.push({ employee: emp.name, error: `Link failed: ${updateError.message}` });
        continue;
      }

      // Ensure user_roles entry (trigger should create, but ensure correct role)
      const { data: existingRole } = await supabaseAdmin
        .from("user_roles")
        .select("id, role")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingRole && existingRole.role !== emp.role) {
        await supabaseAdmin
          .from("user_roles")
          .update({ role: emp.role })
          .eq("id", existingRole.id);
      } else if (!existingRole) {
        await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: userId, role: emp.role });
      }

      // Ensure profile exists
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

      if (!existingProfile) {
        await supabaseAdmin
          .from("profiles")
          .insert({ id: userId, full_name: emp.name });
      }

      results.push({ employee: emp.name, role: emp.role, email: emp.email, userId, status: "created" });
    }

    return new Response(JSON.stringify({ results }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
