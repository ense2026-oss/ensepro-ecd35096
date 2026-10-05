import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { queryPersister, QUERY_CACHE_MAX_AGE, QUERY_CACHE_VERSION } from "@/lib/queryPersist";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { EmployeeProvider } from "@/contexts/EmployeeContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { PendingCountsProvider } from "@/contexts/PendingCountsContext";
import { TimeEditProvider } from "@/contexts/TimeEditContext";
import { ContractProvider } from "@/contexts/ContractContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useModuleSettings } from "@/hooks/useModuleSettings";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
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
import OvertimeManagement from "@/pages/OvertimeManagement";
import Payroll from "@/pages/Payroll";
import MyPayslips from "@/pages/MyPayslips";
import Contracts from "@/pages/Contracts";
import ContractDetail from "@/pages/ContractDetail";
import DayOff from "@/pages/DayOff";
import NotFound from "@/pages/NotFound";
import OAuthConsent from "@/pages/OAuthConsent";
import { applyStartupDisplaySettings } from "@/components/settings/DisplaySettings";

// Apply saved display settings on load (personal preferences take precedence)
applyStartupDisplaySettings();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // a revisit inside 30s shows cache with no request at all; after that: instant cache + silent background refetch
      gcTime: QUERY_CACHE_MAX_AGE, // must be >= the persisted snapshot's maxAge so restored queries aren't garbage-collected on the spot
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      // Supabase intermittently answers 504 "upstream request timeout" under burst
      // load (many pages fire several queries on mount). Retry with backoff before
      // surfacing an error — this is what turned into "โหลดข้อมูลไม่สำเร็จ" toasts.
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
  },
});

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
  // Mobile users default to the check-in page — but only when the check-in
  // module is actually enabled. Wait for the settings to load before deciding
  // so we never bounce a mobile user into a disabled /check-in page.
  const { modules: moduleSettings, loading: modulesLoading } = useModuleSettings();
  if (loading || modulesLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  const isMobile = window.innerWidth < 1024;
  const checkInEnabled = moduleSettings['check-in'] !== false;
  return <Navigate to={isMobile && checkInEnabled ? "/check-in" : "/dashboard"} replace />;
};

// Redirect away from login if already authenticated. Honor ?next= (same-origin path).
const LoginRoute = () => {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  if (loading) return null;
  if (user) {
    const raw = params.get("next");
    const safe = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
    return <Navigate to={safe} replace />;
  }
  return <Login />;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<AuthRedirect />} />
    <Route path="/login" element={<LoginRoute />} />
    <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />

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
      <Route path="/overtime-management" element={<OvertimeManagement />} />
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
  // Restores page data from localStorage on boot (so F5 doesn't reload everything)
  // and keeps the snapshot updated while the app runs.
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{ persister: queryPersister, maxAge: QUERY_CACHE_MAX_AGE, buster: QUERY_CACHE_VERSION }}
  >
    <TooltipProvider delayDuration={300} skipDelayDuration={0}>
      <Toaster />
      <Sonner />
      <BrandingProvider>
        <AuthProvider>
          <BrowserRouter>
            <ImpersonationProvider>
              <AppRoutes />
            </ImpersonationProvider>
          </BrowserRouter>
        </AuthProvider>
      </BrandingProvider>
    </TooltipProvider>
  </PersistQueryClientProvider>
);

export default App;
