import { useEffect, useState, useMemo, useRef, useCallback, forwardRef } from "react";
import {
  Users, UserCheck, UserX, Clock, TrendingUp, TrendingDown,
  Calendar, Briefcase, AlertCircle, CheckCircle, MapPin,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { th } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

/* ─── StatCard ─── */
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  trend?: { value: number; positive: boolean };
  color: string;
  bgColor: string;
  loading?: boolean;
}

const StatCard = forwardRef<HTMLDivElement, StatCardProps>(
  ({ title, value, subtitle, icon: Icon, trend, color, bgColor, loading }, ref) => (
    <div ref={ref} className="card-base p-3 sm:p-5 animate-fade-in">
      <div className="flex items-start justify-between mb-2 sm:mb-4">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] sm:text-sm text-muted-foreground font-medium leading-tight">{title}</p>
          {loading ? (
            <Skeleton className="h-8 w-16 mt-1" />
          ) : (
            <p className="text-xl sm:text-3xl font-bold font-display mt-0.5 sm:mt-1" style={{ color }}>{value}</p>
          )}
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 leading-tight">{subtitle}</p>
        </div>
        <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bgColor }}>
          <Icon className="w-4 h-4 sm:w-6 sm:h-6" style={{ color }} />
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
          {trend.positive ? <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" style={{ color: "#87FF0F" }} /> : <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-destructive" />}
          <span className="text-[10px] sm:text-xs font-semibold" style={{ color: trend.positive ? "hsl(90 100% 35%)" : "hsl(0 84% 50%)" }}>
            {trend.positive ? "+" : ""}{trend.value}%
          </span>
          <span className="text-[10px] sm:text-xs text-muted-foreground">จากเดือนที่แล้ว</span>
        </div>
      )}
    </div>
  )
);
StatCard.displayName = "StatCard";

/* ─── Full-page Skeleton ─── */
const DashboardSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    {/* Welcome card */}
    <div className="card-base p-6">
      <Skeleton className="h-6 w-48 mb-2" />
      <Skeleton className="h-4 w-64" />
    </div>
    {/* Stat cards row 1 */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card-base p-3 sm:p-5">
          <div className="flex items-start justify-between mb-2 sm:mb-4">
            <div className="flex-1">
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-8 w-14 mb-1" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl" />
          </div>
        </div>
      ))}
    </div>
    {/* Stat cards row 2 */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card-base p-3 sm:p-5">
          <div className="flex items-start justify-between mb-2 sm:mb-4">
            <div className="flex-1">
              <Skeleton className="h-3 w-16 mb-2" />
              <Skeleton className="h-8 w-12 mb-1" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl" />
          </div>
        </div>
      ))}
    </div>
    {/* Charts row */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="card-base p-5 lg:col-span-2">
        <Skeleton className="h-5 w-40 mb-2" />
        <Skeleton className="h-3 w-24 mb-6" />
        <Skeleton className="h-[240px] w-full rounded-xl" />
      </div>
      <div className="card-base p-5">
        <Skeleton className="h-5 w-28 mb-2" />
        <Skeleton className="h-3 w-32 mb-4" />
        <Skeleton className="h-[200px] w-full rounded-xl" />
      </div>
    </div>
    {/* Bottom row */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card-base p-5">
        <Skeleton className="h-5 w-32 mb-4" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl mb-3" />
        ))}
      </div>
      <div className="card-base p-5">
        <Skeleton className="h-5 w-32 mb-4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="mb-4">
            <div className="flex justify-between mb-1.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

const LEAVE_COLORS: Record<string, string> = {
  "ลาป่วย": "#FF870F",
  "ลาพักร้อน": "#87FF0F",
  "ลากิจ": "#9CA3AF",
};
const DEFAULT_LEAVE_COLOR = "#60a5fa";

