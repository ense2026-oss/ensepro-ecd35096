import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
  addEditRequest: (req: Omit<TimeEditRequest, "id" | "status" | "createdAt">) => void;
  updateRequestStatus: (id: string, status: "approved" | "rejected") => void;
  notifications: AppNotification[];
  addNotification: (notif: Omit<AppNotification, "id">) => void;
  markNotifRead: (id: string) => void;
  markAllNotifsRead: () => void;
  deleteNotif: (id: string) => void;
  toggleNotifRead: (id: string) => void;
  loading: boolean;
}

const TimeEditContext = createContext<TimeEditContextType | null>(null);

export const useTimeEditRequests = () => {
  const ctx = useContext(TimeEditContext);
  if (!ctx) throw new Error("useTimeEditRequests must be used within TimeEditProvider");
  return ctx;
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

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([fetchEditRequests(), fetchNotifications()]).finally(() => setLoading(false));

    // Realtime subscriptions
    const channel = supabase
      .channel("time-edit-context")
      .on("postgres_changes", { event: "*", schema: "public", table: "time_edit_requests" }, () => fetchEditRequests())
      .on("postgres_changes", { event: "*", schema: "public", table: "app_notifications" }, () => fetchNotifications())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchEditRequests, fetchNotifications]);

  const addEditRequest = useCallback(async (req: Omit<TimeEditRequest, "id" | "status" | "createdAt">) => {
    await supabase.from("time_edit_requests").insert({
      employee_id: req.employeeId,
      attendance_id: req.attendanceId || null,
      date: req.date,
      original_check_in: req.originalCheckIn,
      original_check_out: req.originalCheckOut,
      new_check_in: req.newCheckIn,
      new_check_out: req.newCheckOut,
      reason: req.reason,
    });
    // Auto-add notification for admins (simplified: notify self for now)
    if (user) {
      await supabase.from("app_notifications").insert({
        user_id: user.id,
        title: "คำขอแก้ไขเวลา",
        description: `${req.employeeName} ขอแก้ไขเวลา ${req.date} → เข้า ${req.newCheckIn} / ออก ${req.newCheckOut}`,
        type: "attendance",
        action_label: "ตรวจสอบ",
        target_employee: req.employeeName,
      });
    }
  }, [user]);

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
