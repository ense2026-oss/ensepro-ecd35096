import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// One-time migration: move employee avatars stored inline as base64 in
// employees.photo_url into the private "employee-photos" Storage bucket, and
// replace the column value with the short Storage path. Admin-only, idempotent
// (only rows whose photo_url still starts with "data:" are touched), and safe
// to re-run. Always call once with { dryRun: true } first.
//
// Note: the bytes are uploaded in their original format (the client already
// compressed avatars to ~400px). New uploads from the app are WebP; this job
// just gets the existing base64 out of the table.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const BUCKET = "employee-photos";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; mime: string; ext: string } | null {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  const header = dataUrl.slice(0, comma);
  const b64 = dataUrl.slice(comma + 1);
  const mime = (/data:([^;]+)/.exec(header)?.[1] || "application/octet-stream").toLowerCase();
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, mime, ext: EXT_BY_MIME[mime] || "jpg" };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: ures, error: uerr } = await caller.auth.getUser();
    if (uerr || !ures?.user) return json({ error: "Invalid session" }, 401);

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: roles } = await admin.from("user_roles").select("role_name").eq("user_id", ures.user.id);
    if (!(roles || []).some((r: { role_name: string }) => r.role_name === "admin")) {
      return json({ error: "Forbidden: admin role required" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dryRun === true;

    // Pull only rows whose avatar is still inline base64.
    const { data: rows, error: selErr } = await admin
      .from("employees")
      .select("id, first_name, last_name, photo_url")
      .like("photo_url", "data:%")
      .limit(5000);
    if (selErr) return json({ error: selErr.message }, 400);

    const targets = rows || [];
    if (dryRun) {
      let totalBytes = 0;
      for (const r of targets) totalBytes += (r.photo_url as string).length;
      return json({
        ok: true,
        dryRun: true,
        willMigrate: targets.length,
        approxBase64MB: +(totalBytes / 1048576).toFixed(2),
        sample: targets.slice(0, 5).map((r: any) => ({ id: r.id, name: `${r.first_name} ${r.last_name}`.trim() })),
        note: "ยังไม่มีการเขียนข้อมูล — เรียกซ้ำด้วย dryRun:false เพื่อทำจริง",
      });
    }

    const report = { total: targets.length, migrated: 0, skipped: 0, failed: [] as unknown[] };
    for (const r of targets as any[]) {
      const id = r.id as string;
      const dataUrl = r.photo_url as string;
      try {
        const decoded = decodeDataUrl(dataUrl);
        if (!decoded) { report.skipped++; report.failed.push({ id, reason: "decode failed" }); continue; }
        const path = `${id}/avatar-${Date.now()}.${decoded.ext}`;
        const { error: upErr } = await admin.storage.from(BUCKET).upload(path, decoded.bytes, {
          contentType: decoded.mime,
          upsert: true,
          cacheControl: "3600",
        });
        if (upErr) { report.failed.push({ id, step: "upload", reason: upErr.message }); continue; }
        const { error: updErr } = await admin.from("employees").update({ photo_url: path }).eq("id", id);
        if (updErr) {
          // roll back the orphan object so a re-run starts clean
          await admin.storage.from(BUCKET).remove([path]).catch(() => {});
          report.failed.push({ id, step: "update", reason: updErr.message });
          continue;
        }
        report.migrated++;
      } catch (err) {
        report.failed.push({ id, reason: (err as Error).message });
      }
    }

    console.log(`[migrate-photos] admin ${ures.user.email}: migrated ${report.migrated}/${report.total}, failed ${report.failed.length}`);
    return json({ ok: true, dryRun: false, ...report });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
