import { useState, useEffect } from "react";
import { usePendingCounts } from "@/contexts/PendingCountsContext";
import { useTimeEditRequests, type AppNotification } from "@/contexts/TimeEditContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import {
  Bell,
  CheckCheck,
  Clock,
  CalendarDays,
  Users,
  FileText,
  AlertTriangle,
  Settings,
  Trash2,
  MailOpen,
  Mail,
  ArrowUpRight,
} from "lucide-react";

type NotifType = AppNotification["type"];
type NotifFilter = "all" | "unread" | "read" | NotifType;

const typeConfig: Record<NotifType, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  leave: { label: "ลางาน", icon: CalendarDays, color: "#FF870F", bg: "hsl(31 100% 93%)" },
  attendance: { label: "เวลา", icon: Clock, color: "hsl(90 100% 35%)", bg: "hsl(90 100% 92%)" },
  ot: { label: "OT", icon: AlertTriangle, color: "hsl(60 100% 35%)", bg: "hsl(60 100% 90%)" },
  employee: { label: "พนักงาน", icon: Users, color: "hsl(220 90% 50%)", bg: "hsl(220 90% 93%)" },
  system: { label: "ระบบ", icon: Settings, color: "hsl(0 0% 45%)", bg: "hsl(0 0% 93%)" },
  approval: { label: "อนุมัติ", icon: FileText, color: "hsl(90 100% 35%)", bg: "hsl(90 100% 92%)" },
};

const allFilterOptions: { key: NotifFilter; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "unread", label: "ยังไม่อ่าน" },
  { key: "read", label: "อ่านแล้ว" },
  { key: "leave", label: "ลางาน" },
  { key: "attendance", label: "เวลา" },
  { key: "ot", label: "OT" },
  { key: "employee", label: "พนักงาน" },
  { key: "approval", label: "อนุมัติ" },
  { key: "system", label: "ระบบ" },
];

// Types hidden from regular employees
const adminOnlyTypes: NotifType[] = ["employee", "ot", "system"];
const adminOnlyFilters: NotifFilter[] = ["employee", "ot", "system"];

