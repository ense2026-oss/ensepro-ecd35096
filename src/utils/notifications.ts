import { supabase } from "@/integrations/supabase/client";

interface NotifyParams {
  type: "leave" | "attendance" | "ot" | "approval";
  title: string;
  description: string;
  targetEmployee?: string;
  actionLabel?: string;
}

/**
 * Notify all admin/hr users about a new request
 */
export async function notifyApprovers(params: NotifyParams) {
  // Get all admin and hr user_ids
  const { data: roles } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("role", ["admin", "hr"]);

  if (!roles || roles.length === 0) return;

  const notifications = roles.map((r) => ({
    user_id: r.user_id,
    title: params.title,
    description: params.description,
    type: params.type,
    action_label: params.actionLabel || "ตรวจสอบ",
    target_employee: params.targetEmployee || null,
  }));

  await supabase.from("app_notifications").insert(notifications);
}

/**
 * Notify the employee who submitted a request (approve/reject feedback)
 */
export async function notifyRequester(employeeId: string, params: NotifyParams) {
  // Look up user_id from employees table
  const { data: emp } = await supabase
    .from("employees")
    .select("user_id")
    .eq("id", employeeId)
    .maybeSingle();

  if (!emp?.user_id) return;

  await supabase.from("app_notifications").insert({
    user_id: emp.user_id,
    title: params.title,
    description: params.description,
    type: params.type,
    action_label: params.actionLabel || null,
    target_employee: params.targetEmployee || null,
  });
}