const Dashboard = () => {
  const { currentUser, role } = useAuth();
  const { getScope } = usePermissions();
  const [loading, setLoading] = useState(true);

  // Shared data
  const [employees, setEmployees] = useState<any[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [otRequests, setOtRequests] = useState<any[]>([]);
  const [timeEditRequests, setTimeEditRequests] = useState<any[]>([]);
  const [monthlyAttendance, setMonthlyAttendance] = useState<any[]>([]);
  const [checkInToday, setCheckInToday] = useState<any | null>(null);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [myEmployee, setMyEmployee] = useState<any | null>(null);

  const today = format(new Date(), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

  // Determine view type based on dynamic permissions scope
  const employeeScope = getScope(role, 'employee');
  const viewType: "admin" | "manager" | "employee" = employeeScope === "all" ? "admin" : employeeScope === "department" ? "manager" : "employee";

  const fetchAll = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    try {
      // Parallel: fetch leave_types + employee record simultaneously
      const empIdDirect = currentUser?.employeeId;
      const userId = currentUser?.id;

      const [ltRes, empLookup] = await Promise.all([
        supabase.from("leave_types").select("*"),
        empIdDirect
          ? supabase.from("employees").select("*").eq("id", empIdDirect).maybeSingle()
          : userId
            ? supabase.from("employees").select("*").eq("user_id", userId).maybeSingle()
            : Promise.resolve({ data: null }),
      ]);

      if (ltRes.data) setLeaveTypes(ltRes.data);
      const empRecord = empLookup.data;
      if (empRecord) setMyEmployee(empRecord);
      const empId = empRecord?.id || empIdDirect || null;

      if (viewType === "employee") {
        if (!empId) { setLoading(false); return; }
        const [leaveRes, otRes, ciRes] = await Promise.all([
          supabase.from("leave_requests").select("*").eq("employee_id", empId),
          supabase.from("overtime_requests").select("*").eq("employee_id", empId),
          supabase.from("check_in_records").select("*").eq("employee_id", empId).eq("date", today).maybeSingle(),
        ]);
        if (leaveRes.data) setLeaveRequests(leaveRes.data);
        if (otRes.data) setOtRequests(otRes.data);
        setCheckInToday(ciRes.data);
      } else if (viewType === "manager") {
        const myDept = empRecord?.dept || "";
        const [empRes, attRes, leaveRes, otRes, teRes, monthAttRes, ciRes] = await Promise.all([
          supabase.from("employees").select("id, first_name, last_name, dept, status, user_id, start_date").eq("dept", myDept),
          supabase.from("attendance_records").select("id, employee_id, date, status, late").eq("date", today),
          supabase.from("leave_requests").select("id, employee_id, leave_type_name, date_from, date_to, days, status, created_at, employees(first_name, last_name)").gte("date_from", monthStart),
          supabase.from("overtime_requests").select("id, employee_id, date, hours, status, ot_type, created_at, employees(first_name, last_name)").gte("date", monthStart),
          supabase.from("time_edit_requests").select("id, employee_id").eq("status", "pending"),
          supabase.from("attendance_records").select("date, status, late, employee_id").gte("date", monthStart).lte("date", monthEnd),
          empId ? supabase.from("check_in_records").select("*").eq("employee_id", empId).eq("date", today).maybeSingle() : Promise.resolve({ data: null }),
        ]);

        const deptEmpIds = new Set((empRes.data || []).map((e: any) => e.id));
        if (empRes.data) setEmployees(empRes.data);
        if (attRes.data) setTodayAttendance(attRes.data.filter((a: any) => deptEmpIds.has(a.employee_id)));
        if (leaveRes.data) setLeaveRequests(leaveRes.data.filter((l: any) => deptEmpIds.has(l.employee_id)));
        if (otRes.data) setOtRequests(otRes.data.filter((o: any) => deptEmpIds.has(o.employee_id)));
        if (teRes.data) setTimeEditRequests(teRes.data.filter((t: any) => deptEmpIds.has(t.employee_id)));
        if (monthAttRes.data) setMonthlyAttendance(monthAttRes.data.filter((a: any) => deptEmpIds.has(a.employee_id)));
        setCheckInToday(ciRes.data);
      } else {
        // Admin/HR: fetch everything in one parallel batch
        const [empRes, attRes, leaveRes, otRes, teRes, monthAttRes, ciRes] = await Promise.all([
          supabase.from("employees").select("id, first_name, last_name, dept, status, user_id, start_date"),
          supabase.from("attendance_records").select("id, employee_id, date, status, late").eq("date", today),
          supabase.from("leave_requests").select("id, employee_id, leave_type_name, date_from, date_to, days, status, created_at, employees(first_name, last_name)").gte("date_from", monthStart),
          supabase.from("overtime_requests").select("id, employee_id, date, hours, status, ot_type, created_at, employees(first_name, last_name)").gte("date", monthStart),
          supabase.from("time_edit_requests").select("id").eq("status", "pending"),
          supabase.from("attendance_records").select("date, status, late").gte("date", monthStart).lte("date", monthEnd),
          empId ? supabase.from("check_in_records").select("*").eq("employee_id", empId).eq("date", today).maybeSingle() : Promise.resolve({ data: null }),
        ]);

        if (empRes.data) setEmployees(empRes.data);
        if (attRes.data) setTodayAttendance(attRes.data);
        if (leaveRes.data) setLeaveRequests(leaveRes.data);
        if (otRes.data) setOtRequests(otRes.data);
        if (teRes.data) setTimeEditRequests(teRes.data);
        if (monthAttRes.data) setMonthlyAttendance(monthAttRes.data);
        setCheckInToday(ciRes.data);
      }
    } catch (e) {
      console.error("Dashboard load error:", e);
    } finally {
      if (initial) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, monthStart, monthEnd, currentUser?.id, currentUser?.employeeId, viewType]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedFetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchAll(), 800);
  }, [fetchAll]);

  useEffect(() => {
    if (!currentUser?.id) return;
    fetchAll(true);

    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_records" }, debouncedFetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "check_in_records" }, debouncedFetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, debouncedFetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "overtime_requests" }, debouncedFetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "time_edit_requests" }, debouncedFetch)
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [fetchAll, debouncedFetch, currentUser?.id]);

  // ═══════════════════════════════════════════════
  // Derived stats (must be before any early return for hooks rules)
  // ═══════════════════════════════════════════════
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((e) => e.status === "active").length;
  const presentToday = todayAttendance.filter((a) => a.status === "present" || a.status === "late").length;
  const lateToday = todayAttendance.filter((a) => a.late).length;
  const leaveToday = todayAttendance.filter((a) => a.status === "leave").length;

  const pendingLeaves = leaveRequests.filter((l) => l.status === "pending").length;
  const pendingOT = otRequests.filter((o) => o.status === "pending").length;
  const pendingTimeEdits = timeEditRequests.length;
  const totalPending = pendingLeaves + pendingOT + pendingTimeEdits;

  const approvedToday = [
    ...leaveRequests.filter((l) => l.status === "approved"),
    ...otRequests.filter((o) => o.status === "approved"),
  ].length;

  const monthOtHours = otRequests
    .filter((o) => o.status === "approved" && o.date >= monthStart && o.date <= monthEnd)
    .reduce((sum, o) => sum + Number(o.hours || 0), 0);

  const newEmployeesThisMonth = employees.filter(
    (e) => e.start_date >= monthStart && e.start_date <= monthEnd
  ).length;

  const presentPercent = totalEmployees > 0 ? ((presentToday / totalEmployees) * 100).toFixed(1) : "0";
  const leavePercent = totalEmployees > 0 ? ((leaveToday / totalEmployees) * 100).toFixed(1) : "0";
  const latePercent = totalEmployees > 0 ? ((lateToday / totalEmployees) * 100).toFixed(1) : "0";

  // Leave pie data
  const leavePieData = useMemo(() => {
    const monthLeaves = leaveRequests.filter((l) => l.date_from >= monthStart && l.date_from <= monthEnd);
    const grouped: Record<string, number> = {};
    monthLeaves.forEach((l) => {
      const name = l.leave_type_name || "อื่นๆ";
      grouped[name] = (grouped[name] || 0) + Number(l.days || 1);
    });
    return Object.entries(grouped).map(([name, value]) => ({
      name, value, color: LEAVE_COLORS[name] || DEFAULT_LEAVE_COLOR,
    }));
  }, [leaveRequests, monthStart, monthEnd]);

  const totalLeaveDays = leavePieData.reduce((s, d) => s + d.value, 0);

  // Department stats
  const deptStats = useMemo(() => {
    const depts: Record<string, { count: number; present: number }> = {};
    employees.forEach((e) => {
      const d = e.dept || "ไม่ระบุ";
      if (!depts[d]) depts[d] = { count: 0, present: 0 };
      depts[d].count++;
    });
    todayAttendance.forEach((a) => {
      const emp = employees.find((e) => e.id === a.employee_id);
      if (emp && (a.status === "present" || a.status === "late")) {
        const d = emp.dept || "ไม่ระบุ";
        if (depts[d]) depts[d].present++;
      }
    });
    return Object.entries(depts)
      .map(([dept, v]) => ({ dept, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [employees, todayAttendance]);

  // Attendance chart
  const attendanceChartData = useMemo(() => {
    const byDate: Record<string, { present: number; late: number; absent: number }> = {};
    monthlyAttendance.forEach((a) => {
      if (!byDate[a.date]) byDate[a.date] = { present: 0, late: 0, absent: 0 };
      if (a.status === "present" || a.status === "late") byDate[a.date].present++;
      if (a.late) byDate[a.date].late++;
      if (a.status === "absent") byDate[a.date].absent++;
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, v]) => ({
        month: format(new Date(date), "d MMM", { locale: th }),
        ...v,
      }));
  }, [monthlyAttendance]);

  // Recent activity
  const recentActivity = useMemo(() => {
    const items: { id: string; name: string; action: string; time: string; type: string; status: string }[] = [];
    leaveRequests.slice(0, 4).forEach((l) => {
      const emp = (l as any).employees;
      items.push({
        id: l.id,
        name: emp ? `${emp.first_name} ${emp.last_name}` : "พนักงาน",
        action: `ยื่นคำขอ${l.leave_type_name}`,
        time: format(new Date(l.created_at), "HH:mm น."),
        type: "leave",
        status: l.status === "approved" ? "success" : l.status === "pending" ? "pending" : "info",
      });
    });
    otRequests.slice(0, 3).forEach((o) => {
      const emp = (o as any).employees;
      items.push({
        id: o.id,
        name: emp ? `${emp.first_name} ${emp.last_name}` : "พนักงาน",
        action: `ขอ OT ${o.hours} ชม.`,
        time: format(new Date(o.created_at), "HH:mm น."),
        type: "ot",
        status: o.status === "approved" ? "success" : o.status === "pending" ? "pending" : "info",
      });
    });
    return items.sort((a, b) => b.time.localeCompare(a.time)).slice(0, 6);
  }, [leaveRequests, otRequests]);

  const scopeLabel = viewType === "manager" ? `แผนก${myEmployee?.dept || ""}` : "ทั้งองค์กร";

  // Show full skeleton during initial load
  if (loading) return <DashboardSkeleton />;

  // ═══════════════════════════════════════════════
  // EMPLOYEE DASHBOARD
  // ═══════════════════════════════════════════════
  if (viewType === "employee" && currentUser) {
    const myLeaves = leaveRequests;
    const myOT = otRequests;
    const myOtHoursMonth = myOT
      .filter((o) => o.status === "approved" && o.date >= monthStart)
      .reduce((s, o) => s + Number(o.hours || 0), 0);

    // Build leave quota cards from actual leave_types
    const leaveQuotaCards = leaveTypes
      .sort((a, b) => a.sort_order - b.sort_order)
      .slice(0, 3)
      .map((lt) => {
        const used = myLeaves
          .filter((l) => l.leave_type_id === lt.id && l.status === "approved")
          .reduce((s, l) => s + Number(l.days || 0), 0);
        return { name: lt.name, quota: lt.quota, used, color: lt.color || DEFAULT_LEAVE_COLOR };
      });

    const recentRequests = [
      ...myLeaves.map((l) => ({ id: l.id, type: "leave" as const, label: l.leave_type_name, date: l.date_from, status: l.status, created: l.created_at })),
      ...myOT.map((o) => ({ id: o.id, type: "ot" as const, label: `OT ${o.hours} ชม.`, date: o.date, status: o.status, created: o.created_at })),
    ].sort((a, b) => b.created.localeCompare(a.created)).slice(0, 5);

    return (
      <div className="space-y-6">
        <div className="card-base p-6">
          <h2 className="text-xl font-bold font-display mb-1">สวัสดี, {currentUser.firstName} {currentUser.lastName} 👋</h2>
          <p className="text-sm text-muted-foreground">ยินดีต้อนรับเข้าสู่ระบบ HR — มุมมองพนักงาน</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {leaveQuotaCards.map((lq) => (
            <StatCard key={lq.name} title={`${lq.name}คงเหลือ`} value={loading ? "..." : Math.max(0, lq.quota - lq.used)} subtitle={`ใช้ไป ${lq.used} / ${lq.quota} วัน`} icon={Calendar} color={lq.color} bgColor={`${lq.color}20`} loading={loading} />
          ))}
          <StatCard title="OT เดือนนี้" value={loading ? "..." : myOtHoursMonth} subtitle="ชั่วโมง" icon={Clock} color="hsl(220 90% 50%)" bgColor="hsl(220 90% 93%)" loading={loading} />
        </div>
        <div className="card-base p-5">
          <h3 className="font-bold font-display mb-3">สถานะวันนี้</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-muted/50">
              <div className="flex items-center gap-2 mb-1"><MapPin className="w-4 h-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">เวลาเข้างาน</span></div>
              <p className="text-lg font-bold font-display">{checkInToday?.check_in || "-"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{checkInToday ? (checkInToday.within_radius ? "✓ ตรงเวลา" : "⚠ นอกพื้นที่") : "ยังไม่ลงเวลา"}</p>
            </div>
            <div className="p-4 rounded-xl bg-muted/50">
              <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">เวลาออกงาน</span></div>
              <p className="text-lg font-bold font-display">{checkInToday?.check_out || "-"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{checkInToday?.check_out ? "บันทึกแล้ว" : "ยังไม่ออกงาน"}</p>
            </div>
          </div>
        </div>
        <div className="card-base p-5">
          <h3 className="font-bold font-display mb-4">คำขอล่าสุดของฉัน</h3>
          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)
            ) : recentRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีคำขอ</p>
            ) : (
              recentRequests.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${r.type === "leave" ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"}`}>
                      {r.type === "leave" ? <Calendar className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{r.label}</p>
                      <p className="text-xs text-muted-foreground">{r.date}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.status === "approved" ? "badge-present" : r.status === "pending" ? "badge-late" : "badge-absent"}`}>
                    {r.status === "approved" ? "อนุมัติ" : r.status === "pending" ? "รออนุมัติ" : "ไม่อนุมัติ"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // ADMIN / HR / MANAGER DASHBOARD
  // ═══════════════════════════════════════════════
  return (
    <div className="space-y-6">
      {/* Scope indicator for manager */}
      {viewType === "manager" && (
        <div className="card-base p-4 border-l-4 border-l-[#FF870F]">
          <p className="text-sm font-medium">📊 แสดงข้อมูล{scopeLabel} — มุมมองหัวหน้างาน</p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={`พนักงาน${viewType === "manager" ? "ในแผนก" : "ทั้งหมด"}`} value={totalEmployees} subtitle={`ใช้งานอยู่ ${activeEmployees} คน`} icon={Users} color="#FF870F" bgColor="hsl(31 100% 93%)" loading={loading} />
        <StatCard title="มาทำงานวันนี้" value={presentToday} subtitle={`${presentPercent}% ของพนักงาน${viewType === "manager" ? "ในแผนก" : "ทั้งหมด"}`} icon={UserCheck} color="hsl(90 100% 35%)" bgColor="hsl(90 100% 92%)" loading={loading} />
        <StatCard title="ลางานวันนี้" value={leaveToday} subtitle={`${leavePercent}%`} icon={Calendar} color="hsl(220 90% 50%)" bgColor="hsl(220 90% 93%)" loading={loading} />
        <StatCard title="มาสายวันนี้" value={lateToday} subtitle={`${latePercent}%`} icon={Clock} color="hsl(0 84% 55%)" bgColor="hsl(0 84% 95%)" loading={loading} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="OT เดือนนี้" value={`${monthOtHours} ชม.`} subtitle={`${otRequests.filter((o) => o.status === "approved" && o.date >= monthStart).length} รายการ`} icon={Briefcase} color="hsl(0 0% 45%)" bgColor="hsl(0 0% 92%)" loading={loading} />
        <StatCard title="รออนุมัติ" value={totalPending} subtitle={`ลา ${pendingLeaves} / OT ${pendingOT} / แก้เวลา ${pendingTimeEdits}`} icon={AlertCircle} color="#FF870F" bgColor="hsl(31 100% 93%)" loading={loading} />
        <StatCard title="อนุมัติแล้ว" value={approvedToday} subtitle="รายการทั้งหมด" icon={CheckCircle} color="hsl(90 100% 35%)" bgColor="hsl(90 100% 92%)" loading={loading} />
        <StatCard title="พนักงานใหม่" value={newEmployeesThisMonth} subtitle="เดือนนี้" icon={UserX} color="hsl(220 90% 50%)" bgColor="hsl(220 90% 93%)" loading={loading} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card-base p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold font-display">สถิติการเข้างานเดือนนี้</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{scopeLabel}</p>
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-[240px] w-full rounded-xl" />
          ) : attendanceChartData.length === 0 ? (
            <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">ยังไม่มีข้อมูลการเข้างานเดือนนี้</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={attendanceChartData} barGap={2} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }} />
                <Bar dataKey="present" name="มาทำงาน" fill="#87FF0F" radius={[4, 4, 0, 0]} />
                <Bar dataKey="late" name="มาสาย" fill="#FF870F" radius={[4, 4, 0, 0]} />
                <Bar dataKey="absent" name="ขาดงาน" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="flex items-center gap-6 mt-3 justify-center">
            {[
              { label: "มาทำงาน", color: "#87FF0F" },
              { label: "มาสาย", color: "#FF870F" },
              { label: "ขาดงาน", color: "#ef4444" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ background: l.color }} />
                <span className="text-xs text-muted-foreground">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Leave Pie Chart */}
        <div className="card-base p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold font-display">สรุปการลา</h3>
              <p className="text-xs text-muted-foreground mt-0.5">เดือนนี้ รวม {totalLeaveDays} วัน</p>
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-[200px] w-full rounded-xl" />
          ) : leavePieData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">ยังไม่มีข้อมูลการลา</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={leavePieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {leavePieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="space-y-2 mt-2">
            {leavePieData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                  <span className="text-xs text-muted-foreground">{item.name}</span>
                </div>
                <span className="text-xs font-semibold">{item.value} วัน</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="card-base p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold font-display">กิจกรรมล่าสุด</h3>
          </div>
          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)
            ) : recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีกิจกรรม</p>
            ) : (
              recentActivity.map((act) => (
                <div key={act.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      background: act.status === "success" ? "hsl(90 100% 92%)" : act.status === "pending" ? "hsl(31 100% 93%)" : "hsl(220 90% 93%)",
                      color: act.status === "success" ? "hsl(90 100% 30%)" : act.status === "pending" ? "#FF870F" : "hsl(220 90% 40%)",
                    }}
                  >
                    {act.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight truncate">{act.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{act.action}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">{act.time}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${act.status === "success" ? "badge-present" : act.status === "pending" ? "badge-late" : "badge-leave"}`}>
                      {act.status === "success" ? "อนุมัติ" : act.status === "pending" ? "รออนุมัติ" : "ข้อมูล"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Department Status */}
        <div className="card-base p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold font-display">{viewType === "manager" ? "สถิติแผนกของฉัน" : "สถิติตามแผนก"}</h3>
          </div>
          <div className="space-y-4">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-xl" />)
            ) : deptStats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีข้อมูลแผนก</p>
            ) : (
              deptStats.map((dept) => {
                const percentage = dept.count > 0 ? Math.round((dept.present / dept.count) * 100) : 0;
                return (
                  <div key={dept.dept}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium">{dept.dept}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{dept.present}/{dept.count}</span>
                        <span className="text-xs font-bold" style={{ color: percentage >= 90 ? "hsl(90 100% 35%)" : "#FF870F" }}>{percentage}%</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percentage}%`, background: percentage >= 90 ? "linear-gradient(90deg, #87FF0F, #5ce600)" : "linear-gradient(90deg, #FF870F, #FF9A3C)" }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-5 p-4 rounded-xl" style={{ background: "hsl(var(--muted))" }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">OT สะสมเดือนนี้</p>
                <p className="text-xs text-muted-foreground mt-0.5">{scopeLabel}</p>
              </div>
              <div className="text-right">
                {loading ? <Skeleton className="h-8 w-12" /> : (
                  <p className="text-2xl font-bold font-display" style={{ color: "#FF870F" }}>{monthOtHours}</p>
                )}
                <p className="text-xs text-muted-foreground">ชั่วโมง</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
