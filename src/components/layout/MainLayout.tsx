import { useState } from "react";
import { Outlet, useLocation, Navigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import MobileFooterNav from "./MobileFooterNav";
import { useAuth } from "@/contexts/AuthContext";

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
};

// Admin-only paths
const adminOnlyPaths = ["/organization", "/attendance", "/reports", "/settings", "/shift-management", "/payroll"];

const MainLayout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();
  const { currentUser, hasAdminAccess } = useAuth();

  // Redirect to login if not authenticated
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Redirect employee from admin-only pages
  if (!hasAdminAccess && adminOnlyPaths.some((p) => location.pathname.startsWith(p))) {
    return <Navigate to="/check-in" replace />;
  }

  // Redirect employee from /employees list to their own profile
  if (!hasAdminAccess && location.pathname === "/employees") {
    return <Navigate to={`/employees/${currentUser.id}`} replace />;
  }

  // Block employee from viewing other employees' profiles
  if (!hasAdminAccess && location.pathname.startsWith("/employees/") && currentUser) {
    const viewingId = location.pathname.split("/employees/")[1];
    if (viewingId && viewingId !== currentUser.id) {
      return <Navigate to={`/employees/${currentUser.id}`} replace />;
    }
  }

  const pageInfo = pageTitles[location.pathname] ?? { title: "HRPro", subtitle: "ระบบบริหารจัดการพนักงาน" };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300 ${
          mobileSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMobileSidebarOpen(false)}
      />

      {/* Sidebar - desktop */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      </div>

      {/* Sidebar - mobile */}
      <div
        className={`fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-300 ease-in-out overflow-visible ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar collapsed={false} onToggle={() => setMobileSidebarOpen(false)} onNavigate={() => setMobileSidebarOpen(false)} />
      </div>

      {/* Main area */}
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

      {/* Mobile Footer Nav */}
      <MobileFooterNav />
    </div>
  );
};

export default MainLayout;
