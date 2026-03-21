import { NavLink, useLocation } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { usePendingCounts } from "@/contexts/PendingCountsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePermissions } from "@/contexts/PermissionsContext";
import {
  LayoutDashboard,
  Users,
  GitBranch,
  Clock,
  CalendarDays,
  Settings,
  FileText,
  Bell,
  MapPin,
} from "lucide-react";

const allMenuItems = [
  { icon: LayoutDashboard, label: "หน้าหลัก", path: "/dashboard", hideOnMobile: false },
  { icon: Users, label: "พนักงาน", path: "/employees", hideOnMobile: false },
  { icon: GitBranch, label: "องค์กร", path: "/organization", hideOnMobile: false },
  { icon: Clock, label: "เวลา", path: "/attendance", hideOnMobile: false },
  { icon: CalendarDays, label: "ลางาน", path: "/leave", hideOnMobile: false },
  { icon: Clock, label: "โอที", path: "/overtime", hideOnMobile: false },
  { icon: CalendarDays, label: "จัดกะ", path: "/shift-management", hideOnMobile: false },
  { icon: FileText, label: "รายงาน", path: "/reports", hideOnMobile: false },
  { icon: Settings, label: "ตั้งค่า", path: "/settings", hideOnMobile: true },
];

const pathToModuleMap: Record<string, string> = {
  "/attendance": "attendance",
  "/leave": "leave",
  "/overtime": "overtime",
  "/shift-management": "shifts",
  "/contracts": "contracts",
  "/payroll": "payroll",
  "/reports": "reports",
  "/organization": "organization",
  "/check-in": "check-in",
};

const MobileFooterNav = () => {
  const location = useLocation();
  const { leavePending, attendancePending, overtimePending } = usePendingCounts();
  const { currentUser, role } = useAuth();
  const isMobile = useIsMobile();
  const { canAccessRoute, isSelfOnly } = usePermissions();

  const getModuleSettings = useCallback(() => {
    try {
      const saved = localStorage.getItem('module-settings');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  }, []);

  const [moduleSettings, setModuleSettings] = useState<Record<string, boolean>>(getModuleSettings);

  useEffect(() => {
    const handler = () => setModuleSettings(getModuleSettings());
    window.addEventListener('module-settings-changed', handler);
    return () => window.removeEventListener('module-settings-changed', handler);
  }, [getModuleSettings]);

  const menuItems = allMenuItems.filter((item) => {
    if (!canAccessRoute(role, item.path)) return false;
    if (item.hideOnMobile && isMobile) return false;
    const moduleId = pathToModuleMap[item.path];
    if (moduleId && moduleSettings[moduleId] === false) return false;
    return true;
  });

  const dynamicBadges: Record<string, number> = {
    "/attendance": attendancePending,
    "/leave": leavePending,
    "/overtime": overtimePending,
  };

  const isActive = (path: string) => location.pathname === path || (path === "/employees" && location.pathname.startsWith("/employees/"));

  const isCheckInEnabled = moduleSettings['check-in'] !== false && canAccess(role, "/check-in");

  const midIndex = Math.floor(menuItems.length / 2);
  const leftItems = menuItems.slice(0, midIndex);
  const rightItems = menuItems.slice(midIndex);

  const renderItem = (item: typeof menuItems[0]) => {
    const selfOnly = isSelfOnly(role, item.path);
    const linkPath = selfOnly && currentUser
      ? `/employees/${currentUser.employeeId || currentUser.id}`
      : item.path;
    const active = isActive(item.path);
    const badgeCount = dynamicBadges[item.path] ?? 0;
    return (
      <NavLink
        key={item.path}
        to={linkPath}
        className="flex flex-col items-center justify-center py-1.5 relative flex-1 min-w-0"
      >
        <div className="relative">
          <item.icon
            className="w-[22px] h-[22px] transition-colors"
            style={{
              color: active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
            }}
          />
          {badgeCount > 0 && (
            <span
              className="absolute -top-1 -right-1.5 w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center"
              style={{ background: "#FF870F", color: "#fff" }}
            >
              {badgeCount}
            </span>
          )}
        </div>
        <span
          className="text-[9px] mt-0.5 font-medium leading-tight truncate max-w-[48px] text-center"
          style={{
            color: active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
          }}
        >
          {item.label}
        </span>
        {active && (
          <div
            className="absolute bottom-0 w-6 h-0.5 rounded-full"
            style={{ background: "hsl(var(--primary))" }}
          />
        )}
      </NavLink>
    );
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
      <div
        className="relative border-t"
        style={{
          background: "hsl(var(--card))",
          borderColor: "hsl(var(--border))",
          boxShadow: "0 -4px 20px hsl(0 0% 0% / 0.08)",
        }}
      >
        {isCheckInEnabled && (
          <NavLink
            to="/check-in"
            className="absolute left-1/2 -translate-x-1/2 -top-5 z-10"
          >
            <div className="relative flex items-center justify-center">
              <div
                className="absolute w-16 h-16 rounded-full animate-[wave-ping_1.8s_ease-out_infinite]"
                style={{
                  background: isActive("/check-in")
                    ? "hsl(var(--primary) / 0.2)"
                    : "hsl(90 100% 40% / 0.2)",
                }}
              />
              <div
                className="absolute w-14 h-14 rounded-full animate-[wave-ping_1.8s_ease-out_0.5s_infinite]"
                style={{
                  background: isActive("/check-in")
                    ? "hsl(var(--primary) / 0.15)"
                    : "hsl(90 100% 40% / 0.15)",
                }}
              />
              <div
                className="w-12 h-12 rounded-full flex flex-col items-center justify-center transition-all duration-200 relative z-10"
                style={{
                  background: isActive("/check-in")
                    ? "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))"
                    : "linear-gradient(135deg, hsl(90 100% 40%), hsl(90 100% 30%))",
                  boxShadow: "0 3px 12px hsl(var(--primary) / 0.35)",
                  border: "3px solid hsl(var(--card))",
                }}
              >
                <MapPin className="w-4 h-4 text-white" />
                <span className="text-[7px] font-bold text-white leading-tight mt-0.5">ลงเวลา</span>
              </div>
            </div>
          </NavLink>
        )}

        <div className="flex items-end pt-2 pb-[env(safe-area-inset-bottom,8px)]">
          {isCheckInEnabled ? (
            <>
              <div className="flex flex-1 justify-around">
                {leftItems.map(renderItem)}
              </div>
              <div className="w-[58px] flex-shrink-0" />
              <div className="flex flex-1 justify-around">
                {rightItems.map(renderItem)}
              </div>
            </>
          ) : (
            <div className="flex flex-1 justify-around">
              {menuItems.map(renderItem)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileFooterNav;
