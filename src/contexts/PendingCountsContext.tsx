import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { withRetry } from "@/lib/retry";
import { onTable } from "@/lib/realtimeBus";

interface PendingCountsContextType {
  leavePending: number;
  attendancePending: number;
  overtimePending: number;
  notificationCount: number;
  setLeavePending: (count: number) => void;
  setAttendancePending: (count: number) => void;
  setOvertimePending: (count: number) => void;
  setNotificationCount: (count: number) => void;
  refreshCounts: () => void;
}

const PendingCountsContext = createContext<PendingCountsContextType>({
  leavePending: 0,
  attendancePending: 0,
  overtimePending: 0,
  notificationCount: 0,
  setLeavePending: () => {},
  setAttendancePending: () => {},
  setOvertimePending: () => {},
  setNotificationCount: () => {},
  refreshCounts: () => {},
});

export const usePendingCounts = () => useContext(PendingCountsContext);

export const PendingCountsProvider = ({ children }: { children: ReactNode }) => {
  const [leavePending, setLeavePending] = useState(0);
  const [attendancePending, setAttendancePending] = useState(0);
  const [overtimePending, setOvertimePending] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);

  const { user, role, currentUser } = useAuth();
  const { getScope, canAction, loading: permLoading } = usePermissions();

  const refreshCounts = useCallback(async () => {
    if (!user || permLoading) return;

    const roleKey = role || "employee";
    const employeeId = currentUser?.employeeId;

    // Fetch unread notifications count (always user-scoped)
    const { count: notifCount } = await withRetry(() =>
      supabase
        .from("app_notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false)
    );
    if (notifCount !== null) setNotificationCount(notifCount);

    // Helper: build scoped query for pending items
    const getScopedCount = async (
      table: "leave_requests" | "time_edit_requests" | "overtime_requests",
      module: string,
    ) => {
      // If user can't even view this module, count = 0
      if (!canAction(roleKey, module, "view")) return 0;

      const scope = getScope(roleKey, module);

      if (scope === "self") {
        if (!employeeId) return 0;
        const { count } = await withRetry(() =>
          supabase
            .from(table)
            .select("*", { count: "exact", head: true })
            .eq("status", "pending")
            .eq("employee_id", employeeId)
        );
        return count ?? 0;
      }

      if (scope === "department") {
        const dept = currentUser?.dept;
        if (!dept) return 0;
        // Matches the client-side dept filtering each page does (e.g. Leave.tsx's
        // scopedLeaves) — join to employees so the badge and the page agree.
        const { count } = await withRetry(() =>
          supabase
            .from(table)
            .select("*, employees!inner(dept)", { count: "exact", head: true })
            .eq("status", "pending")
            .eq("employees.dept", dept)
        );
        return count ?? 0;
      }

      // "all" scope: no additional filter needed.
      const { count } = await withRetry(() =>
        supabase
          .from(table)
          .select("*", { count: "exact", head: true })
          .eq("status", "pending")
      );
      return count ?? 0;
    };

    // ผู้อนุมัติรายบุคคล: นับคำขอ pending ของลูกทีมที่อยู่นอกขอบเขตตามสิทธิ์ role เพิ่มด้วย
    // (scope "all" นับครบอยู่แล้ว) — ถ้ายังไม่มีตาราง/ไม่ได้กำหนดใคร จะได้ 0
    const getAssignedApproveeCount = async (
      requestType: "leave" | "time_edit",
      table: "leave_requests" | "time_edit_requests",
      module: string,
    ): Promise<number> => {
      if (!employeeId) return 0;
      const reqScope = getScope(roleKey, module);
      if (reqScope === "all") return 0;
      const { data: links, error: linkErr } = await (supabase as any)
        .from("approval_assignments")
        .select("employee_id")
        .eq("request_type", requestType)
        .eq("approver_employee_id", employeeId);
      if (linkErr || !links?.length) return 0;
      const ids = links.map((r: { employee_id: string }) => r.employee_id);
      let q = supabase
        .from(table)
        .select("*, employees!inner(dept)", { count: "exact", head: true })
        .eq("status", "pending")
        .in("employee_id", ids);
      if (reqScope === "department" && currentUser?.dept) q = q.neq("employees.dept", currentUser.dept);
      const { count } = await q;
      return count ?? 0;
    };

    const [leaveBase, assignedLeave, timeEditBase, assignedTimeEdit, otCount] = await Promise.all([
      getScopedCount("leave_requests", "leave"),
      getAssignedApproveeCount("leave", "leave_requests", "leave"),
      getScopedCount("time_edit_requests", "attendance"),
      getAssignedApproveeCount("time_edit", "time_edit_requests", "attendance"),
      getScopedCount("overtime_requests", "ot"),
    ]);
    const timeEditCount = timeEditBase + assignedTimeEdit;
    const leaveCount = leaveBase + assignedLeave;

    setLeavePending(leaveCount);
    setAttendancePending(timeEditCount);
    setOvertimePending(otCount);
  }, [user, role, currentUser?.employeeId, currentUser?.dept, permLoading, getScope, canAction]);

  // Debounced refresh - notifications are instant, others slightly delayed
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const debouncedRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => refreshCounts(), 300);
  }, [refreshCounts]);

  useEffect(() => {
    // Defer initial count fetch to not block login render
    const initTimer = setTimeout(() => refreshCounts(), 300);

    if (!user) return () => clearTimeout(initTimer);

    const unsubs = [
      onTable("app_notifications", debouncedRefresh),
      onTable("leave_requests", debouncedRefresh),
      onTable("time_edit_requests", debouncedRefresh),
      onTable("overtime_requests", debouncedRefresh),
    ];

    return () => {
      clearTimeout(initTimer);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      unsubs.forEach((u) => u());
    };
  }, [user, refreshCounts, debouncedRefresh]);

  return (
    <PendingCountsContext.Provider value={{
      leavePending, attendancePending, overtimePending, notificationCount,
      setLeavePending, setAttendancePending, setOvertimePending, setNotificationCount,
      refreshCounts,
    }}>
      {children}
    </PendingCountsContext.Provider>
  );
};
