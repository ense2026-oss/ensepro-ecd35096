import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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

  const { user } = useAuth();

  const refreshCounts = useCallback(async () => {
    if (!user) return;

    // Fetch unread notifications count
    const { count: notifCount } = await supabase
      .from("app_notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    if (notifCount !== null) setNotificationCount(notifCount);

    // Pending leave requests
    const { count: leaveCount } = await supabase
      .from("leave_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    if (leaveCount !== null) setLeavePending(leaveCount);

    // Pending time edit requests
    const { count: timeEditCount } = await supabase
      .from("time_edit_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    if (timeEditCount !== null) setAttendancePending(timeEditCount);

    // Pending OT requests
    const { count: otCount } = await supabase
      .from("overtime_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    if (otCount !== null) setOvertimePending(otCount);
  }, [user]);

  useEffect(() => {
    refreshCounts();

    if (!user) return;

    // Realtime for notifications
    const channel = supabase
      .channel("pending-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_notifications" }, () => refreshCounts())
      .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, () => refreshCounts())
      .on("postgres_changes", { event: "*", schema: "public", table: "time_edit_requests" }, () => refreshCounts())
      .on("postgres_changes", { event: "*", schema: "public", table: "overtime_requests" }, () => refreshCounts())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, refreshCounts]);

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
