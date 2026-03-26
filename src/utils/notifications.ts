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
 * Notify configured approvers using SECURITY DEFINER RPC function.
 * This bypasses RLS so employees can send notifications to approvers.
 */
export async function notifyApprovers(params: NotifyParams) {
  const moduleKey = typeToModuleKey[params.type] || params.type;

  await supabase.rpc("notify_approvers" as any, {
    p_module_key: moduleKey,
    p_title: params.title,
    p_description: params.description,
    p_type: params.type,
    p_action_label: params.actionLabel || "ตรวจสอบ",
    p_target_employee: params.targetEmployee || null,
  });
}

/**
 * Notify the employee who submitted a request (approve/reject feedback)
 */
export async function notifyRequester(employeeId: string, params: NotifyParams) {
  await supabase.rpc("notify_requester" as any, {
    p_employee_id: employeeId,
    p_title: params.title,
    p_description: params.description,
    p_type: params.type,
    p_action_label: params.actionLabel || null,
    p_target_employee: params.targetEmployee || null,
  });
}

/**
 * Get the approval config for a module to determine total tiers
 */
export async function getApprovalTiers(moduleKey: string): Promise<number> {
  const { data } = await supabase
    .from("company_settings")
    .select("value")
    .eq("key", "approval_config")
    .maybeSingle();

  if (!data?.value) return 1;

  try {
    const modules = data.value as any[];
    const mod = Array.isArray(modules) ? modules.find((m: any) => m.key === moduleKey) : null;
    return mod?.tiers?.length || 1;
  } catch {
    return 1;
  }
}

/**
 * Notify the next tier approver for a specific tier
 */
export async function notifyTierApprover(moduleKey: string, tierIndex: number, params: NotifyParams) {
  const { data } = await supabase
    .from("company_settings")
    .select("value")
    .eq("key", "approval_config")
    .maybeSingle();

  if (!data?.value) {
    // Fallback to notifying all approvers
    return notifyApprovers(params);
  }

  try {
    const modules = data.value as any[];
    const mod = Array.isArray(modules) ? modules.find((m: any) => m.key === moduleKey) : null;
    if (!mod?.tiers || tierIndex >= mod.tiers.length) {
      return notifyApprovers(params);
    }

    const tier = mod.tiers[tierIndex];
    
    // Use a targeted notify - send only to the specific tier's approver
    if (tier.type === "role") {
      const { data: roleUsers } = await supabase.rpc("get_approver_user_ids", { module_key: moduleKey });
      // For now, notify all configured approvers (the RPC handles it)
      await supabase.rpc("notify_approvers" as any, {
        p_module_key: moduleKey,
        p_title: params.title,
        p_description: params.description,
        p_type: params.type,
        p_action_label: params.actionLabel || "ตรวจสอบ",
        p_target_employee: params.targetEmployee || null,
      });
    } else if (tier.type === "employee") {
      await supabase.rpc("notify_requester" as any, {
        p_employee_id: tier.value,
        p_title: params.title,
        p_description: params.description,
        p_type: params.type,
        p_action_label: params.actionLabel || "ตรวจสอบ",
        p_target_employee: params.targetEmployee || null,
      });
    }
  } catch {
    return notifyApprovers(params);
  }
}
