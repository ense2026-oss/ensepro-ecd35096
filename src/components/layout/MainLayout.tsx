import { useState, useRef, useEffect } from "react";
import { Outlet, useLocation, Navigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import MobileFooterNav from "./MobileFooterNav";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useModuleSettings } from "@/hooks/useModuleSettings";
import { LogOut } from "lucide-react";
import { FullScreenLoader } from "@/components/ui/dots-loader";

// Map a base route to its module_settings key (for enable/disable gating)
const routeToModuleSetting: Record<string, string> = {
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

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "หน้าหลัก", subtitle: "ภาพรวมระบบบริหารจัดการพนักงาน" },
  "/employees": { title: "ข้อมูลพนักงาน", subtitle: "จัดการข้อมูลพนักงานทั้งหมดในองค์กร" },
  "/organization": { title: "โครงสร้างองค์กร", subtitle: "แผนผังลำดับชั้นและโครงสร้างแผนก" },
  "/attendance": { title: "บันทึกเวลาเข้าออกงาน", subtitle: "ติดตามเวลาทำงานและการเข้างาน" },
  "/leave": { title: "ระบบลางาน", subtitle: "จัดการคำขอลาและโควต้าการลา" },
  "/overtime": { title: "ระบบโอที", subtitle: "ยื่นคำขอ ติดตาม และอนุมัติการทำงานล่วงเวลา" },
  "/check-in": { title: "ลงเวลา", subtitle: "ลงเวลาเข้า-ออกงานด้วย GPS ตรวจสอบรัศมีอัตโนมัติ" },
  "/shift-management": { title: "จัดการกะทำงาน", subtitle: "กำหนดและจัดการกะการทำงานล่วงหน้าให้พนักงาน" },
  "/payroll": { title: "ระบบเงินเดือน", subtitle: "คำนวณและจัดการเงินเดือนประจำเดือน" },
  "/reports": { title: "รายงาน", subtitle: "สรุปและส่งออกรายงานต่างๆ" },
  "/notifications": { title: "การแจ้งเตือน", subtitle: "รายการแจ้งเตือนและการอนุมัติ" },
  "/settings": { title: "ตั้งค่าระบบ", subtitle: "กำหนดค่าระบบ บริษัท และสิทธิ์การใช้งาน" },
  "/profile": { title: "โปรไฟล์ของฉัน", subtitle: "จัดการข้อมูลส่วนตัวและความปลอดภัย" },
  "/contracts": { title: "จัดการสัญญาจ้าง", subtitle: "สร้างและจัดการสัญญาจ้างพนักงาน" },
};

const MainLayout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const { user, loading, profileReady, currentUser, role } = useAuth();
  const { isImpersonating, impersonatedName, stopImpersonation, busy: impersonationBusy } = useImpersonation();
  const { canAccessRoute, isSelfOnly, loading: permLoading } = usePermissions();
  const { modules: enabledModules, loading: modulesLoading } = useModuleSettings();

  // Reset scroll to the top of the page on every route change
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Still bootstrapping auth — show loader, don't redirect
  if (loading || !profileReady) {
    return <FullScreenLoader label="กำลังโหลด..." />;
  }

  // No session at all → redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Employee ID for self-routes (fallback to auth id)
  const selfEmployeeId = currentUser?.employeeId || user.id;

  // Check role-based access for current path
  const currentPath = "/" + location.pathname.split("/")[1]; // e.g. /employees/123 → /employees
  if (!canAccessRoute(role, currentPath)) {
    // Redirect to first accessible page
    const defaultPage = canAccessRoute(role, "/dashboard") ? "/dashboard" : "/notifications";
    return <Navigate to={defaultPage} replace />;
  }

  // Block direct URL access to disabled modules (once settings are loaded)
  const moduleSettingKey = routeToModuleSetting[currentPath];
  if (!modulesLoading && moduleSettingKey && enabledModules[moduleSettingKey] === false) {
    return <Navigate to="/dashboard" replace />;
  }


  // Wait for permissions to load before applying self-only routing: during the
  // initial fetch getScope has no rows and defaults to "self", which would
  // wrongly bounce admins/HR (scope "all") to their own profile until their real
  // permissions arrive.
  // Redirect self-only users from list view to their own profile
  if (!permLoading && isSelfOnly(role, "/employees") && location.pathname === "/employees") {
    return <Navigate to={`/employees/${selfEmployeeId}`} replace />;
  }

  // Block employee from viewing other employees' profiles
  if (!permLoading && isSelfOnly(role, "/employees") && location.pathname.startsWith("/employees/")) {
    const viewingId = location.pathname.split("/employees/")[1];
    if (viewingId && viewingId !== selfEmployeeId) {
      return <Navigate to={`/employees/${selfEmployeeId}`} replace />;
    }
  }

  const pageInfo = pageTitles[location.pathname] ?? pageTitles[currentPath] ?? { title: "HRPro", subtitle: "ระบบบริหารจัดการพนักงาน" };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div
        className={`fixed inset-0 bg-black/50 z-[55] lg:hidden transition-opacity duration-300 ${
          mobileSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMobileSidebarOpen(false)}
      />
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      </div>
      <div
        className={`fixed inset-y-0 left-0 z-[60] lg:hidden transition-transform duration-300 ease-in-out overflow-visible ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar collapsed={false} onToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)} onNavigate={() => setMobileSidebarOpen(false)} />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {isImpersonating && (
          <div className="flex items-center justify-between gap-3 px-4 py-2 bg-amber-500 text-amber-950 text-sm font-medium flex-shrink-0">
            <span>
              กำลังเข้าสู่ระบบในฐานะ <span className="font-semibold">{impersonatedName}</span> — คุณกำลังใช้สิทธิ์จริงของพนักงานคนนี้
            </span>
            <button
              onClick={stopImpersonation}
              disabled={impersonationBusy}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-950/10 hover:bg-amber-950/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              {impersonationBusy ? "กำลังกลับ..." : "กลับเป็นผู้ดูแลระบบ"}
            </button>
          </div>
        )}
        <Topbar
          onMenuToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          pageTitle={pageInfo.title}
          pageSubtitle={pageInfo.subtitle}
        />
        <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden custom-scroll p-4 lg:p-6 pb-24 lg:pb-6" style={{ overflowX: "hidden" }}>
          <Outlet />
        </main>
      </div>
      <MobileFooterNav />
    </div>
  );
};

export default MainLayout;
