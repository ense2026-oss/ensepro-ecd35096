import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// One-pass repair: for every employee with a linked login, force the real Auth
// login email (auth.users) to match the address shown in the app
// (employees.email), and confirm it. Accounts whose email already matches are
// left untouched, so healthy logins are never put at risk. This fixes the
// "password is correct but can't log in" cases caused by an Auth email that
// drifted from the displayed one. Admin-only. Read report returned per account.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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
    if (!(roles || []).some((r: { role_name: string }) => r.role_name === "admin")) {
      return json({ error: "Forbidden: admin role required" }, 403);
    }

    // dryRun: report what WOULD change without touching anything.
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dryRun === true;

    // Map every auth user's id -> {email, confirmed}
    const authById = new Map<string, { email: string; confirmed: boolean }>();
    for (let page = 1; page <= 100; page++) {
      const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      const users = list?.users || [];
      for (const u of users) {
        authById.set(u.id, { email: (u.email || "").toLowerCase(), confirmed: !!u.email_confirmed_at });
      }
      if (users.length < 200) break;
    }

    const { data: emps, error: empErr } = await admin
      .from("employees")
      .select("id, first_name, last_name, email, user_id")
      .not("user_id", "is", null)
      .not("email", "is", null)
      .neq("email", "")
      .order("created_at", { ascending: true });
    if (empErr) return json({ error: empErr.message }, 400);

    const fixed: unknown[] = [];
    const failed: unknown[] = [];
    const skippedInvalid: unknown[] = [];
    let alreadyOk = 0;

    for (const e of emps || []) {
      const name = `${e.first_name || ""} ${e.last_name || ""}`.trim();
      const want = (e.email || "").trim().toLowerCase();
      const auth = authById.get(e.user_id);

      if (!emailRe.test(want)) { skippedInvalid.push({ name, email: e.email }); continue; }
      if (!auth) { failed.push({ name, email: want, reason: "ไม่พบบัญชี auth ที่ผูกไว้" }); continue; }

      const needsEmail = auth.email !== want;
      const needsConfirm = !auth.confirmed;
      if (!needsEmail && !needsConfirm) { alreadyOk++; continue; }

      if (dryRun) {
        fixed.push({ name, fromAuthEmail: auth.email, toEmail: want, willConfirm: needsConfirm, dryRun: true });
        continue;
      }

      const { error: upErr } = await admin.auth.admin.updateUserById(e.user_id, {
        email: want,
        email_confirm: true,
      });
      if (upErr) {
        failed.push({ name, email: want, fromAuthEmail: auth.email, reason: upErr.message });
        continue;
      }
      // Keep the profile row in the same (already-correct) shape.
      if (needsEmail) await admin.from("employees").update({ email: want }).eq("id", e.id);
      fixed.push({ name, fromAuthEmail: auth.email, toEmail: want });
    }

    return json({
      ok: true,
      dryRun,
      totalLinked: (emps || []).length,
      alreadyOk,
      fixedCount: fixed.length,
      failedCount: failed.length,
      skippedInvalidCount: skippedInvalid.length,
      fixed,
      failed,
      skippedInvalid,
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
