import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { EmployeeProvider } from "@/contexts/EmployeeContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { PendingCountsProvider } from "@/contexts/PendingCountsContext";
import { TimeEditProvider } from "@/contexts/TimeEditContext";
import { ContractProvider } from "@/contexts/ContractContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PermissionsProvider } from "@/contexts/PermissionsContext";
import { OrgProvider } from "@/contexts/OrgContext";
import MainLayout from "@/components/layout/MainLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Employees from "@/pages/Employees";
import EmployeeProfile from "@/pages/EmployeeProfile";
import Organization from "@/pages/Organization";
import Attendance from "@/pages/Attendance";
import Leave from "@/pages/Leave";
import Reports from "@/pages/Reports";
import Notifications from "@/pages/Notifications";
import Settings from "@/pages/Settings";
import Profile from "@/pages/Profile";
import OvertimeRequest from "@/pages/OvertimeRequest";
import CheckIn from "@/pages/CheckIn";
import ShiftManagement from "@/pages/ShiftManagement";
import Payroll from "@/pages/Payroll";
import MyPayslips from "@/pages/MyPayslips";
import Contracts from "@/pages/Contracts";
import ContractDetail from "@/pages/ContractDetail";
import DayOff from "@/pages/DayOff";
import NotFound from "@/pages/NotFound";
import { applyDisplaySettings } from "@/components/settings/DisplaySettings";

// Apply saved display settings on load
applyDisplaySettings();

const queryClient = new QueryClient();

// Auth guard component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Redirect based on auth state
const AuthRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  const isMobile = window.innerWidth < 1024;
  return <Navigate to={isMobile ? "/check-in" : "/dashboard"} replace />;
};

// Redirect away from login if already authenticated
const LoginRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Login />;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<AuthRedirect />} />
    <Route path="/login" element={<LoginRoute />} />
    <Route element={
      <ProtectedRoute>
        <PermissionsProvider>
          <OrgProvider>
            <EmployeeProvider>
              <PendingCountsProvider>
                <ContractProvider>
                  <TimeEditProvider>
                    <MainLayout /> {/* layout */}
                  </TimeEditProvider>
                </ContractProvider>
              </PendingCountsProvider>
            </EmployeeProvider>
          </OrgProvider>
        </PermissionsProvider>
      </ProtectedRoute>
    }>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/employees" element={<Employees />} />
      <Route path="/employees/:id" element={<EmployeeProfile />} />
      <Route path="/organization" element={<Organization />} />
      <Route path="/contracts" element={<Contracts />} />
      <Route path="/contracts/:id" element={<ContractDetail />} />
      <Route path="/attendance" element={<Attendance />} />
      <Route path="/leave" element={<Leave />} />
      <Route path="/overtime" element={<OvertimeRequest />} />
      <Route path="/check-in" element={<CheckIn />} />
      <Route path="/shift-management" element={<ShiftManagement />} />
      <Route path="/payroll" element={<Payroll />} />
      <Route path="/my-payslips" element={<MyPayslips />} />
      <Route path="/day-off" element={<DayOff />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/profile" element={<Profile />} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider delayDuration={300} skipDelayDuration={0}>
      <Toaster />
      <Sonner />
      <BrandingProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </BrandingProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
