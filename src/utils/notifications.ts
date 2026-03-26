import { supabase } from "@/integrations/supabase/client";

interface NotifyParams {
  type: "leave" | "attendance" | "ot" | "approval";
  title: string;
  description: string;
  targetEmployee?: string;
  actionLabel?: string;
}

// Map notification type to approval_config module key
const typeToModuleKey: Record<string, string> = {
  leave: "leave",
  ot: "ot",
  attendance: "time_edit",
};

/**
 * Get approver user_ids via SECURITY DEFINER RPC function.
 * This bypasses RLS so even employees can resolve approver user_ids.
 */
async function getApproverUserIds(notifType: string): Promise<string[]> {
  const moduleKey = typeToModuleKey[notifType];
  if (!moduleKey) {
    return getFallbackApproverIds();
  }

  const { data, error } = await supabase.rpc("get_approver_user_ids", {
    module_key: moduleKey,
  });

  if (error || !data || data.length === 0) {
    return getFallbackApproverIds();
  }

  // Deduplicate
  const unique = [...new Set(data.map((r: any) => r.user_id as string))];
  return unique;
}

async function getFallbackApproverIds(): Promise<string[]> {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("role", ["admin", "hr"]);
  return roles?.map((r) => r.user_id) || [];
}

/**
 * Notify configured approvers based on approval_config settings
 */
export async function notifyApprovers(params: NotifyParams) {
  const approverIds = await getApproverUserIds(params.type);
  if (approverIds.length === 0) return;

  const notifications = approverIds.map((userId) => ({
    user_id: userId,
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
