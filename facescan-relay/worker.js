// FaceScan ADMS Relay — Cloudflare Worker (alternative to Deno Deploy)
// Deploy at https://workers.cloudflare.com (free tier).
// Forwards /iclock/* device traffic to the facescan-adms Edge Function.

const ADMS_FN_URL =
  "https://typckluzuzpxznrlrprq.supabase.co/functions/v1/facescan-adms";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response("FaceScan ADMS relay OK", { status: 200 });
    }

    const match = url.pathname.match(/\/iclock\/([^/]+)/i);
    if (!match) return new Response("Not found", { status: 404 });

    const action = match[1];
    const target = `${ADMS_FN_URL}/${action}${url.search}`;

    const init = {
      method: request.method,
      headers: { "Content-Type": request.headers.get("Content-Type") || "text/plain" },
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = await request.text();
    }

    try {
      const res = await fetch(target, init);
      const body = await res.text();
      return new Response(body, {
        status: res.status,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    } catch (err) {
      return new Response("OK", { status: 200 });
    }
  },
};
