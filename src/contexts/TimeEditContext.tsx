import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { notifyApprovers, getApprovalTiers } from "@/utils/notifications";

export interface TimeEditRequest {
  id: string;
  attendanceId?: string;
  employeeId: string;
  employeeName: string;
  date: string;
  originalCheckIn: string;
  originalCheckOut: string;
  newCheckIn: string;
  newCheckOut: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  currentTier: number;
  approvedTiers: number;
  totalTiers: number;
}

export interface AppNotification {
  id: string;
  title: string;
  description: string;
  type: "leave" | "attendance" | "ot" | "employee" | "system" | "approval";
  time: string;
  read: boolean;
  actionLabel?: string;
  targetEmployee?: string;
}

interface TimeEditContextType {
  editRequests: TimeEditRequest[];
  addEditRequest: (req: Omit<TimeEditRequest, "id" | "status" | "createdAt" | "currentTier" | "approvedTiers" | "totalTiers">) => void;
  updateRequestStatus: (id: string, status: "approved" | "rejected") => void;
  notifications: AppNotification[];
  addNotification: (notif: Omit<AppNotification, "id">) => void;
  markNotifRead: (id: string) => void;
  markAllNotifsRead: () => void;
  deleteNotif: (id: string) => void;
  toggleNotifRead: (id: string) => void;
  loading: boolean;
}

const defaultContextValue: TimeEditContextType = {
  editRequests: [],
  addEditRequest: async () => {},
  updateRequestStatus: async () => {},
  notifications: [],
  addNotification: async () => {},
  markNotifRead: async () => {},
  markAllNotifsRead: async () => {},
  deleteNotif: async () => {},
  toggleNotifRead: async () => {},
  loading: true,
};

const TimeEditContext = createContext<TimeEditContextType>(defaultContextValue);

export const useTimeEditRequests = () => {
  return useContext(TimeEditContext);
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "เมื่อสักครู่";
  if (mins < 60) return `${mins} นาที`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชม.`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} วัน`;
  return `${Math.floor(days / 7)} สัปดาห์`;
}

export const TimeEditProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [editRequests, setEditRequests] = useState<TimeEditRequest[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch time edit requests
  const fetchEditRequests = useCallback(async () => {
    const { data } = await supabase
      .from("time_edit_requests")
      .select("*, employees(first_name, last_name)")
      .order("created_at", { ascending: false });
    if (data) {
      setEditRequests(data.map((r: any) => ({
        id: r.id,
        attendanceId: r.attendance_id,
        employeeId: r.employee_id,
        employeeName: r.employees ? `${r.employees.first_name} ${r.employees.last_name}` : "",
        date: r.date,
        originalCheckIn: r.original_check_in,
        originalCheckOut: r.original_check_out,
        newCheckIn: r.new_check_in,
        newCheckOut: r.new_check_out,
        reason: r.reason,
        status: r.status as "pending" | "approved" | "rejected",
        createdAt: r.created_at,
        currentTier: r.current_tier || 1,
        approvedTiers: r.approved_tiers || 0,
        totalTiers: r.total_tiers || 1,
      })));
    }
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("app_notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) {
      setNotifications(data.map((n: any) => ({
        id: n.id,
        title: n.title,
        description: n.description,
        type: n.type as AppNotification["type"],
        time: timeAgo(n.created_at),
        read: n.is_read,
        actionLabel: n.action_label,
        targetEmployee: n.target_employee,
      })));
    }
  }, [user]);

  // Debounced realtime callbacks
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const debouncedFetchEdits = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchEditRequests(), 800);
  }, [fetchEditRequests]);

  const debouncedFetchNotifs = useCallback(() => {
    // Fetch notifications immediately for real-time feel
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    // Defer initial fetch slightly to not block render
    const initTimer = setTimeout(() => {
      Promise.all([fetchEditRequests(), fetchNotifications()]).finally(() => setLoading(false));
    }, 200);

    const channel = supabase
      .channel("time-edit-context")
      .on("postgres_changes", { event: "*", schema: "public", table: "time_edit_requests" }, debouncedFetchEdits)
      .on("postgres_changes", { event: "*", schema: "public", table: "app_notifications" }, debouncedFetchNotifs)
      .subscribe();

    return () => {
      clearTimeout(initTimer);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [user, fetchEditRequests, fetchNotifications, debouncedFetchEdits, debouncedFetchNotifs]);

  const addEditRequest = useCallback(async (req: Omit<TimeEditRequest, "id" | "status" | "createdAt">) => {
    const totalTiers = await getApprovalTiers("time_edit");
    await supabase.from("time_edit_requests").insert({
      employee_id: req.employeeId,
      attendance_id: req.attendanceId || null,
      date: req.date,
      original_check_in: req.originalCheckIn,
      original_check_out: req.originalCheckOut,
      new_check_in: req.newCheckIn,
      new_check_out: req.newCheckOut,
      reason: req.reason,
      current_tier: 1,
      approved_tiers: 0,
      total_tiers: totalTiers,
    });
    // Notify all configured approvers (any one can approve)
    notifyApprovers({
      type: "attendance",
      title: "คำขอแก้ไขเวลาใหม่",
      description: `${req.employeeName} ขอแก้ไขเวลา ${req.date} → เข้า ${req.newCheckIn} / ออก ${req.newCheckOut}`,
      targetEmployee: req.employeeName,
    });
  }, []);

  const updateRequestStatus = useCallback(async (id: string, status: "approved" | "rejected") => {
    await supabase.from("time_edit_requests").update({ status }).eq("id", id);
    setEditRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }, []);

  const addNotification = useCallback(async (notif: Omit<AppNotification, "id">) => {
    if (!user) return;
    await supabase.from("app_notifications").insert({
      user_id: user.id,
      title: notif.title,
      description: notif.description,
      type: notif.type,
      action_label: notif.actionLabel,
      target_employee: notif.targetEmployee,
    });
  }, [user]);

  const markNotifRead = useCallback(async (id: string) => {
    await supabase.from("app_notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllNotifsRead = useCallback(async () => {
    if (!user) return;
    await supabase.from("app_notifications").update({ is_read: true }).eq("user_id", user.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [user]);

  const deleteNotif = useCallback(async (id: string) => {
    await supabase.from("app_notifications").delete().eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const toggleNotifRead = useCallback(async (id: string) => {
    const notif = notifications.find((n) => n.id === id);
    if (!notif) return;
    const newRead = !notif.read;
    await supabase.from("app_notifications").update({ is_read: newRead }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: newRead } : n)));
  }, [notifications]);

  return (
    <TimeEditContext.Provider value={{ editRequests, addEditRequest, updateRequestStatus, notifications, addNotification, markNotifRead, markAllNotifsRead, deleteNotif, toggleNotifRead, loading }}>
      {children}
    </TimeEditContext.Provider>
  );
};
