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

interface TierApprover {
  type: "role" | "employee";
  value: string;
}

interface ApprovalModule {
  key: string;
  name: string;
  tiers: TierApprover[];
}

/**
 * Get approver user_ids based on approval_config settings.
 * Falls back to all admin/hr if no config found.
 */
async function getApproverUserIds(notifType: string): Promise<string[]> {
  const moduleKey = typeToModuleKey[notifType];
  if (!moduleKey) {
    // Fallback: all admin/hr
    return getFallbackApproverIds();
  }

  const { data: setting } = await supabase
    .from("company_settings")
    .select("value")
    .eq("key", "approval_config")
    .maybeSingle();

  if (!setting?.value) {
    return getFallbackApproverIds();
  }

  try {
    const modules = setting.value as unknown as ApprovalModule[];
    const mod = Array.isArray(modules) ? modules.find((m) => m.key === moduleKey) : null;
    if (!mod || !mod.tiers || mod.tiers.length === 0) {
      return getFallbackApproverIds();
    }

    const userIds = new Set<string>();

    for (const tier of mod.tiers) {
      if (tier.type === "role") {
        // Get all user_ids with this role
        const { data: roleUsers } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", tier.value);
        if (roleUsers) {
          roleUsers.forEach((r) => userIds.add(r.user_id));
        }
      } else if (tier.type === "employee") {
        // Get user_id from employees table
        const { data: emp } = await supabase
          .from("employees")
          .select("user_id")
          .eq("id", tier.value)
          .maybeSingle();
        if (emp?.user_id) {
          userIds.add(emp.user_id);
        }
      }
    }

    if (userIds.size === 0) {
      return getFallbackApproverIds();
    }

    return Array.from(userIds);
  } catch {
    return getFallbackApproverIds();
  }
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
