import { Link, useLocation, useNavigate } from "react-router-dom";
import { usePendingCounts } from "@/contexts/PendingCountsContext";
import { useBranding } from "@/contexts/BrandingContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useModuleSettings } from "@/hooks/useModuleSettings";
import EmployeeAvatar from "@/components/ui/employee-avatar";
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
      { path: "/dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
      { path: "/employees", label: "พนักงาน", icon: Users },
      { path: "/organization", label: "โครงสร้างองค์กร", icon: GitBranch },
      { path: "/contracts", label: "สัญญาจ้าง", icon: FileSignature },
    ],
  },
  {
    section: "การบริหารเวลา",
    items: [
      { path: "/attendance", label: "บันทึกเวลา", icon: Clock },
      { path: "/leave", label: "การลางาน", icon: CalendarDays },
      { path: "/overtime", label: "ล่วงเวลา", icon: Clock },
      { path: "/check-in", label: "เช็คอิน", icon: MapPin },
      { path: "/shift-management", label: "จัดการกะ", icon: CalendarDays },
    ],
  },
  {
    section: "การเงิน",
    items: [
      { path: "/payroll", label: "เงินเดือน", icon: Banknote },
    ],
  },
  {
    section: "รายงาน & ตั้งค่า",
    items: [
      { path: "/reports", label: "รายงาน", icon: FileText },
      { path: "/notifications", label: "การแจ้งเตือน", icon: Bell },
      { path: "/settings", label: "ตั้งค่า", icon: Settings },
    ],
  },
];

const Sidebar = ({ collapsed, onToggle, onNavigate }: SidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { leavePending, attendancePending, overtimePending, notificationCount } = usePendingCounts();
  const { programName, programSubtitle, logoUrl, logoOnlyUrl, displayMode } = useBranding();
  const activeLogo = displayMode === "logo-only" ? logoOnlyUrl : logoUrl;
  const { currentUser, role, logout } = useAuth();
  const { canAccessRoute, isSelfOnly: permSelfOnly } = usePermissions();

  // Module settings: listen for real-time changes
  const [enabledModules, setEnabledModules] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("module-settings");
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) setEnabledModules(detail);
    };
    window.addEventListener("module-settings-changed", handler);
    return () => window.removeEventListener("module-settings-changed", handler);
  }, []);

  const pathToModule: Record<string, string> = {
    "/employees": "employees",
    "/organization": "organization",
    "/contracts": "contracts",
    "/attendance": "attendance",
    "/leave": "leave",
    "/overtime": "overtime",
    "/check-in": "check-in",
    "/shift-management": "shift-management",
    "/payroll": "payroll",
    "/reports": "reports",
  };

  // Filter nav items based on role AND module settings
  const navItems = allNavItems.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      // Role-based access (from DB permissions)
      if (!canAccessRoute(role, item.path)) return false;
      // Module settings
      const moduleId = pathToModule[item.path];
      if (moduleId && enabledModules[moduleId] === false) return false;
      return true;
    }),
  })).filter((section) => section.items.length > 0);

  const userInitials = currentUser ? currentUser.avatar : "AD";
  const userName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "Admin User";

  const userRole = role || "employee";

  const roleLabel: Record<string, string> = {
    admin: "ผู้ดูแลระบบ",
    hr: "ฝ่ายบุคคล",
    manager: "ผู้จัดการ",
    employee: "พนักงาน",
  };

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
            <EmployeeAvatar photoUrl={currentUser?.photoUrl} avatar={currentUser?.avatar} avatarColor={currentUser?.avatarColor} avatarTextColor={currentUser?.avatarTextColor} firstName={currentUser?.firstName} size="md" rounded="lg" />
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
          <EmployeeAvatar photoUrl={currentUser?.photoUrl} avatar={currentUser?.avatar} avatarColor={currentUser?.avatarColor} avatarTextColor={currentUser?.avatarTextColor} firstName={currentUser?.firstName} size="md" rounded="lg" />
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
                // Only redirect to own profile for the /employees menu item
                const selfOnly = item.path === "/employees" && permSelfOnly(role, item.path);
                const linkPath = selfOnly && currentUser
                  ? `/employees/${currentUser.employeeId || currentUser.id}`
                  : item.path;
                const displayLabel = item.label;
                // Only the employees menu item should be active when on /employees/:id
                // Other self-only items should NOT show active when redirected to /employees/:id
                const isActive = selfOnly
                  ? (item.path === "/employees" && location.pathname.startsWith("/employees/"))
                  : (location.pathname === item.path || (item.path === "/employees" && location.pathname.startsWith("/employees/")));
                const badgeCount: number = dynamicBadges[item.path] ?? 0;
                return (
                  <Link
                    key={item.path}
                    to={linkPath}
                    className={`sidebar-item ${isActive ? "active" : ""} ${collapsed ? "justify-center" : ""}`}
                    title={collapsed ? displayLabel : undefined}
                    onClick={onNavigate}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1">{displayLabel}</span>
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
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
        <button
          onClick={async () => {
            await logout();
            navigate("/login");
          }}
          className={`sidebar-item w-full ${collapsed ? "justify-center" : ""}`}
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>ออกจากระบบ</span>}
        </button>
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
