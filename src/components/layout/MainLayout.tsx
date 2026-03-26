import { useState } from "react";
import { Outlet, useLocation, Navigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import MobileFooterNav from "./MobileFooterNav";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";

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
  const { user, loading, profileReady, currentUser, role } = useAuth();
  const { canAccessRoute, isSelfOnly, loading: permLoading } = usePermissions();

  // Still bootstrapping auth — show loader, don't redirect
  if (loading || !profileReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
        </div>
      </div>
    );
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

  // Redirect self-only users from list view to their own profile
  if (isSelfOnly(role, "/employees") && location.pathname === "/employees") {
    return <Navigate to={`/employees/${selfEmployeeId}`} replace />;
  }

  // Block employee from viewing other employees' profiles
  if (isSelfOnly(role, "/employees") && location.pathname.startsWith("/employees/")) {
    const viewingId = location.pathname.split("/employees/")[1];
    if (viewingId && viewingId !== selfEmployeeId) {
      return <Navigate to={`/employees/${selfEmployeeId}`} replace />;
    }
  }

  const pageInfo = pageTitles[location.pathname] ?? pageTitles[currentPath] ?? { title: "HRPro", subtitle: "ระบบบริหารจัดการพนักงาน" };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div
        className={`fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300 ${
          mobileSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMobileSidebarOpen(false)}
      />
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      </div>
      <div
        className={`fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-300 ease-in-out overflow-visible ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar collapsed={false} onToggle={() => setMobileSidebarOpen(false)} onNavigate={() => setMobileSidebarOpen(false)} />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar
          onMenuToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          pageTitle={pageInfo.title}
          pageSubtitle={pageInfo.subtitle}
        />
        <main className="flex-1 overflow-y-auto overflow-x-hidden custom-scroll p-4 lg:p-6 pb-24 lg:pb-6">
          <Outlet />
        </main>
      </div>
      <MobileFooterNav />
    </div>
  );
};

export default MainLayout;
