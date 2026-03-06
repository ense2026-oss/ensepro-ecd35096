import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { usePendingCounts } from "@/contexts/PendingCountsContext";
import { useBranding } from "@/contexts/BrandingContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Users,
  GitBranch,
  Clock,
  CalendarDays,
  Settings,
  ChevronLeft,
  ChevronRight,
  Building2,
  FileText,
  Bell,
  LogOut,
  Shield,
  MapPin,
  Banknote,
  FileSignature,
} from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}

const allNavItems = [
  {
    section: "หลัก",
    items: [
      { icon: LayoutDashboard, label: "หน้าหลัก", path: "/dashboard", adminOnly: false },
      { icon: Users, label: "ข้อมูลพนักงาน", path: "/employees", adminOnly: false, employeeSelfOnly: true },
      { icon: GitBranch, label: "โครงสร้างองค์กร", path: "/organization", adminOnly: true },
    ],
  },
  {
    section: "การจัดการ",
    items: [
      { icon: Clock, label: "บันทึกเวลา", path: "/attendance", adminOnly: true },
      { icon: CalendarDays, label: "ระบบลางาน", path: "/leave", adminOnly: false },
      { icon: Clock, label: "ระบบโอที", path: "/overtime", adminOnly: false },
      { icon: MapPin, label: "ลงเวลาเข้า-ออกงาน", path: "/check-in", adminOnly: false },
      { icon: CalendarDays, label: "จัดการกะทำงาน", path: "/shift-management", adminOnly: true },
      { icon: Banknote, label: "จัดการเงินเดือน", path: "/payroll", adminOnly: true },
    ],
  },
  {
    section: "ระบบ",
    items: [
      { icon: FileText, label: "รายงาน", path: "/reports", adminOnly: true },
      { icon: Bell, label: "การแจ้งเตือน", path: "/notifications", adminOnly: false },
      { icon: Settings, label: "ตั้งค่า", path: "/settings", adminOnly: true },
    ],
  },
];

const Sidebar = ({ collapsed, onToggle, onNavigate }: SidebarProps) => {
  const location = useLocation();
  const { leavePending, attendancePending, overtimePending, notificationCount } = usePendingCounts();
  const { programName, programSubtitle, logoUrl, logoOnlyUrl, displayMode } = useBranding();
  const activeLogo = displayMode === "logo-only" ? logoOnlyUrl : logoUrl;
  const { currentUser, hasAdminAccess, logout } = useAuth();

  // Filter nav items based on role
  const navItems = allNavItems.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.adminOnly || hasAdminAccess),
  })).filter((section) => section.items.length > 0);

  const userInitials = currentUser
    ? currentUser.avatar
    : "AD";
  const userName = currentUser
    ? `${currentUser.firstName} ${currentUser.lastName}`
    : "Admin User";
  const userRole = currentUser?.role || "Administrator";
  const roleLabel: Record<string, string> = {
    Admin: "Administrator",
    Manager: "Manager",
    HR: "HR",
    Employee: "พนักงาน",
    Accountant: "บัญชี",
  };

  // Dynamic badges based on context
  const dynamicBadges: Record<string, number> = {
    "/attendance": attendancePending,
    "/leave": leavePending,
    "/overtime": overtimePending,
    "/notifications": notificationCount,
  };

  return (
    <aside
      className="flex flex-col h-full transition-all duration-300 ease-in-out relative"
      style={{
        width: collapsed ? "72px" : "260px",
        background: "hsl(var(--sidebar-background))",
        borderRight: "1px solid hsl(var(--sidebar-border))",
        boxShadow: "var(--shadow-sidebar)",
      }}
    >
      {/* Logo */}
      <div
        className={`flex items-center border-b transition-all duration-300 ${
          !collapsed && displayMode === "logo-only" ? "h-24 justify-center px-3 py-3" : "h-16 px-4"
        }`}
        style={{ borderColor: "hsl(var(--sidebar-border))" }}
      >
        {activeLogo ? (
          <img
            src={activeLogo}
            alt="Logo"
            className={`flex-shrink-0 transition-all duration-300 ${
              !collapsed && displayMode === "logo-only" ? "w-full max-h-16 object-contain rounded-lg" : "w-9 h-9 object-cover rounded-none"
            }`}
          />
        ) : (
          <div
            className={`flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
              !collapsed && displayMode === "logo-only" ? "w-16 h-16 rounded-lg" : "w-9 h-9 rounded-none"
            }`}
            style={{ background: "linear-gradient(135deg, #FF870F, #FFFF0F)" }}
          >
            <Building2 className={`text-black ${!collapsed && displayMode === "logo-only" ? "w-10 h-10" : "w-5 h-5"}`} />
          </div>
        )}
        {!collapsed && displayMode === "logo-and-name" && (
          <div className="ml-3 overflow-hidden">
            <p className="text-white font-bold text-sm font-display leading-tight">{programName}</p>
            <p className="text-xs leading-tight" style={{ color: "rgba(255,255,255,0.4)" }}>
              {programSubtitle}
            </p>
          </div>
        )}
      </div>

      {/* User profile mini */}
      {!collapsed && (
        <div
          className="mx-3 mt-4 p-3 rounded-xl"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #FF870F, #FF9A3C)", color: "#fff" }}
            >
              {userInitials}
            </div>
            <div className="overflow-hidden">
              <p className="text-white text-sm font-semibold leading-tight truncate">{userName}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Shield className="w-3 h-3" style={{ color: "#FF870F" }} />
                <span className="text-xs" style={{ color: "#FF870F" }}>
                  {roleLabel[userRole] || userRole}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {collapsed && (
        <div className="flex justify-center mt-4">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
            style={{ background: currentUser?.avatarColor || "linear-gradient(135deg, #FF870F, #FF9A3C)", color: currentUser?.avatarTextColor || "#fff" }}
          >
            {userInitials}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto custom-scroll px-3 py-4 space-y-6">
        {navItems.map((section) => (
          <div key={section.section}>
            {!collapsed && (
              <p
                className="text-xs font-semibold uppercase tracking-wider mb-2 px-3"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                {section.section}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const linkPath = (item as any).employeeSelfOnly && !hasAdminAccess && currentUser
                  ? `/employees/${currentUser.id}`
                  : item.path;
                const isActive = location.pathname === item.path || location.pathname === linkPath || (item.path === "/employees" && location.pathname.startsWith("/employees/"));
                const badgeCount: number = dynamicBadges[item.path] ?? 0;
                return (
                  <NavLink
                    key={item.path}
                    to={linkPath}
                    className={`sidebar-item ${isActive ? "active" : ""} ${collapsed ? "justify-center" : ""}`}
                    title={collapsed ? item.label : undefined}
                    onClick={onNavigate}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1">{item.label}</span>
                        {badgeCount > 0 && (
                          <span
                            className="text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                            style={{ background: "#FF870F", color: "#fff" }}
                          >
                            {badgeCount}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
        <NavLink
          to="/login"
          onClick={() => logout()}
          className={`sidebar-item ${collapsed ? "justify-center" : ""}`}
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>ออกจากระบบ</span>}
        </NavLink>
      </div>

      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 z-10"
        style={{
          background: "hsl(var(--primary))",
          border: "2px solid hsl(var(--background))",
          color: "hsl(var(--primary-foreground))",
          boxShadow: "0 2px 8px hsl(var(--primary) / 0.4)",
        }}
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  );
};

export default Sidebar;