const Notifications = () => {
  const { notifications, markNotifRead, markAllNotifsRead, deleteNotif, toggleNotifRead } = useTimeEditRequests();
  const { setNotificationCount } = usePendingCounts();
  const { currentUser, role } = useAuth();
  const { canAction } = usePermissions();
  const hasApprovalAccess = canAction(role, 'leave', 'approve') || canAction(role, 'ot', 'approve');

  const [activeFilter, setActiveFilter] = useState<NotifFilter>("all");

  // Filter notifications by role and ownership
  const currentUserFullName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "";
  const roleNotifications = hasAdminAccess
    ? notifications
    : notifications.filter((n) => {
        // Hide admin-only types
        if (adminOnlyTypes.includes(n.type)) return false;
        // Show only notifications belonging to current user
        if (n.targetEmployee) return n.targetEmployee === currentUserFullName;
        // Hide system and untagged notifications from regular employees
        return false;
      });

  const unreadCount = roleNotifications.filter((n) => !n.read).length;
  const totalCount = roleNotifications.length;

  useEffect(() => {
    setNotificationCount(unreadCount);
  }, [unreadCount, setNotificationCount]);

  const filtered = roleNotifications.filter((n) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "unread") return !n.read;
    if (activeFilter === "read") return n.read;
    return n.type === activeFilter;
  });

  // Filter options by role
  const filterOptions = hasAdminAccess
    ? allFilterOptions
    : allFilterOptions.filter((f) => !adminOnlyFilters.includes(f.key));

  // Stat cards – hide "รออนุมัติ" for employees
  const statCards = [
    { title: "ทั้งหมด", value: totalCount, color: "#FF870F", bg: "hsl(31 100% 93%)", icon: Bell },
    { title: "ยังไม่อ่าน", value: unreadCount, color: "hsl(0 84% 55%)", bg: "hsl(0 84% 95%)", icon: Mail },
    ...(hasAdminAccess
      ? [{ title: "รออนุมัติ", value: roleNotifications.filter((n) => n.actionLabel && !n.read).length, color: "hsl(220 90% 50%)", bg: "hsl(220 90% 93%)", icon: FileText }]
      : []),
    { title: "อ่านแล้ว", value: totalCount - unreadCount, color: "hsl(90 100% 35%)", bg: "hsl(90 100% 92%)", icon: MailOpen },
  ];

  // Type breakdown – filter by role
  const visibleTypes = hasAdminAccess
    ? Object.entries(typeConfig)
    : Object.entries(typeConfig).filter(([key]) => !adminOnlyTypes.includes(key as NotifType));

  return (
    <div className="space-y-6 w-full overflow-hidden">
      {/* Stat cards */}
      <div className={`grid grid-cols-2 ${hasAdminAccess ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-4`}>
        {statCards.map((s) => (
          <div key={s.title} className="card-base p-5 animate-fade-in">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-sm text-muted-foreground font-medium">{s.title}</p>
                <p className="text-3xl font-bold font-display mt-1" style={{ color: s.color }}>{s.value}</p>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: s.bg }}>
                <s.icon className="w-6 h-6" style={{ color: s.color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className={`grid grid-cols-1 ${hasAdminAccess ? "lg:grid-cols-3" : ""} gap-6`}>
        <div className={`${hasAdminAccess ? "lg:col-span-2" : ""} card-base p-3 sm:p-5 overflow-hidden`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold font-display">รายการแจ้งเตือน</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllNotifsRead} className="text-xs font-medium flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
                  <CheckCheck className="w-3.5 h-3.5" />
                  อ่านทั้งหมด
                </button>
              )}
              <button className="text-xs font-medium" style={{ color: "#FF870F" }}>
                ดูทั้งหมด <ArrowUpRight className="w-3 h-3 inline ml-0.5" />
              </button>
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
            {filterOptions.map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`text-xs font-medium px-2.5 py-1 rounded-lg border whitespace-nowrap transition-colors ${
                  activeFilter === f.key ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                }`}
              >
                {f.label}
                {f.key === "unread" && unreadCount > 0 && (
                  <span className="ml-1 px-1 rounded text-[10px] font-bold" style={{ background: "#FF870F", color: "#fff" }}>
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="space-y-1">
            {filtered.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">ไม่มีการแจ้งเตือน</p>
              </div>
            ) : (
              filtered.map((n) => {
                const cfg = typeConfig[n.type];
                return (
                  <div
                    key={n.id}
                    className={`group flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2.5 rounded-xl transition-colors hover:bg-muted/50 overflow-hidden ${!n.read ? "bg-muted/30" : ""}`}
                  >
                    <div className="w-2 flex-shrink-0">
                      {!n.read && <div className="w-2 h-2 rounded-full" style={{ background: "#FF870F" }} />}
                    </div>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: cfg.bg }}>
                      <cfg.icon className="w-4 h-4" style={{ color: cfg.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm truncate ${!n.read ? "font-semibold" : "font-medium"}`}>{n.title}</p>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: cfg.bg, color: cfg.color }}>
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{n.description}</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap flex-shrink-0">{n.time}</span>
                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {hasAdminAccess && n.actionLabel && !n.read && (
                        <button onClick={() => markNotifRead(n.id)} className="text-[11px] font-semibold px-2 py-1 rounded-lg" style={{ background: "#FF870F", color: "#fff" }}>
                          {n.actionLabel}
                        </button>
                      )}
                      <button onClick={() => toggleNotifRead(n.id)} className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground" title={n.read ? "ทำเครื่องหมายยังไม่อ่าน" : "อ่านแล้ว"}>
                        {n.read ? <Mail className="w-3.5 h-3.5" /> : <MailOpen className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => deleteNotif(n.id)} className="p-1 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right sidebar – admin only */}
        {hasAdminAccess && (
          <div className="space-y-6">
            <div className="card-base p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold font-display">ตามประเภท</h3>
                <button className="text-xs font-medium" style={{ color: "#FF870F" }}>ดูทั้งหมด</button>
              </div>
              <div className="space-y-3">
                {visibleTypes.map(([key, cfg]) => {
                  const count = roleNotifications.filter((n) => n.type === key).length;
                  const unread = roleNotifications.filter((n) => n.type === key && !n.read).length;
                  const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <cfg.icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                          <span className="text-xs font-medium">{cfg.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{count}</span>
                          {unread > 0 && (
                            <span className="text-[10px] font-bold px-1 rounded" style={{ background: "#FF870F", color: "#fff" }}>
                              {unread}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: cfg.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card-base p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold font-display">สรุปวันนี้</h3>
              </div>
              <div className="space-y-3">
                {[
                  { label: "คำขอลารออนุมัติ", value: "2", color: "#FF870F" },
                  { label: "คำขอแก้ไขเวลา", value: String(roleNotifications.filter((n) => n.type === "attendance" && !n.read).length), color: "hsl(220 90% 50%)" },
                  { label: "พนักงานใหม่รอยืนยัน", value: "2", color: "hsl(90 100% 35%)" },
                  { label: "OT รออนุมัติ", value: "0", color: "hsl(0 0% 45%)" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/50 transition-colors">
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                    <span className="text-sm font-bold" style={{ color: item.color }}>{item.value}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 rounded-xl" style={{ background: "hsl(var(--muted))" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold">แจ้งเตือนที่ต้องดำเนินการ</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">รายการที่ต้องตอบกลับ</p>
                  </div>
                  <p className="text-2xl font-bold font-display" style={{ color: "#FF870F" }}>
                    {roleNotifications.filter((n) => n.actionLabel && !n.read).length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
