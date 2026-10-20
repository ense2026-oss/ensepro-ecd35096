import { useCallback, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePageQuery } from "@/hooks/usePageQuery";
import { fetchAllRows } from "@/lib/fetchAll";

// ผู้อนุมัติรายบุคคล: พนักงาน X → ผู้อนุมัติ Y (ได้หลายคน, คนใดคนหนึ่งอนุมัติก็จบ)
// เริ่มใช้กับ request_type = "leave" (การลา) ตารางรองรับ "ot" / "time_edit" ในอนาคต
// ถ้ายังไม่ได้กำหนดใคร ระบบใช้ผู้อนุมัติเดิมตามตารางสิทธิ์ role (admin/hr ...)

export type ApprovalRequestType = "leave" | "ot" | "time_edit";

export interface ApprovalAssignment {
  id: string;
  request_type: string;
  employee_id: string;
  approver_employee_id: string;
}

// ตารางใหม่ยังไม่ถูกสร้างใน types ที่ generate — ใช้ any เฉพาะจุดนี้
const tbl = () => (supabase as any).from("approval_assignments");

// ก่อนรัน migration ตารางนี้ยังไม่มี → ถือว่าไม่มีการกำหนด (หน้าอื่นทำงานเหมือนเดิม ไม่พัง)
function isMissingTable(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  const msg = err.message || "";
  return err.code === "PGRST205" || err.code === "42P01" || (/approval_assignments/.test(msg) && /not find|does not exist/i.test(msg));
}

const EMPTY_SET: ReadonlySet<string> = new Set<string>();

const MISSING_TABLE_MSG = "ยังไม่ได้สร้างตาราง approval_assignments — กรุณารัน SQL ใน Supabase ก่อน";

export async function fetchApprovalAssignments(requestType: ApprovalRequestType = "leave"): Promise<ApprovalAssignment[]> {
  try {
    return await fetchAllRows<ApprovalAssignment>((from, to) =>
      tbl()
        .select("id, request_type, employee_id, approver_employee_id")
        .eq("request_type", requestType)
        .range(from, to),
    );
  } catch (e: any) {
    if (isMissingTable({ message: e?.message })) return [];
    throw e;
  }
}

/** โหลดรายการผู้อนุมัติทั้งหมดของประเภทคำขอ พร้อม lookup สองทาง */
export function useApprovalAssignments(requestType: ApprovalRequestType = "leave", enabled = true) {
  const [rows, setRows] = useState<ApprovalAssignment[]>([]);
  const { loading, refetch } = usePageQuery(
    ["approval-assignments", requestType],
    () => fetchApprovalAssignments(requestType),
    setRows,
    { enabled },
  );

  const approversByEmployee = useMemo(() => {
    const m = new Map<string, string[]>();
    rows.forEach((r) => {
      const list = m.get(r.employee_id) || [];
      list.push(r.approver_employee_id);
      m.set(r.employee_id, list);
    });
    return m;
  }, [rows]);

  const approveesByApprover = useMemo(() => {
    const m = new Map<string, Set<string>>();
    rows.forEach((r) => {
      const set = m.get(r.approver_employee_id) || new Set<string>();
      set.add(r.employee_id);
      m.set(r.approver_employee_id, set);
    });
    return m;
  }, [rows]);

  const approversOf = useCallback((employeeId: string) => approversByEmployee.get(employeeId) || [], [approversByEmployee]);
  const approveeIdsOf = useCallback(
    (approverEmployeeId: string | null | undefined) =>
      (approverEmployeeId && approveesByApprover.get(approverEmployeeId)) || (EMPTY_SET as Set<string>),
    [approveesByApprover],
  );

  return { assignments: rows, loading, refetch, approversOf, approveeIdsOf };
}

