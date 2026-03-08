import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { EmployeeProvider } from "./contexts/EmployeeContext";
import { BrandingProvider } from "./contexts/BrandingContext";
import { PendingCountsProvider } from "./contexts/PendingCountsContext";
import { TimeEditProvider } from "./contexts/TimeEditContext";
import { ContractProvider } from "./contexts/ContractContext";
import { AuthProvider } from "./contexts/AuthContext";
import { OrgProvider } from "./contexts/OrgContext";
import MainLayout from "./components/layout/MainLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import EmployeeProfile from "./pages/EmployeeProfile";
import Organization from "./pages/Organization";
import Attendance from "./pages/Attendance";
import Leave from "./pages/Leave";
import Reports from "./pages/Reports";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import OvertimeRequest from "./pages/OvertimeRequest";
import CheckIn from "./pages/CheckIn";
import ShiftManagement from "./pages/ShiftManagement";
import Payroll from "./pages/Payroll";
import Contracts from "./pages/Contracts";
import ContractDetail from "./pages/ContractDetail";
import NotFound from "./pages/NotFound";
import { applyDisplaySettings } from "./components/settings/DisplaySettings";

// Redirect based on device
const ResponsiveRedirect = () => {
  const isMobile = window.innerWidth < 1024;
  return <Navigate to={isMobile ? "/check-in" : "/dashboard"} replace />;
};

// Apply saved display settings on load
applyDisplaySettings();

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <BrandingProvider>
        <OrgProvider>
        <EmployeeProvider>
        <AuthProvider>
        <PendingCountsProvider>
        <ContractProvider>
        <TimeEditProvider>
        <Routes>
          <Route path="/" element={<ResponsiveRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route element={<MainLayout />}>
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
            <Route path="/reports" element={<Reports />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
        </TimeEditProvider>
        </ContractProvider>
        </PendingCountsProvider>
        </AuthProvider>
        </EmployeeProvider>
        </OrgProvider>
        </BrandingProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
