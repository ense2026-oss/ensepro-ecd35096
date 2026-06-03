// FaceScan ADMS Relay — Deno Deploy
// =================================================================
// Purpose: HIP/ZKTeco face scanners push attendance to a FIXED path
// (/iclock/cdata, /iclock/getrequest, /iclock/devicecmd). Supabase Edge
// Functions live under /functions/v1/<name>, so the device cannot hit them
// directly. This tiny relay listens on /iclock/* and forwards every request
// to the `facescan-adms` Edge Function. It stores nothing.
//
// DEPLOY (free):
//   1. Go to https://dash.deno.com  ->  New Project  ->  "Deploy from playground"
//   2. Paste this whole file, click Save & Deploy.
//   3. You get a public URL like https://YOUR-NAME.deno.dev
//   4. On the scanner set Cloud/ADMS Server Address = YOUR-NAME.deno.dev,
//      Port = 443, HTTPS = ON.  Path stays /iclock (firmware default).
// =================================================================

// The facescan-adms Edge Function base URL (no trailing slash).
const ADMS_FN_URL =
  "https://typckluzuzpxznrlrprq.supabase.co/functions/v1/facescan-adms";

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // Health check
  if (url.pathname === "/" || url.pathname === "/health") {
    return new Response("FaceScan ADMS relay OK", { status: 200 });
  }

  // Only relay the device's /iclock/* traffic.
  const match = url.pathname.match(/\/iclock\/([^/]+)/i);
  if (!match) {
    return new Response("Not found", { status: 404 });
  }

  const action = match[1]; // cdata | getrequest | devicecmd | ping
  const target = `${ADMS_FN_URL}/${action}${url.search}`;

  // Forward method, body and a couple of useful headers.
  const init: RequestInit = {
    method: req.method,
    headers: { "Content-Type": req.headers.get("Content-Type") || "text/plain" },
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  try {
    const res = await fetch(target, init);
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("relay error", err);
    // ADMS devices retry on errors; reply OK to avoid tight error loops.
    return new Response("OK", { status: 200 });
  }
});