/** ตั้งผู้อนุมัติของพนักงานคนเดียว (แทนที่ชุดเดิมทั้งหมด) */
export async function saveEmployeeApprovers(
  employeeId: string,
  approverIds: string[],
  requestType: ApprovalRequestType = "leave",
): Promise<void> {
  const ids = [...new Set(approverIds.filter((i) => i && i !== employeeId))];
  const { data: existing, error } = await tbl()
    .select("id, approver_employee_id")
    .eq("employee_id", employeeId)
    .eq("request_type", requestType);
  if (error) throw new Error(isMissingTable(error) ? MISSING_TABLE_MSG : error.message);

  const have = new Set<string>((existing || []).map((r: any) => r.approver_employee_id));
  const toDelete = (existing || []).filter((r: any) => !ids.includes(r.approver_employee_id)).map((r: any) => r.id);
  const toAdd = ids.filter((i) => !have.has(i));

  if (toDelete.length) {
    const { error: delErr } = await tbl().delete().in("id", toDelete);
    if (delErr) throw new Error(delErr.message);
  }
  if (toAdd.length) {
    const { error: insErr } = await tbl().insert(
      toAdd.map((approver_employee_id) => ({ request_type: requestType, employee_id: employeeId, approver_employee_id })),
    );
    if (insErr) throw new Error(insErr.message);
  }
}

/**
 * ตั้งผู้อนุมัติให้พนักงานหลายคนพร้อมกัน
 *  - replace: ล้างชุดเดิมของทุกคนที่เลือก แล้วตั้งเป็นชุดนี้
 *  - add: เพิ่มชุดนี้เข้าไปโดยไม่แตะของเดิม
 * ข้ามกรณีที่ผู้อนุมัติเป็นคนเดียวกับพนักงาน (อนุมัติตัวเองไม่ได้)
 */
export async function applyApproversBulk(
  employeeIds: string[],
  approverIds: string[],
  mode: "replace" | "add",
  requestType: ApprovalRequestType = "leave",
): Promise<{ employees: number; links: number }> {
  const emps = [...new Set(employeeIds)];
  const approvers = [...new Set(approverIds)];
  const CHUNK = 150;
  let links = 0;

  if (mode === "replace") {
    for (let i = 0; i < emps.length; i += CHUNK) {
      const { error } = await tbl().delete().eq("request_type", requestType).in("employee_id", emps.slice(i, i + CHUNK));
      if (error) throw new Error(isMissingTable(error) ? MISSING_TABLE_MSG : error.message);
    }
  }

  const rows = emps.flatMap((employee_id) =>
    approvers
      .filter((a) => a !== employee_id)
      .map((approver_employee_id) => ({ request_type: requestType, employee_id, approver_employee_id })),
  );
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await tbl().upsert(rows.slice(i, i + CHUNK), {
      onConflict: "request_type,employee_id,approver_employee_id",
      ignoreDuplicates: true,
    });
    if (error) throw new Error(isMissingTable(error) ? MISSING_TABLE_MSG : error.message);
    links += Math.min(CHUNK, rows.length - i);
  }
  return { employees: emps.length, links };
}

/**
 * แจ้งเตือนผู้อนุมัติของพนักงานคนนั้น (ถ้ายังไม่ได้กำหนด RPC จะ fallback ไปแจ้ง admin/hr ตามเดิมเอง)
 * ถ้ายังไม่ได้รัน SQL (ไม่มีฟังก์ชัน) ให้ใช้ตัวแจ้งเตือนเดิมแทน
 */
export async function notifyAssignedApprovers(
  requestType: ApprovalRequestType,
  employeeId: string,
  moduleKey: string,
  params: { title: string; description: string; type: string; actionLabel?: string; targetEmployee?: string },
  fallback: () => Promise<unknown>,
): Promise<void> {
  const { error } = await (supabase.rpc as any)("notify_assigned_approvers", {
    p_request_type: requestType,
    p_employee_id: employeeId,
    p_module_key: moduleKey,
    p_title: params.title,
    p_description: params.description,
    p_type: params.type,
    p_action_label: params.actionLabel || "ตรวจสอบ",
    p_target_employee: params.targetEmployee || null,
  });
  if (error) await fallback();
}
