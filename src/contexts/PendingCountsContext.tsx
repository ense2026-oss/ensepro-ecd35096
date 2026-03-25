import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";

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
    const { count: notifCount } = await supabase
      .from("app_notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    if (notifCount !== null) setNotificationCount(notifCount);

    // Helper: build scoped query for pending items
    const getScopedCount = async (
      table: "leave_requests" | "time_edit_requests" | "overtime_requests",
      module: string,
    ) => {
      // If user can't even view this module, count = 0
      if (!canAction(roleKey, module, "view")) return 0;

      const scope = getScope(roleKey, module);

      let query = supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      // For "self" scope, only count the user's own pending requests
      if (scope === "self" && employeeId) {
        query = query.eq("employee_id", employeeId);
      }
      // For "department" scope, we'd need to join — but RLS already filters,
      // and the page does client-side dept filtering. For badge accuracy,
      // we rely on RLS + skip showing badge for dept scope to avoid mismatch.
      // "all" scope: no additional filter needed.

      const { count } = await query;
      return count ?? 0;
    };

    const [leaveCount, timeEditCount, otCount] = await Promise.all([
      getScopedCount("leave_requests", "leave"),
      getScopedCount("time_edit_requests", "attendance"),
      getScopedCount("overtime_requests", "ot"),
    ]);

    setLeavePending(leaveCount);
    setAttendancePending(timeEditCount);
    setOvertimePending(otCount);
  }, [user, role, currentUser?.employeeId, permLoading, getScope, canAction]);

  // Debounced refresh to avoid rapid-fire DB calls from realtime
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const debouncedRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => refreshCounts(), 800);
  }, [refreshCounts]);

  useEffect(() => {
    // Defer initial count fetch to not block login render
    const initTimer = setTimeout(() => refreshCounts(), 300);

    if (!user) return () => clearTimeout(initTimer);

    const channel = supabase
      .channel("pending-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_notifications" }, debouncedRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, debouncedRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "time_edit_requests" }, debouncedRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "overtime_requests" }, debouncedRefresh)
      .subscribe();

    return () => {
      clearTimeout(initTimer);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
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
