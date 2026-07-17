import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_my_attendance",
  title: "List my attendance records",
  description: "List attendance records (check-in/out) visible to the signed-in user. Newest first.",
  inputSchema: {
    limit: z.number().int().min(1).max(200).optional().describe("Maximum rows to return (default 30)."),
    from: z.string().optional().describe("Optional ISO date (YYYY-MM-DD) lower bound."),
    to: z.string().optional().describe("Optional ISO date (YYYY-MM-DD) upper bound."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, from, to }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let q = supabase.from("attendance_records").select("*").order("date", { ascending: false }).limit(limit ?? 30);
    if (from) q = q.gte("date", from);
    if (to) q = q.lte("date", to);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { count: data?.length ?? 0, rows: data ?? [] },
    };
  },
});
