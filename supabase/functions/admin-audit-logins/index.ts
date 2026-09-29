import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Read-only diagnostic: for every employee with a linked login, compare the
// real Auth login email (auth.users) against the address shown in the app
// (employees.email), and flag accounts whose email has drifted or is not
// confirmed. Those are exactly the accounts where "reset the password but
// still can't log in" happens. Admin-only; does not modify anything.

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
    if (!roleNames.includes("admin") && !roleNames.includes("hr")) {
      return json({ error: "Forbidden: admin or hr role required" }, 403);
    }

    // Build a map of auth users' real emails / confirmation status.
    const authByeId = new Map<string, { email: string; confirmed: boolean }>();
    for (let page = 1; page <= 100; page++) {
      const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      const users = list?.users || [];
      for (const u of users) {
        authByeId.set(u.id, {
          email: (u.email || "").toLowerCase(),
          confirmed: !!u.email_confirmed_at,
        });
      }
      if (users.length < 200) break;
    }

    const { data: emps, error: empError } = await admin
      .from("employees")
      .select("id, first_name, last_name, email, role, user_id")
      .not("user_id", "is", null)
      .order("created_at", { ascending: true });
    if (empError) return json({ error: empError.message }, 400);

    const mismatched: unknown[] = [];
    const unconfirmed: unknown[] = [];
    const missingAuth: unknown[] = [];
    let okCount = 0;

    for (const e of emps || []) {
      const profileEmail = (e.email || "").toLowerCase();
      const auth = authByeId.get(e.user_id);
      const name = `${e.first_name || ""} ${e.last_name || ""}`.trim();
      if (!auth) {
        missingAuth.push({ id: e.id, name, role: e.role, profileEmail });
        continue;
      }
      if (auth.email !== profileEmail) {
        mismatched.push({ id: e.id, name, role: e.role, profileEmail, authEmail: auth.email });
      } else if (!auth.confirmed) {
        unconfirmed.push({ id: e.id, name, role: e.role, profileEmail });
      } else {
        okCount++;
      }
    }

    return json({
      ok: true,
      totalLinked: (emps || []).length,
      okCount,
      mismatchedCount: mismatched.length,
      unconfirmedCount: unconfirmed.length,
      missingAuthCount: missingAuth.length,
      mismatched,
      unconfirmed,
      missingAuth,
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
