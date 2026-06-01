import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmployees } from "@/contexts/EmployeeContext";
import {
  calculateAnnualIncome, calculateMonthlyTax, formatCurrency,
  DEFAULT_TAX_DEDUCTION, type TaxConfig,
} from "@/utils/taxCalculation";
import { exportPnd1Excel, exportPnd1Pdf, exportAllPayslipsExcel } from "@/utils/exportPayroll";
import {
  exportLeaveSummaryExcel, exportLeaveSummaryPdf,
  exportLeaveBalanceExcel, exportLeaveBalancePdf,
  exportLeaveYearlyExcel, exportLeaveYearlyPdf,
} from "@/utils/exportLeaveReports";
import {
  exportEmployeeReportExcel,
  exportOvertimeReportExcel,
  exportShiftReportExcel,
  exportShiftChangeLogExcel,
  exportPayrollSummaryExcel,
  exportTaxAnnualExcel,
} from "@/utils/exportGenericReports";
import { toast } from "sonner";
import {
  Users,
  GitBranch,
  Clock,
  CalendarDays,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  BarChart3,
  TrendingUp,
  PieChart,
  Calendar,
  Building2,
  UserCheck,
  UserX,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  
  RefreshCw,
  Banknote,
  Receipt,
  ShieldCheck,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  Area,
  AreaChart,
} from "recharts";

// --- Types ---
type ReportCategory = "employees" | "overtime" | "attendance" | "leave" | "shifts" | "payroll";
type ExportFormat = "excel" | "pdf";

interface ReportType {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  category: ReportCategory;
}

// --- Report definitions ---
const reportTypes: ReportType[] = [
  // Employees
  { id: "emp-all", name: "รายชื่อพนักงานทั้งหมด", description: "ข้อมูลพนักงานทุกคนในระบบ แบ่งตามแผนก ประเภท สถานะ", icon: Users, category: "employees" },
  { id: "emp-new", name: "พนักงานเข้าใหม่", description: "รายงานพนักงานเข้าใหม่ตามช่วงเวลา", icon: UserCheck, category: "employees" },
  { id: "emp-resign", name: "พนักงานลาออก / พ้นสภาพ", description: "สรุปพนักงานที่ลาออกหรือพ้นสภาพตามช่วงเวลา", icon: UserX, category: "employees" },
  { id: "emp-birthday", name: "วันเกิดพนักงาน", description: "รายงานวันเกิดพนักงานรายเดือน", icon: Calendar, category: "employees" },
  // Overtime
  { id: "ot-summary", name: "สรุป OT ประจำเดือน", description: "ภาพรวมชั่วโมง OT แยกตามพนักงานในแต่ละเดือน", icon: Clock, category: "overtime" },
  { id: "ot-by-type", name: "OT แยกตามประเภท", description: "สรุปชั่วโมง OT แยกตามประเภท (วันทำงาน/วันหยุด/วันนักขัตฤกษ์)", icon: PieChart, category: "overtime" },
  { id: "ot-trend", name: "แนวโน้ม OT รายเดือน", description: "กราฟแสดงแนวโน้มชั่วโมง OT และจำนวนคำขอตลอดทั้งปี", icon: TrendingUp, category: "overtime" },
  // Attendance
  { id: "att-daily", name: "รายงานเข้างานรายวัน", description: "สรุปเวลาเข้า-ออกงานของพนักงานรายวัน", icon: Clock, category: "attendance" },
  { id: "att-monthly", name: "สรุปเข้างานรายเดือน", description: "สถิติการเข้างาน มาสาย ขาดงาน ประจำเดือน", icon: BarChart3, category: "attendance" },
  { id: "att-late", name: "รายงานมาสาย", description: "รายชื่อพนักงานที่มาสายพร้อมสถิติ", icon: AlertTriangle, category: "attendance" },
  { id: "att-ot", name: "รายงาน OT", description: "สรุปชั่วโมง OT และค่าตอบแทนรายบุคคล", icon: TrendingUp, category: "attendance" },
  // Leave
  { id: "leave-summary", name: "สรุปการลาประจำเดือน", description: "จำนวนวันลาแยกตามประเภทและพนักงาน", icon: CalendarDays, category: "leave" },
  { id: "leave-balance", name: "โควต้าการลาคงเหลือ", description: "ยอดวันลาคงเหลือของพนักงานทุกคน", icon: CheckCircle2, category: "leave" },
  { id: "leave-yearly", name: "สรุปการลาประจำปี", description: "ภาพรวมการลาทั้งปีงบประมาณ", icon: BarChart3, category: "leave" },
  // Shifts
  { id: "shift-summary", name: "สรุปกะการทำงานรายเดือน", description: "ภาพรวมจำนวนพนักงานแยกตามประเภทกะในแต่ละเดือน", icon: Clock, category: "shifts" },
  { id: "shift-employee", name: "ตารางกะรายบุคคล", description: "รายงานกะที่มอบหมายให้พนักงานแต่ละคน", icon: Users, category: "shifts" },
  { id: "shift-coverage", name: "ความครอบคลุมกะ", description: "วิเคราะห์ช่วงเวลาที่มี/ไม่มีพนักงานปฏิบัติงาน", icon: BarChart3, category: "shifts" },
  { id: "shift-change", name: "ประวัติการเปลี่ยนกะ", description: "บันทึกการสลับ/เปลี่ยนกะของพนักงาน", icon: RefreshCw, category: "shifts" },
  // Payroll
  { id: "payroll-summary", name: "สรุปเงินเดือนรายเดือน", description: "ยอดรวมเงินเดือน OT เบี้ยขยัน และรายการหักทั้งหมด", icon: Banknote, category: "payroll" },
  { id: "payroll-pnd1", name: "ภ.ง.ด.1 รายเดือน", description: "รายงานภาษีหัก ณ ที่จ่ายรายเดือนตามแบบ ภ.ง.ด.1", icon: Receipt, category: "payroll" },
  { id: "payroll-tax-annual", name: "ภาษีสะสมรายปี", description: "กราฟและตารางภาษีสะสมรายเดือนตลอดปีงบประมาณ", icon: ShieldCheck, category: "payroll" },
];

const categories: { key: ReportCategory; label: string; icon: React.ElementType; color: string }[] = [
  { key: "employees", label: "ข้อมูลพนักงาน", icon: Users, color: "#FF870F" },
  { key: "overtime", label: "ระบบโอที", icon: Clock, color: "#87FF0F" },
  { key: "attendance", label: "บันทึกเวลา", icon: Clock, color: "#6B7280" },
  { key: "leave", label: "ระบบลางาน", icon: CalendarDays, color: "#FF870F" },
  { key: "shifts", label: "ระบบกะงาน", icon: Clock, color: "#a855f7" },
  { key: "payroll", label: "เงินเดือน/ภาษี", icon: Banknote, color: "#0ea5e9" },
];

// --- Mock chart data ---
const attendanceMonthly = [
  { month: "ม.ค.", ปกติ: 420, สาย: 18, ขาด: 5 },
  { month: "ก.พ.", ปกติ: 410, สาย: 22, ขาด: 8 },
  { month: "มี.ค.", ปกติ: 430, สาย: 15, ขาด: 3 },
  { month: "เม.ย.", ปกติ: 400, สาย: 25, ขาด: 10 },
  { month: "พ.ค.", ปกติ: 425, สาย: 20, ขาด: 6 },
  { month: "มิ.ย.", ปกติ: 435, สาย: 12, ขาด: 4 },
];

const defaultLeavePieColors = ["#FF870F", "#9CA3AF", "#87FF0F", "#E5E5E5", "#3b82f6", "#a855f7", "#ef4444", "#14b8a6"];

// Mock data removed - employee data now fetched from database

const mockAttendanceTable = [
  { id: "EMP-001", name: "สมชาย ใจดี", date: "20/02/2569", checkIn: "08:02", checkOut: "17:15", status: "ปกติ", hours: "9:13" },
  { id: "EMP-002", name: "สมหญิง รักงาน", date: "20/02/2569", checkIn: "08:45", checkOut: "17:30", status: "สาย", hours: "8:45" },
  { id: "EMP-003", name: "วิชัย เก่งกาจ", date: "20/02/2569", checkIn: "07:55", checkOut: "18:00", status: "ปกติ", hours: "10:05" },
  { id: "EMP-004", name: "นภา สดใส", date: "20/02/2569", checkIn: "09:10", checkOut: "17:00", status: "สาย", hours: "7:50" },
  { id: "EMP-005", name: "ประภาส มั่นคง", date: "20/02/2569", checkIn: "08:00", checkOut: "17:00", status: "ปกติ", hours: "9:00" },
];

// mockLeaveTable removed - now fetched from database

// Shift mock data removed - now fetched from database

// --- Payroll mock data removed - now computed from database ---

const fiscalYears = Array.from({ length: 4 }, (_, i) => String(new Date().getFullYear() + 543 - i));
const months = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

// Parse Thai date "DD/MM/YYYY(BE)" to { ceYear, month, day }
const parseThaiDate = (dateStr: string): { ceYear: number; month: number; day: number } | null => {
  if (!dateStr) return null;
  // Handle DD/MM/YYYY format (Thai BE or CE)
  const slashParts = dateStr.split("/");
  if (slashParts.length === 3) {
    const day = parseInt(slashParts[0]);
    const month = parseInt(slashParts[1]);
    let year = parseInt(slashParts[2]);
    if (year > 2400) year -= 543; // Convert BE to CE
    return { ceYear: year, month, day };
  }
  // Handle YYYY-MM-DD format (ISO)
  const isoParts = dateStr.split("-");
  if (isoParts.length === 3) {
    let year = parseInt(isoParts[0]);
    if (year > 2400) year -= 543;
    return { ceYear: year, month: parseInt(isoParts[1]), day: parseInt(isoParts[2]) };
  }
  return null;
};

const currentDate = new Date();
const currentThaiYear = String(currentDate.getFullYear() + 543);
const currentMonthName = months[currentDate.getMonth()];

const Reports = () => {
  const { employees } = useEmployees();
  const [activeCategory, setActiveCategory] = useState<ReportCategory | null>(null);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState(currentThaiYear);
  const [filterMonth, setFilterMonth] = useState(currentMonthName);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({ employees: true, overtime: true, attendance: true, leave: true, shifts: true, payroll: true });
  const [empStatusFilter, setEmpStatusFilter] = useState<string[]>(["active", "inactive", "leave"]);

  // --- Real leave data ---
  const [leaveData, setLeaveData] = useState<any[]>([]);
  const [leavePieData, setLeavePieData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveBalanceData, setLeaveBalanceData] = useState<any[]>([]);
  const [leaveYearlyData, setLeaveYearlyData] = useState<any[]>([]);
  const [leaveYearlyChartData, setLeaveYearlyChartData] = useState<any[]>([]);
  const [leaveMonthlyBarData, setLeaveMonthlyBarData] = useState<any[]>([]);

  // --- Real OT data ---
  const [otData, setOtData] = useState<any[]>([]);
  const [otLoading, setOtLoading] = useState(false);
  const [otPieData, setOtPieData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [otMonthlyChartData, setOtMonthlyChartData] = useState<any[]>([]);

  // --- Real Shift data ---
  const [shiftData, setShiftData] = useState<any[]>([]);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [shiftDistribution, setShiftDistribution] = useState<any[]>([]);
  const [shiftPieData, setShiftPieData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [shiftCoverageData, setShiftCoverageData] = useState<any[]>([]);
  const [shiftChangeLog, setShiftChangeLog] = useState<any[]>([]);

  // --- Real Employee data ---
  const [empTableData, setEmpTableData] = useState<any[]>([]);
  const [empHeadcountData, setEmpHeadcountData] = useState<{ dept: string; count: number }[]>([]);
  const [empHiringTrend, setEmpHiringTrend] = useState<any[]>([]);
  const [empLoading, setEmpLoading] = useState(false);

  // --- Real Payroll data ---
  const [payrollSummaryData, setPayrollSummaryData] = useState<any[]>([]);
  const [taxCumulativeData, setTaxCumulativeData] = useState<any[]>([]);
  const [payrollLoading, setPayrollLoading] = useState(false);

  const monthIndexMap: Record<string, number> = {
    "มกราคม": 1, "กุมภาพันธ์": 2, "มีนาคม": 3, "เมษายน": 4,
    "พฤษภาคม": 5, "มิถุนายน": 6, "กรกฎาคม": 7, "สิงหาคม": 8,
    "กันยายน": 9, "ตุลาคม": 10, "พฤศจิกายน": 11, "ธันวาคม": 12,
  };

  const monthShortNames = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

  const fetchLeaveData = useCallback(async () => {
    setLeaveLoading(true);
    try {
      const ceYear = parseInt(filterYear) - 543;
      const monthNum = monthIndexMap[filterMonth] || 1;

      const { data, error } = await supabase
        .from("leave_requests")
        .select("*, employees!leave_requests_employee_id_fkey(first_name, last_name, username)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Filter client-side by parsing dates
      const filtered = (data || []).filter((r: any) => {
        const parsed = parseThaiDate(r.date_from);
        if (!parsed) return false;
        return parsed.ceYear === ceYear && parsed.month === monthNum;
      });

      const rows = filtered.map((r: any) => ({
        name: r.employees ? `${r.employees.first_name} ${r.employees.last_name}` : "ไม่ทราบ",
        empId: r.employees?.username || "-",
        type: r.leave_type_name || "-",
        from: r.date_from,
        to: r.date_to,
        days: Number(r.days),
        status: r.status === "approved" ? "อนุมัติ" : r.status === "rejected" ? "ไม่อนุมัติ" : "รออนุมัติ",
      }));
      setLeaveData(rows);

      // Build pie data
      const typeMap: Record<string, number> = {};
      rows.forEach((r: any) => {
        typeMap[r.type] = (typeMap[r.type] || 0) + r.days;
      });
      const pieEntries = Object.entries(typeMap).map(([name, value], i) => ({
        name,
        value: value as number,
        color: defaultLeavePieColors[i % defaultLeavePieColors.length],
      }));
      setLeavePieData(pieEntries);
    } catch (err) {
      console.error("Error fetching leave data:", err);
    } finally {
      setLeaveLoading(false);
    }
  }, [filterYear, filterMonth]);

  // Fetch leave balance (quota remaining) for all employees
  const fetchLeaveBalance = useCallback(async () => {
    setLeaveLoading(true);
    try {
      const ceYear = parseInt(filterYear) - 543;

      const [typesRes, requestsRes, empsRes] = await Promise.all([
        supabase.from("leave_types").select("*").order("sort_order"),
        supabase.from("leave_requests").select("employee_id, leave_type_id, leave_type_name, date_from, days, status")
          .neq("status", "rejected"),
        supabase.from("employees").select("id, first_name, last_name, username, role").eq("status", "active"),
      ]);

      const leaveTypes = typesRes.data || [];
      const allRequests = requestsRes.data || [];
      const emps = (empsRes.data || []).filter((e: any) => (e.role || "").toLowerCase() !== "admin");

      // Filter by year client-side
      const requests = allRequests.filter((r: any) => {
        const parsed = parseThaiDate(r.date_from);
        return parsed && parsed.ceYear === ceYear;
      });

      // Group used days per employee per leave type
      const usedMap: Record<string, Record<string, number>> = {};
      requests.forEach((r: any) => {
        if (!usedMap[r.employee_id]) usedMap[r.employee_id] = {};
        const key = r.leave_type_id;
        usedMap[r.employee_id][key] = (usedMap[r.employee_id][key] || 0) + Number(r.days);
      });

      const balanceRows = emps.map((emp: any) => {
        const row: any = {
          empId: emp.username || "-",
          name: `${emp.first_name} ${emp.last_name}`,
        };
        let totalQuota = 0;
        let totalUsed = 0;
        leaveTypes.forEach((lt: any) => {
          const used = usedMap[emp.id]?.[lt.id] || 0;
          row[`${lt.name}_quota`] = lt.quota;
          row[`${lt.name}_used`] = used;
          row[`${lt.name}_remaining`] = lt.quota - used;
          totalQuota += lt.quota;
          totalUsed += used;
        });
        row.totalQuota = totalQuota;
        row.totalUsed = totalUsed;
        row.totalRemaining = totalQuota - totalUsed;
        return row;
      });

      setLeaveBalanceData(balanceRows);

      // Build pie for balance overview
      const overallTypeUsage: Record<string, number> = {};
      requests.forEach((r: any) => {
        const name = r.leave_type_name || "อื่นๆ";
        overallTypeUsage[name] = (overallTypeUsage[name] || 0) + Number(r.days);
      });
      const pieEntries = Object.entries(overallTypeUsage).map(([name, value], i) => ({
        name, value: value as number,
        color: leaveTypes.find((lt: any) => lt.name === name)?.color || defaultLeavePieColors[i % defaultLeavePieColors.length],
      }));
      setLeavePieData(pieEntries);
    } catch (err) {
      console.error("Error fetching leave balance:", err);
    } finally {
      setLeaveLoading(false);
    }
  }, [filterYear]);

  // Fetch yearly leave summary
  const fetchLeaveYearly = useCallback(async () => {
    setLeaveLoading(true);
    try {
      const ceYear = parseInt(filterYear) - 543;

      const [requestsRes, typesRes] = await Promise.all([
        supabase.from("leave_requests").select("date_from, leave_type_name, days, status")
          .neq("status", "rejected"),
        supabase.from("leave_types").select("name, color").order("sort_order"),
      ]);

      const allRequests = requestsRes.data || [];
      const leaveTypes = typesRes.data || [];
      const typeNames = leaveTypes.map((lt: any) => lt.name);

      // Filter by year client-side
      const requests = allRequests.filter((r: any) => {
        const parsed = parseThaiDate(r.date_from);
        return parsed && parsed.ceYear === ceYear;
      });

      // Aggregate by month
      const monthlyMap: Record<number, Record<string, number>> = {};
      for (let m = 1; m <= 12; m++) monthlyMap[m] = {};

      requests.forEach((r: any) => {
        const parsed = parseThaiDate(r.date_from);
        if (!parsed) return;
        const name = r.leave_type_name || "อื่นๆ";
        monthlyMap[parsed.month][name] = (monthlyMap[parsed.month][name] || 0) + Number(r.days);
      });

      const chartData = monthShortNames.map((label, i) => {
        const row: any = { month: label };
        let total = 0;
        typeNames.forEach((tn: string) => {
          const val = monthlyMap[i + 1][tn] || 0;
          row[tn] = val;
          total += val;
        });
        row["รวม"] = total;
        return row;
      });

      setLeaveYearlyChartData(chartData);
      setLeaveMonthlyBarData(chartData);

      // Build yearly summary table (by type)
      const yearlyRows = typeNames.map((tn: string) => {
        let total = 0;
        const monthValues: Record<string, number> = {};
        monthShortNames.forEach((label, i) => {
          const val = monthlyMap[i + 1][tn] || 0;
          monthValues[label] = val;
          total += val;
        });
        return { type: tn, ...monthValues, total, color: leaveTypes.find((lt: any) => lt.name === tn)?.color || "#6B7280" };
      });
      setLeaveYearlyData(yearlyRows);

      // Pie data for yearly
      const pieEntries = yearlyRows.filter(r => r.total > 0).map((r, i) => ({
        name: r.type, value: r.total,
        color: r.color || defaultLeavePieColors[i % defaultLeavePieColors.length],
      }));
      setLeavePieData(pieEntries);
    } catch (err) {
      console.error("Error fetching yearly leave:", err);
    } finally {
      setLeaveLoading(false);
    }
  }, [filterYear]);

  // --- Fetch OT data ---
  const fetchOtData = useCallback(async () => {
    setOtLoading(true);
    try {
      const ceYear = parseInt(filterYear) - 543;
      const monthNum = monthIndexMap[filterMonth] || 1;
      const startDate = `${ceYear}-${String(monthNum).padStart(2, '0')}-01`;
      const endDay = new Date(ceYear, monthNum, 0).getDate();
      const endDate = `${ceYear}-${String(monthNum).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from("overtime_requests")
        .select("*, employees!overtime_requests_employee_id_fkey(first_name, last_name, username, dept)")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });

      if (error) throw error;

      const rows = (data || []).map((r: any) => {
        const emp = r.employees;
        const name = emp ? `${emp.first_name} ${emp.last_name}` : "ไม่ทราบ";
        const dept = emp?.dept || "-";
        const statusMap: Record<string, string> = { pending: "รออนุมัติ", approved: "อนุมัติ", rejected: "ไม่อนุมัติ" };
        const otTypeMap: Record<string, string> = { workday: "วันทำงาน", holiday: "วันหยุด", special: "วันนักขัตฤกษ์" };
        return {
          id: r.id,
          empId: emp?.username || "-",
          name,
          dept,
          date: r.date,
          startTime: r.start_time,
          endTime: r.end_time,
          hours: r.hours,
          otType: otTypeMap[r.ot_type] || r.ot_type,
          rawOtType: r.ot_type,
          status: statusMap[r.status] || r.status,
          reason: r.reason,
        };
      });

      setOtData(rows);

      // Pie by type
      const typeGroups: Record<string, number> = {};
      rows.forEach((r: any) => { typeGroups[r.otType] = (typeGroups[r.otType] || 0) + r.hours; });
      const otTypeColors: Record<string, string> = { "วันทำงาน": "#3b82f6", "วันหยุด": "#FF870F", "วันนักขัตฤกษ์": "#ef4444" };
      setOtPieData(Object.entries(typeGroups).map(([name, value]) => ({
        name, value, color: otTypeColors[name] || "#9CA3AF",
      })));
    } catch (err) {
      console.error("Error fetching OT data:", err);
    } finally {
      setOtLoading(false);
    }
  }, [filterYear, filterMonth]);

  const fetchOtTrend = useCallback(async () => {
    setOtLoading(true);
    try {
      const ceYear = parseInt(filterYear) - 543;
      const { data, error } = await supabase
        .from("overtime_requests")
        .select("date, hours, status")
        .gte("date", `${ceYear}-01-01`)
        .lte("date", `${ceYear}-12-31`);

      if (error) throw error;

      const monthlyMap: Record<number, { hours: number; count: number }> = {};
      for (let i = 1; i <= 12; i++) monthlyMap[i] = { hours: 0, count: 0 };
      (data || []).forEach((r: any) => {
        const m = parseInt(r.date.split("-")[1]);
        if (monthlyMap[m]) {
          monthlyMap[m].hours += r.hours || 0;
          monthlyMap[m].count += 1;
        }
      });

      setOtMonthlyChartData(monthShortNames.map((label, i) => ({
        month: label,
        ชั่วโมงOT: Math.round(monthlyMap[i + 1].hours * 100) / 100,
        จำนวนคำขอ: monthlyMap[i + 1].count,
      })));
    } catch (err) {
      console.error("Error fetching OT trend:", err);
    } finally {
      setOtLoading(false);
    }
  }, [filterYear]);

  // --- Fetch Shift data ---
  const fetchShiftData = useCallback(async () => {
    setShiftLoading(true);
    try {
      const ceYear = parseInt(filterYear) - 543;
      const monthNum = monthIndexMap[filterMonth] || 1;

      const [shiftsRes, assignmentsRes, empsRes] = await Promise.all([
        supabase.from("shifts").select("*").order("sort_order"),
        supabase.from("shift_assignments").select("*"),
        supabase.from("employees").select("id, first_name, last_name, username, dept, shift, role").eq("status", "active"),
      ]);

      const shifts = shiftsRes.data || [];
      const assignments = assignmentsRes.data || [];
      const emps = (empsRes.data || []);

      const empMap = new Map(emps.map((e: any) => [e.id, e]));
      const shiftMap = new Map(shifts.map((s: any) => [s.id, s]));

      // Filter assignments by selected month/year
      const filteredAssignments = assignments.filter((a: any) => {
        const parsed = parseThaiDate(a.start_date);
        if (!parsed) return false;
        return parsed.ceYear === ceYear && parsed.month === monthNum;
      });

      // Build table data
      const tableRows = filteredAssignments
        .map((a: any) => {
          const emp = empMap.get(a.employee_id);
          const shift = shiftMap.get(a.shift_id);
          return {
            id: emp?.username || "-",
            name: emp ? `${emp.first_name} ${emp.last_name}` : "ไม่ทราบ",
            dept: emp?.dept || "-",
            shift: shift?.name || "-",
            shiftColor: shift?.color || "#6B7280",
            period: `${a.start_date} - ${a.end_date}`,
            assignmentType: a.assignment_type,
            status: "ปฏิบัติงาน",
            _role: (emp?.role || "").toLowerCase(),
          };
        })
        .filter((r: any) => r._role !== "admin");
      setShiftData(tableRows);

      // Pie: count employees per shift
      const shiftCounts: Record<string, { count: number; color: string }> = {};
      tableRows.forEach((r: any) => {
        if (!shiftCounts[r.shift]) shiftCounts[r.shift] = { count: 0, color: r.shiftColor };
        shiftCounts[r.shift].count++;
      });
      setShiftPieData(Object.entries(shiftCounts).map(([name, v]) => ({
        name, value: v.count, color: v.color,
      })));

      // Monthly distribution chart (all year)
      const yearAssignments = assignments.filter((a: any) => {
        const parsed = parseThaiDate(a.start_date);
        return parsed && parsed.ceYear === ceYear;
      });

      const monthlyShiftMap: Record<number, Record<string, number>> = {};
      for (let m = 1; m <= 12; m++) monthlyShiftMap[m] = {};

      yearAssignments.forEach((a: any) => {
        const parsed = parseThaiDate(a.start_date);
        if (!parsed) return;
        const shift = shiftMap.get(a.shift_id);
        const shiftName = shift?.name || "อื่นๆ";
        monthlyShiftMap[parsed.month][shiftName] = (monthlyShiftMap[parsed.month][shiftName] || 0) + 1;
      });

      const shiftNames = shifts.map((s: any) => s.name);
      setShiftDistribution(monthShortNames.map((label, i) => {
        const row: any = { month: label };
        shiftNames.forEach((sn: string) => { row[sn] = monthlyShiftMap[i + 1][sn] || 0; });
        return row;
      }));

      // Coverage data: group by shift time ranges
      const coverageMap: Record<string, number> = {};
      const timeSlots = ["00:00-06:00", "06:00-08:00", "08:00-12:00", "12:00-14:00", "14:00-17:00", "17:00-22:00", "22:00-00:00"];
      timeSlots.forEach(t => { coverageMap[t] = 0; });

      filteredAssignments.forEach((a: any) => {
        const shift = shiftMap.get(a.shift_id);
        if (!shift) return;
        const startH = parseInt(shift.start_time?.split(":")[0] || "0");
        const endH = parseInt(shift.end_time?.split(":")[0] || "0");
        timeSlots.forEach(slot => {
          const slotStart = parseInt(slot.split("-")[0].split(":")[0]);
          const slotEnd = parseInt(slot.split("-")[1].split(":")[0]) || 24;
          if (endH > startH) {
            if (startH < slotEnd && endH > slotStart) coverageMap[slot]++;
          } else {
            // Overnight shift
            if (startH < slotEnd || endH > slotStart) coverageMap[slot]++;
          }
        });
      });
      setShiftCoverageData(timeSlots.map(t => ({ time: t, จำนวนพนักงาน: coverageMap[t] })));

      // Change log: find "day" type assignments (individual overrides)
      const dayAssignments = filteredAssignments.filter((a: any) => {
        if (a.assignment_type !== "day") return false;
        const emp = empMap.get(a.employee_id);
        return (emp?.role || "").toLowerCase() !== "admin";
      });
      setShiftChangeLog(dayAssignments.map((a: any) => {
        const emp = empMap.get(a.employee_id);
        const shift = shiftMap.get(a.shift_id);
        return {
          id: emp?.username || "-",
          name: emp ? `${emp.first_name} ${emp.last_name}` : "ไม่ทราบ",
          fromShift: emp?.shift || "-",
          toShift: shift?.name || "-",
          toShiftColor: shift?.color || "#6B7280",
          date: a.start_date,
          reason: "มอบหมายกะรายวัน",
        };
      }));

    } catch (err) {
      console.error("Error fetching shift data:", err);
    } finally {
      setShiftLoading(false);
    }
  }, [filterYear, filterMonth]);

  // --- Fetch Employee data ---
  const fetchEmployeeData = useCallback(async () => {
    setEmpLoading(true);
    try {
      const ceYear = parseInt(filterYear) - 543;
      const monthNum = monthIndexMap[filterMonth] || 1;

      const { data: allEmps, error } = await supabase
        .from("employees")
        .select("id, username, first_name, last_name, dept, position, employee_type, start_date, status, role")
        .order("created_at", { ascending: false });

      if (error) throw error;
      const emps = (allEmps || []).filter((e: any) => (e.role || "").toLowerCase() !== "admin");

      // Determine which employees to show based on report type
      if (selectedReport === "emp-all") {
        setEmpTableData(emps.map((e: any) => ({
          id: e.username || "-",
          name: `${e.first_name} ${e.last_name}`,
          dept: e.dept || "-",
          position: e.position || "-",
          type: e.employee_type || "-",
          startDate: e.start_date || "-",
          status: e.status === "active" ? "ทำงาน" : e.status === "inactive" ? "ลาพัก" : e.status === "leave" ? "ลาออก" : e.status || "-",
          rawStatus: e.status,
        })));
      } else if (selectedReport === "emp-new") {
        // New employees in the selected month/year
        const newEmps = emps.filter((e: any) => {
          const parsed = parseThaiDate(e.start_date);
          return parsed && parsed.ceYear === ceYear && parsed.month === monthNum;
        });
        setEmpTableData(newEmps.map((e: any) => ({
          id: e.username || "-",
          name: `${e.first_name} ${e.last_name}`,
          dept: e.dept || "-",
          position: e.position || "-",
          type: e.employee_type || "-",
          startDate: e.start_date || "-",
          status: "เข้าใหม่",
          rawStatus: "new",
        })));
      } else if (selectedReport === "emp-resign") {
        const resigned = emps.filter((e: any) => e.status === "resigned" || e.status === "inactive");
        setEmpTableData(resigned.map((e: any) => ({
          id: e.username || "-",
          name: `${e.first_name} ${e.last_name}`,
          dept: e.dept || "-",
          position: e.position || "-",
          type: e.employee_type || "-",
          startDate: e.start_date || "-",
          status: e.status === "resigned" ? "ลาออก" : "พ้นสภาพ",
          rawStatus: e.status,
        })));
      } else if (selectedReport === "emp-birthday") {
        const birthdayEmps = emps.filter((e: any) => {
          if (!e.status || e.status !== "active") return false;
          // Need birth_date - refetch with it
          return true;
        });
        // We need birth_date, so re-fetch
        const { data: bdEmps } = await supabase
          .from("employees")
          .select("username, first_name, last_name, dept, position, birth_date, status, role")
          .eq("status", "active");
        const filtered = (bdEmps || []).filter((e: any) => {
          if ((e.role || "").toLowerCase() === "admin") return false;
          const parsed = parseThaiDate(e.birth_date);
          return parsed && parsed.month === monthNum;
        });
        setEmpTableData(filtered.map((e: any) => ({
          id: e.username || "-",
          name: `${e.first_name} ${e.last_name}`,
          dept: e.dept || "-",
          position: e.position || "-",
          type: "-",
          startDate: e.birth_date || "-",
          status: "ทำงาน",
          rawStatus: "active",
        })));
      }

      // Headcount by department (active only)
      const activeEmps = emps.filter((e: any) => e.status === "active");
      const deptMap: Record<string, number> = {};
      activeEmps.forEach((e: any) => {
        const d = e.dept || "ไม่ระบุ";
        deptMap[d] = (deptMap[d] || 0) + 1;
      });
      setEmpHeadcountData(Object.entries(deptMap).map(([dept, count]) => ({ dept, count })).sort((a, b) => b.count - a.count));

      // Hiring trend: count new employees by month for the selected year
      const trendData = monthShortNames.map((mName, idx) => {
        const mNum = idx + 1;
        const newCount = emps.filter((e: any) => {
          const parsed = parseThaiDate(e.start_date);
          return parsed && parsed.ceYear === ceYear && parsed.month === mNum;
        }).length;
        const resignCount = emps.filter((e: any) => {
          // Approximate: resigned employees whose start was in this month
          // Since we don't have resign_date, we show 0 for resign trend
          return false;
        }).length;
        return { month: mName, เข้าใหม่: newCount, ลาออก: resignCount };
      });
      setEmpHiringTrend(trendData);

    } catch (err) {
      console.error("Error fetching employee data:", err);
    } finally {
      setEmpLoading(false);
    }
  }, [filterYear, filterMonth, selectedReport]);

  // --- Fetch Payroll data ---
  const fetchPayrollData = useCallback(async () => {
    setPayrollLoading(true);
    try {
      const ceYear = parseInt(filterYear) - 543;
      const taxConfig: TaxConfig = { enabled: true, method: "progressive", flatRate: 5 };

      // Fetch active employees with salary
      const { data: empsDataRaw } = await supabase
        .from("employees")
        .select("id, first_name, last_name, salary, tax_deductions, pvd_rate, children, children_after_2018, status, role")
        .eq("status", "active");
      const empsData = (empsDataRaw || []).filter((e: any) => (e.role || "").toLowerCase() !== "admin");

      // Fetch approved OT for the year
      const { data: otDataRaw } = await supabase
        .from("overtime_requests")
        .select("date, hours, status")
        .eq("status", "approved");

      // Fetch custom payroll items
      const { data: customItems } = await supabase
        .from("employee_custom_payroll_items")
        .select("employee_id, amount, type, enabled")
        .eq("enabled", true);

      // Fetch published payroll periods for this year - only show months that have been published
      const { data: periodsData } = await supabase
        .from("payroll_periods")
        .select("month, status")
        .eq("year", ceYear)
        .eq("status", "published");
      const publishedMonths = new Set((periodsData || []).map((p: any) => p.month));

      const activeEmps = empsData || [];
      const allOt = (otDataRaw || []).filter((o: any) => {
        const parsed = parseThaiDate(o.date);
        return parsed && parsed.ceYear === ceYear;
      });

      // Calculate total salary per month
      const totalMonthlySalary = activeEmps.reduce((s, e: any) => s + (Number(e.salary) || 0), 0);

      // Calculate total monthly tax
      const totalMonthlyTax = activeEmps.reduce((s, e: any) => {
        const salary = Number(e.salary) || 0;
        const annualIncome = calculateAnnualIncome(salary);
        const deductions = e.tax_deductions || DEFAULT_TAX_DEDUCTION;
        return s + calculateMonthlyTax(taxConfig, annualIncome, deductions);
      }, 0);

      // Social security: 5% of salary, max 750 per person per month
      const totalSocialSecurity = activeEmps.reduce((s, e: any) => {
        const salary = Number(e.salary) || 0;
        return s + Math.min(salary * 0.05, 750);
      }, 0);

      // Custom payroll items aggregation (เบี้ยขยัน, etc.)
      const totalCustomIncome = (customItems || [])
        .filter((ci: any) => ci.type === "income")
        .reduce((s, ci: any) => s + (Number(ci.amount) || 0), 0);

      // Build monthly summary data - only for months that have been published
      const summaryData = monthShortNames.map((mName, idx) => {
        const mNum = idx + 1;
        if (!publishedMonths.has(mNum)) return null;
        // OT hours for this month
        const monthOt = allOt.filter((o: any) => {
          const parsed = parseThaiDate(o.date);
          return parsed && parsed.month === mNum;
        });
        const otHours = monthOt.reduce((s: number, o: any) => s + (Number(o.hours) || 0), 0);
        // Approximate OT pay: otHours * average hourly rate * 1.5
        const avgHourlyRate = totalMonthlySalary > 0 && activeEmps.length > 0
          ? (totalMonthlySalary / activeEmps.length) / (30 * 8)
          : 0;
        const otPay = Math.round(otHours * avgHourlyRate * 1.5);

        return {
          month: mName,
          เงินเดือน: totalMonthlySalary,
          OT: otPay,
          เบี้ยขยัน: totalCustomIncome,
          ประกันสังคม: Math.round(totalSocialSecurity),
          ภาษี: Math.round(totalMonthlyTax),
        };
      }).filter(Boolean) as any[];
      setPayrollSummaryData(summaryData);

      // Build tax cumulative data
      let cumulative = 0;
      const taxCumData = summaryData.map((row) => {
        cumulative += row.ภาษี;
        return {
          month: row.month,
          ภาษีสะสม: cumulative,
          ภาษีเดือนนี้: row.ภาษี,
        };
      });
      setTaxCumulativeData(taxCumData);

    } catch (err) {
      console.error("Error fetching payroll data:", err);
    } finally {
      setPayrollLoading(false);
    }
  }, [filterYear]);

  useEffect(() => {
    if (selectedReport === "leave-summary") fetchLeaveData();
    else if (selectedReport === "leave-balance") fetchLeaveBalance();
    else if (selectedReport === "leave-yearly") fetchLeaveYearly();
    else if (selectedReport === "ot-summary" || selectedReport === "ot-by-type") fetchOtData();
    else if (selectedReport === "ot-trend") fetchOtTrend();
    else if (selectedReport?.startsWith("shift-")) fetchShiftData();
    else if (selectedReport?.startsWith("emp-")) fetchEmployeeData();
    else if (selectedReport?.startsWith("payroll-")) fetchPayrollData();
  }, [selectedReport, fetchLeaveData, fetchLeaveBalance, fetchLeaveYearly, fetchOtData, fetchOtTrend, fetchShiftData, fetchEmployeeData, fetchPayrollData]);

  const toggleCat = (cat: string) => setExpandedCats((p) => ({ ...p, [cat]: !p[cat] }));

  const filteredReports = activeCategory ? reportTypes.filter((r) => r.category === activeCategory) : reportTypes;

  const handleExport = async (format: ExportFormat) => {
    const reportId = currentReport?.id;

    // Leave-specific exports
    if (reportId === "leave-summary") {
      if (format === "excel") {
        exportLeaveSummaryExcel(leaveData, filterMonth, filterYear);
        toast.success("ส่งออกสรุปการลาประจำเดือนเป็น Excel สำเร็จ");
      } else {
        await exportLeaveSummaryPdf(leaveData, filterMonth, filterYear);
        toast.success("ส่งออกสรุปการลาประจำเดือนเป็น PDF สำเร็จ");
      }
      return;
    }
    if (reportId === "leave-balance") {
      if (format === "excel") {
        exportLeaveBalanceExcel(leaveBalanceData, filterYear);
        toast.success("ส่งออกโควต้าการลาเป็น Excel สำเร็จ");
      } else {
        await exportLeaveBalancePdf(leaveBalanceData, filterYear);
        toast.success("ส่งออกโควต้าการลาเป็น PDF สำเร็จ");
      }
      return;
    }
    if (reportId === "leave-yearly") {
      if (format === "excel") {
        exportLeaveYearlyExcel(leaveYearlyData, filterYear);
        toast.success("ส่งออกสรุปการลาประจำปีเป็น Excel สำเร็จ");
      } else {
        await exportLeaveYearlyPdf(leaveYearlyData, filterYear);
        toast.success("ส่งออกสรุปการลาประจำปีเป็น PDF สำเร็จ");
      }
      return;
    }

    // Payroll-specific exports
    if (reportId === "payroll-pnd1") {
      if (format === "excel") {
        exportPnd1Excel(employees, filterMonth, filterYear);
        toast.success("ส่งออก ภ.ง.ด.1 เป็น Excel สำเร็จ");
      } else {
        await exportPnd1Pdf(employees, filterMonth, filterYear);
        toast.success("ส่งออก ภ.ง.ด.1 เป็น PDF สำเร็จ");
      }
      return;
    }
    if (reportId === "payroll-summary") {
      if (format === "excel") {
        exportPayrollSummaryExcel(payrollSummaryData, filterYear);
        toast.success("ส่งออกสรุปเงินเดือนรายเดือนเป็น Excel สำเร็จ");
      } else {
        await exportPnd1Pdf(employees, filterMonth, filterYear);
        toast.success("ส่งออกรายงานเป็น PDF สำเร็จ");
      }
      return;
    }
    if (reportId === "payroll-tax-annual") {
      if (format === "excel") {
        const taxConfig: TaxConfig = { enabled: true, method: "progressive", flatRate: 5 };
        const pnd1Rows = employees.filter((e) => e.status === "active").map((emp) => {
          const salary = Number(emp.salary) || 0;
          const annualIncome = calculateAnnualIncome(salary);
          const monthlyTax = calculateMonthlyTax(taxConfig, annualIncome, emp.taxDeductions || DEFAULT_TAX_DEDUCTION);
          return { name: `${emp.firstName} ${emp.lastName}`, salary, annualIncome, monthlyTax };
        });
        exportTaxAnnualExcel(pnd1Rows, filterYear);
        toast.success("ส่งออกภาษีสะสมรายปีเป็น Excel สำเร็จ");
      } else {
        await exportPnd1Pdf(employees, filterMonth, filterYear);
        toast.success("ส่งออกรายงานเป็น PDF สำเร็จ");
      }
      return;
    }

    // Employee reports
    if (reportId?.startsWith("emp-")) {
      if (format === "excel") {
        exportEmployeeReportExcel(empTableData, currentReport?.name || "รายงานข้อมูลพนักงาน", filterMonth, filterYear);
        toast.success("ส่งออกรายงานพนักงานเป็น Excel สำเร็จ");
        return;
      }
    }

    // Overtime reports
    if (reportId?.startsWith("ot-")) {
      if (format === "excel") {
        exportOvertimeReportExcel(otData, currentReport?.name || "รายงาน OT", filterMonth, filterYear);
        toast.success("ส่งออกรายงาน OT เป็น Excel สำเร็จ");
        return;
      }
    }

    // Shift reports
    if (reportId?.startsWith("shift-")) {
      if (format === "excel") {
        if (reportId === "shift-change") {
          exportShiftChangeLogExcel(shiftChangeLog, filterMonth, filterYear);
        } else {
          exportShiftReportExcel(shiftData, currentReport?.name || "รายงานกะ", filterMonth, filterYear);
        }
        toast.success("ส่งออกรายงานกะเป็น Excel สำเร็จ");
        return;
      }
    }

    // Generic fallback
    const label = format === "excel" ? "Excel (.xlsx)" : "PDF";
    toast.info(`ฟังก์ชันส่งออก ${label} สำหรับรายงานนี้จะเปิดใช้งานเร็วๆ นี้`);
  };

  

  const currentReport = reportTypes.find((r) => r.id === selectedReport);

  // --- Render selected report detail ---
  const renderReportDetail = () => {
    if (!currentReport) return null;

    const cat = currentReport.category;

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedReport(null)}
              className="p-2 rounded-xl hover:bg-muted transition-colors"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <div>
              <h2 className="text-lg font-bold font-display">{currentReport.name}</h2>
              <p className="text-sm text-muted-foreground">{currentReport.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => handleExport("excel")} className="report-export-btn">
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel</span>
            </button>
            <button onClick={() => handleExport("pdf")} className="report-export-btn">
              <FileText className="w-4 h-4" />
              <span>PDF</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-muted/50 border border-border">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="text-sm rounded-lg border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
          >
            {fiscalYears.map((y) => (
              <option key={y} value={y}>ปีงบฯ {y}</option>
            ))}
          </select>
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="text-sm rounded-lg border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
          >
            {months.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <button onClick={() => { 
            if (selectedReport === 'leave-summary') fetchLeaveData();
            else if (selectedReport === 'leave-balance') fetchLeaveBalance();
            else if (selectedReport === 'leave-yearly') fetchLeaveYearly();
            else if (selectedReport === 'ot-summary' || selectedReport === 'ot-by-type') fetchOtData();
            else if (selectedReport === 'ot-trend') fetchOtTrend();
            else if (selectedReport?.startsWith('shift-')) fetchShiftData();
            else if (selectedReport?.startsWith('emp-')) fetchEmployeeData();
            else if (selectedReport?.startsWith('payroll-')) fetchPayrollData();
          }} className="ml-auto flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg hover:bg-muted transition-colors" style={{ color: "#FF870F" }}>
            <RefreshCw className="w-3.5 h-3.5" />
            รีเฟรช
          </button>
        </div>

        {/* Chart */}
        {cat === "attendance" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold mb-4">สถิติการเข้างานรายเดือน</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={attendanceMonthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="ปกติ" fill="#87FF0F" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="สาย" fill="#FF870F" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ขาด" fill="#ff4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold mb-4">แนวโน้มการมาสาย</h3>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={attendanceMonthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Area type="monotone" dataKey="สาย" stroke="#FF870F" fill="#FF870F" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {cat === "leave" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold mb-4">สัดส่วนการลาตามประเภท</h3>
              {leavePieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <RechartsPie>
                    <Pie data={leavePieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {leavePieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPie>
                </ResponsiveContainer>
              ) : (
                <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">ไม่มีข้อมูล</div>
              )}
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold mb-4">
                {selectedReport === "leave-yearly" ? "จำนวนวันลาแยกตามเดือน (ข้อมูลจริง)" : "จำนวนวันลาแยกตามเดือน"}
              </h3>
              {(selectedReport === "leave-yearly" && leaveYearlyChartData.length > 0) ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={leaveYearlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="รวม" fill="#FF870F" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : leaveMonthlyBarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={leaveMonthlyBarData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="รวม" fill="#FF870F" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">ไม่มีข้อมูล</div>
              )}
            </div>
          </div>
        )}

        {cat === "employees" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold mb-4">แนวโน้มการรับ-ออก พนักงาน</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={empHiringTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="เข้าใหม่" stroke="#87FF0F" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="ลาออก" stroke="#FF870F" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold mb-4">จำนวนพนักงานตามแผนก</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={empHeadcountData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" fontSize={12} />
                  <YAxis dataKey="dept" type="category" fontSize={12} width={80} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#FF870F" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {cat === "overtime" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold mb-4">
                {currentReport?.id === "ot-trend" ? "ชั่วโมง OT รายเดือน (ทั้งปี)" : "ชั่วโมง OT แยกตามประเภท"}
              </h3>
              {currentReport?.id === "ot-trend" && otMonthlyChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={otMonthlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="ชั่วโมงOT" fill="#87FF0F" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="จำนวนคำขอ" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : otPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <RechartsPie>
                    <Pie data={otPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {otPieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPie>
                </ResponsiveContainer>
              ) : (
                <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">{otLoading ? "กำลังโหลด..." : "ไม่มีข้อมูล"}</div>
              )}
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold mb-4">สถิติ OT ประจำเดือน</h3>
              {otData.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-muted/50">
                    <p className="text-2xl font-bold" style={{ color: "#87FF0F" }}>{otData.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">คำขอทั้งหมด</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/50">
                    <p className="text-2xl font-bold" style={{ color: "#3b82f6" }}>{Math.round(otData.reduce((s: number, r: any) => s + r.hours, 0) * 100) / 100}</p>
                    <p className="text-xs text-muted-foreground mt-1">ชั่วโมงรวม</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/50">
                    <p className="text-2xl font-bold" style={{ color: "#4CAF50" }}>{otData.filter((r: any) => r.status === "อนุมัติ").length}</p>
                    <p className="text-xs text-muted-foreground mt-1">อนุมัติแล้ว</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/50">
                    <p className="text-2xl font-bold" style={{ color: "#FF870F" }}>{otData.filter((r: any) => r.status === "รออนุมัติ").length}</p>
                    <p className="text-xs text-muted-foreground mt-1">รออนุมัติ</p>
                  </div>
                </div>
              ) : (
                <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">{otLoading ? "กำลังโหลด..." : "ไม่มีข้อมูล"}</div>
              )}
            </div>
          </div>
        )}

        {cat === "shifts" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold mb-4">จำนวนพนักงานแยกตามกะรายเดือน</h3>
              {shiftDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={shiftDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Legend />
                    {shiftPieData.map((s) => (
                      <Bar key={s.name} dataKey={s.name} fill={s.color} radius={[4, 4, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">{shiftLoading ? "กำลังโหลด..." : "ไม่มีข้อมูล"}</div>
              )}
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold mb-4">สัดส่วนพนักงานตามกะ</h3>
              {shiftPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <RechartsPie>
                    <Pie data={shiftPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {shiftPieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPie>
                </ResponsiveContainer>
              ) : (
                <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">{shiftLoading ? "กำลังโหลด..." : "ไม่มีข้อมูล"}</div>
              )}
            </div>
            {(currentReport?.id === "shift-coverage") && (
              <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
                <h3 className="text-sm font-bold mb-4">จำนวนพนักงานตามช่วงเวลา (Shift Coverage)</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={shiftCoverageData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="time" fontSize={11} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Area type="monotone" dataKey="จำนวนพนักงาน" stroke="#a855f7" fill="#a855f7" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {cat === "payroll" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold mb-4">ค่าใช้จ่ายเงินเดือนรายเดือน</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={payrollSummaryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => v.toLocaleString("th-TH")} />
                  <Legend />
                  <Bar dataKey="เงินเดือน" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="OT" fill="#FF870F" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="เบี้ยขยัน" fill="#87FF0F" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold mb-4">ภาษีสะสมรายปี</h3>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={taxCumulativeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => v.toLocaleString("th-TH")} />
                  <Legend />
                  <Area type="monotone" dataKey="ภาษีสะสม" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.15} />
                  <Area type="monotone" dataKey="ภาษีเดือนนี้" stroke="#FF870F" fill="#FF870F" fillOpacity={0.15} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {currentReport?.id === "payroll-summary" && (
              <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
                <h3 className="text-sm font-bold mb-4">รายการหักรายเดือน (ประกันสังคม + ภาษี)</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={payrollSummaryData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(v: number) => v.toLocaleString("th-TH")} />
                    <Legend />
                    <Line type="monotone" dataKey="ประกันสังคม" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="ภาษี" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}


        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-bold">ข้อมูลรายละเอียด</h3>
            <span className="text-xs text-muted-foreground">ข้อมูลจริงจากระบบ</span>
          </div>
          <div className="overflow-x-auto">
            {cat === "employees" && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold">ลำดับที่</th>
                    <th className="text-left px-4 py-3 font-semibold">ชื่อ-สกุล</th>
                    <th className="text-left px-4 py-3 font-semibold">แผนก</th>
                    <th className="text-left px-4 py-3 font-semibold">ตำแหน่ง</th>
                    <th className="text-left px-4 py-3 font-semibold">ประเภท</th>
                    <th className="text-left px-4 py-3 font-semibold">วันเริ่มงาน</th>
                    <th className="text-left px-4 py-3 font-semibold">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {empLoading ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">กำลังโหลดข้อมูล...</td></tr>
                  ) : empTableData.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">ไม่พบข้อมูลพนักงาน</td></tr>
                  ) : (
                    empTableData.map((emp, i) => (
                      <tr key={i} className="border-t border-border hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-center">{empTableData.length - i}</td>
                        <td className="px-4 py-3 font-medium">{emp.name}</td>
                        <td className="px-4 py-3">{emp.dept}</td>
                        <td className="px-4 py-3">{emp.position}</td>
                        <td className="px-4 py-3">{emp.type}</td>
                        <td className="px-4 py-3">{emp.startDate}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{
                            background: emp.rawStatus === "active" || emp.rawStatus === "new" ? "hsl(var(--accent-green) / 0.15)" : "hsl(0 80% 95%)",
                            color: emp.rawStatus === "active" || emp.rawStatus === "new" ? "#4CAF50" : "#ef4444",
                          }}>{emp.status}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {empTableData.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 font-semibold" style={{ background: "hsl(var(--muted) / 0.5)" }}>
                      <td className="px-4 py-3" colSpan={7}>รวมทั้งหมด {empTableData.length} คน</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
            {cat === "attendance" && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold">ลำดับที่</th>
                    <th className="text-left px-4 py-3 font-semibold">ชื่อ-สกุล</th>
                    <th className="text-left px-4 py-3 font-semibold">วันที่</th>
                    <th className="text-left px-4 py-3 font-semibold">เข้างาน</th>
                    <th className="text-left px-4 py-3 font-semibold">ออกงาน</th>
                    <th className="text-left px-4 py-3 font-semibold">ชั่วโมง</th>
                    <th className="text-left px-4 py-3 font-semibold">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {mockAttendanceTable.map((row, i) => (
                    <tr key={row.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-center">{mockAttendanceTable.length - i}</td>
                      <td className="px-4 py-3 font-medium">{row.name}</td>
                      <td className="px-4 py-3">{row.date}</td>
                      <td className="px-4 py-3">{row.checkIn}</td>
                      <td className="px-4 py-3">{row.checkOut}</td>
                      <td className="px-4 py-3">{row.hours}</td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            background: row.status === "ปกติ" ? "hsl(var(--accent-green) / 0.15)" : "hsl(31 100% 95%)",
                            color: row.status === "ปกติ" ? "#4CAF50" : "#FF870F",
                          }}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {cat === "overtime" && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold">ลำดับที่</th>
                    <th className="text-left px-4 py-3 font-semibold">ชื่อ-สกุล</th>
                    <th className="text-left px-4 py-3 font-semibold">แผนก</th>
                    <th className="text-left px-4 py-3 font-semibold">วันที่</th>
                    <th className="text-left px-4 py-3 font-semibold">เริ่ม</th>
                    <th className="text-left px-4 py-3 font-semibold">สิ้นสุด</th>
                    <th className="text-right px-4 py-3 font-semibold">ชั่วโมง</th>
                    <th className="text-left px-4 py-3 font-semibold">ประเภท</th>
                    <th className="text-left px-4 py-3 font-semibold">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {otLoading ? (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">กำลังโหลดข้อมูล...</td></tr>
                  ) : otData.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">ไม่พบข้อมูล OT ในเดือนที่เลือก</td></tr>
                  ) : (
                    otData.map((row: any, i: number) => (
                      <tr key={row.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-center">{otData.length - i}</td>
                        <td className="px-4 py-3 font-medium">{row.name}</td>
                        <td className="px-4 py-3">{row.dept}</td>
                        <td className="px-4 py-3">{row.date}</td>
                        <td className="px-4 py-3">{row.startTime}</td>
                        <td className="px-4 py-3">{row.endTime}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">{row.hours}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{
                            background: row.rawOtType === "workday" ? "hsl(217 91% 95%)" : row.rawOtType === "holiday" ? "hsl(31 100% 95%)" : "hsl(0 80% 95%)",
                            color: row.rawOtType === "workday" ? "#3b82f6" : row.rawOtType === "holiday" ? "#FF870F" : "#ef4444",
                          }}>
                            {row.otType}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{
                            background: row.status === "อนุมัติ" ? "hsl(var(--accent-green) / 0.15)" : row.status === "ไม่อนุมัติ" ? "hsl(0 80% 95%)" : "hsl(31 100% 95%)",
                            color: row.status === "อนุมัติ" ? "#4CAF50" : row.status === "ไม่อนุมัติ" ? "#ef4444" : "#FF870F",
                          }}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {otData.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 font-semibold" style={{ background: "hsl(var(--muted) / 0.5)" }}>
                      <td className="px-4 py-3" colSpan={6}>รวมทั้งหมด ({otData.length} รายการ)</td>
                      <td className="px-4 py-3 text-right tabular-nums" style={{ color: "#87FF0F" }}>{Math.round(otData.reduce((s: number, r: any) => s + r.hours, 0) * 100) / 100}</td>
                      <td className="px-4 py-3" colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
            {cat === "leave" && selectedReport === "leave-summary" && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold">ลำดับที่</th>
                    <th className="text-left px-4 py-3 font-semibold">ชื่อ-สกุล</th>
                    <th className="text-left px-4 py-3 font-semibold">ประเภท</th>
                    <th className="text-left px-4 py-3 font-semibold">จาก</th>
                    <th className="text-left px-4 py-3 font-semibold">ถึง</th>
                    <th className="text-left px-4 py-3 font-semibold">วัน</th>
                    <th className="text-left px-4 py-3 font-semibold">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveLoading ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">กำลังโหลดข้อมูล...</td></tr>
                  ) : leaveData.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">ไม่พบข้อมูลการลาในเดือนที่เลือก</td></tr>
                  ) : (
                    leaveData.map((row, i) => (
                      <tr key={i} className="border-t border-border hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-center">{leaveData.length - i}</td>
                        <td className="px-4 py-3 font-medium">{row.name}</td>
                        <td className="px-4 py-3">{row.type}</td>
                        <td className="px-4 py-3">{row.from}</td>
                        <td className="px-4 py-3">{row.to}</td>
                        <td className="px-4 py-3">{row.days}</td>
                        <td className="px-4 py-3">
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              background: row.status === "อนุมัติ" ? "hsl(var(--accent-green) / 0.15)" : row.status === "ไม่อนุมัติ" ? "hsl(0 80% 95%)" : "hsl(31 100% 95%)",
                              color: row.status === "อนุมัติ" ? "#4CAF50" : row.status === "ไม่อนุมัติ" ? "#ef4444" : "#FF870F",
                            }}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
            {cat === "leave" && selectedReport === "leave-balance" && (() => {
              const leaveTypeNames = leaveBalanceData.length > 0
                ? Object.keys(leaveBalanceData[0]).filter(k => k.endsWith("_quota")).map(k => k.replace("_quota", ""))
                : [];
              return (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-4 py-3 font-semibold">ลำดับที่</th>
                      <th className="text-left px-4 py-3 font-semibold">ชื่อ-สกุล</th>
                      {leaveTypeNames.map(tn => (
                        <th key={tn} className="text-center px-3 py-3 font-semibold" colSpan={1}>{tn}<br/><span className="text-xs font-normal text-muted-foreground">คงเหลือ/โควต้า</span></th>
                      ))}
                      <th className="text-center px-3 py-3 font-semibold">รวม<br/><span className="text-xs font-normal text-muted-foreground">คงเหลือ/โควต้า</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaveLoading ? (
                      <tr><td colSpan={leaveTypeNames.length + 3} className="px-4 py-8 text-center text-muted-foreground">กำลังโหลดข้อมูล...</td></tr>
                    ) : leaveBalanceData.length === 0 ? (
                      <tr><td colSpan={leaveTypeNames.length + 3} className="px-4 py-8 text-center text-muted-foreground">ไม่พบข้อมูล</td></tr>
                    ) : (
                      leaveBalanceData.map((row: any, i: number) => (
                        <tr key={i} className="border-t border-border hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-center">{leaveBalanceData.length - i}</td>
                          <td className="px-4 py-3 font-medium">{row.name}</td>
                          {leaveTypeNames.map(tn => (
                            <td key={tn} className="px-3 py-3 text-center">
                              <span className={`font-semibold ${row[`${tn}_remaining`] <= 0 ? 'text-destructive' : ''}`}>
                                {row[`${tn}_remaining`]}
                              </span>
                              <span className="text-muted-foreground">/{row[`${tn}_quota`]}</span>
                            </td>
                          ))}
                          <td className="px-3 py-3 text-center">
                            <span className={`font-bold ${row.totalRemaining <= 0 ? 'text-destructive' : ''}`}>{row.totalRemaining}</span>
                            <span className="text-muted-foreground">/{row.totalQuota}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              );
            })()}
            {cat === "leave" && selectedReport === "leave-yearly" && (() => {
              return (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-4 py-3 font-semibold">ประเภทการลา</th>
                      {monthShortNames.map(m => (
                        <th key={m} className="text-center px-2 py-3 font-semibold text-xs">{m}</th>
                      ))}
                      <th className="text-center px-3 py-3 font-semibold">รวม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaveLoading ? (
                      <tr><td colSpan={14} className="px-4 py-8 text-center text-muted-foreground">กำลังโหลดข้อมูล...</td></tr>
                    ) : leaveYearlyData.length === 0 ? (
                      <tr><td colSpan={14} className="px-4 py-8 text-center text-muted-foreground">ไม่พบข้อมูลการลาในปีที่เลือก</td></tr>
                    ) : (
                      leaveYearlyData.map((row: any, i: number) => (
                        <tr key={i} className="border-t border-border hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium">
                            <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ background: row.color }} />
                            {row.type}
                          </td>
                          {monthShortNames.map(m => (
                            <td key={m} className="px-2 py-3 text-center tabular-nums">{row[m] || 0}</td>
                          ))}
                          <td className="px-3 py-3 text-center font-bold tabular-nums">{row.total}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {leaveYearlyData.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 font-semibold" style={{ background: "hsl(var(--muted) / 0.5)" }}>
                        <td className="px-4 py-3">รวมทั้งหมด</td>
                        {monthShortNames.map(m => (
                          <td key={m} className="px-2 py-3 text-center tabular-nums">
                            {leaveYearlyData.reduce((sum: number, r: any) => sum + (r[m] || 0), 0)}
                          </td>
                        ))}
                        <td className="px-3 py-3 text-center font-bold tabular-nums" style={{ color: "#FF870F" }}>
                          {leaveYearlyData.reduce((sum: number, r: any) => sum + r.total, 0)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              );
            })()}
            {cat === "shifts" && currentReport?.id !== "shift-change" && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold">ลำดับที่</th>
                    <th className="text-left px-4 py-3 font-semibold">ชื่อ-สกุล</th>
                    <th className="text-left px-4 py-3 font-semibold">แผนก</th>
                    <th className="text-left px-4 py-3 font-semibold">กะ</th>
                    <th className="text-left px-4 py-3 font-semibold">ช่วงเวลา</th>
                    <th className="text-left px-4 py-3 font-semibold">ประเภท</th>
                    <th className="text-left px-4 py-3 font-semibold">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {shiftData.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">{shiftLoading ? "กำลังโหลด..." : "ไม่มีข้อมูล"}</td></tr>
                  ) : shiftData.map((row: any, i: number) => (
                    <tr key={i} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-center">{shiftData.length - i}</td>
                      <td className="px-4 py-3 font-medium">{row.name}</td>
                      <td className="px-4 py-3">{row.dept}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: row.shiftColor }}>
                          {row.shift}
                        </span>
                      </td>
                      <td className="px-4 py-3">{row.period}</td>
                      <td className="px-4 py-3">{row.assignmentType === "day" ? "รายวัน" : "ประจำ"}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{
                          background: "hsl(var(--accent-green) / 0.15)",
                          color: "#4CAF50",
                        }}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {cat === "shifts" && currentReport?.id === "shift-change" && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold">ลำดับที่</th>
                    <th className="text-left px-4 py-3 font-semibold">ชื่อ-สกุล</th>
                    <th className="text-left px-4 py-3 font-semibold">กะเดิม</th>
                    <th className="text-left px-4 py-3 font-semibold">กะใหม่</th>
                    <th className="text-left px-4 py-3 font-semibold">วันที่</th>
                    <th className="text-left px-4 py-3 font-semibold">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {shiftChangeLog.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">{shiftLoading ? "กำลังโหลด..." : "ไม่มีข้อมูลการเปลี่ยนกะ"}</td></tr>
                  ) : shiftChangeLog.map((row: any, i: number) => (
                    <tr key={i} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-center">{shiftChangeLog.length - i}</td>
                      <td className="px-4 py-3 font-medium">{row.name}</td>
                      <td className="px-4 py-3">{row.fromShift}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: row.toShiftColor }}>
                          {row.toShift}
                        </span>
                      </td>
                      <td className="px-4 py-3">{row.date}</td>
                      <td className="px-4 py-3">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {cat === "payroll" && (
              (() => {
                const taxConfig: TaxConfig = { enabled: true, method: "progressive", flatRate: 5 };
                const activeEmps = employees.filter((e) => e.status === "active");
                const pnd1Rows = activeEmps.map((emp) => {
                  const salary = Number(emp.salary) || 0;
                  const annualIncome = calculateAnnualIncome(salary);
                  const monthlyTax = calculateMonthlyTax(taxConfig, annualIncome, emp.taxDeductions || DEFAULT_TAX_DEDUCTION);
                  return { id: emp.id, name: `${emp.firstName} ${emp.lastName}`, nationalId: emp.nationalId, salary, annualIncome, monthlyTax };
                });
                const totalSalary = pnd1Rows.reduce((s, r) => s + r.salary, 0);
                const totalTax = pnd1Rows.reduce((s, r) => s + r.monthlyTax, 0);

                if (currentReport?.id === "payroll-pnd1") {
                  return (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left px-4 py-3 font-semibold">ลำดับ</th>
                          <th className="text-left px-4 py-3 font-semibold">ชื่อ-สกุล</th>
                          <th className="text-left px-4 py-3 font-semibold">เลขบัตรประชาชน</th>
                          <th className="text-right px-4 py-3 font-semibold">เงินได้ (บาท)</th>
                          <th className="text-right px-4 py-3 font-semibold">ภาษีหัก (บาท)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pnd1Rows.map((row, i) => (
                          <tr key={row.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3">{i + 1}</td>
                            <td className="px-4 py-3 font-medium">{row.name}</td>
                            <td className="px-4 py-3 font-mono text-xs">{row.nationalId}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(row.salary)}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(row.monthlyTax)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 font-semibold" style={{ background: "hsl(var(--muted) / 0.5)" }}>
                          <td className="px-4 py-3" colSpan={3}>รวมทั้งหมด ({pnd1Rows.length} คน)</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(totalSalary)}</td>
                          <td className="px-4 py-3 text-right tabular-nums" style={{ color: "#0ea5e9" }}>{formatCurrency(totalTax)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  );
                }

                if (currentReport?.id === "payroll-tax-annual") {
                  return (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left px-4 py-3 font-semibold">ชื่อ-สกุล</th>
                          <th className="text-right px-4 py-3 font-semibold">เงินเดือน</th>
                          <th className="text-right px-4 py-3 font-semibold">รายได้/ปี (ประมาณ)</th>
                          <th className="text-right px-4 py-3 font-semibold">ภาษี/เดือน</th>
                          <th className="text-right px-4 py-3 font-semibold">ภาษี/ปี (ประมาณ)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pnd1Rows.map((row) => (
                          <tr key={row.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-medium">{row.name}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(row.salary)}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(row.annualIncome)}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(row.monthlyTax)}</td>
                            <td className="px-4 py-3 text-right tabular-nums font-semibold" style={{ color: "#0ea5e9" }}>{formatCurrency(row.monthlyTax * 12)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 font-semibold" style={{ background: "hsl(var(--muted) / 0.5)" }}>
                          <td className="px-4 py-3">รวม</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(totalSalary)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(pnd1Rows.reduce((s, r) => s + r.annualIncome, 0))}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(totalTax)}</td>
                          <td className="px-4 py-3 text-right tabular-nums" style={{ color: "#0ea5e9" }}>{formatCurrency(totalTax * 12)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  );
                }

                // payroll-summary default
                return (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left px-4 py-3 font-semibold">เดือน</th>
                        <th className="text-right px-4 py-3 font-semibold">เงินเดือน</th>
                        <th className="text-right px-4 py-3 font-semibold">OT</th>
                        <th className="text-right px-4 py-3 font-semibold">เบี้ยขยัน</th>
                        <th className="text-right px-4 py-3 font-semibold">ประกันสังคม</th>
                        <th className="text-right px-4 py-3 font-semibold">ภาษี</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payrollLoading ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">กำลังโหลดข้อมูล...</td></tr>
                      ) : payrollSummaryData.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">ไม่พบข้อมูล</td></tr>
                      ) : (
                        payrollSummaryData.map((row: any) => (
                          <tr key={row.month} className="border-t border-border hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-medium">{row.month}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{(row.เงินเดือน || 0).toLocaleString("th-TH")}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{(row.OT || 0).toLocaleString("th-TH")}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{(row.เบี้ยขยัน || 0).toLocaleString("th-TH")}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{(row.ประกันสังคม || 0).toLocaleString("th-TH")}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{(row.ภาษี || 0).toLocaleString("th-TH")}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                );
              })()
            )}
          </div>
        </div>
      </div>
    );
  };

  // --- Main render ---
  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {categories.map((cat) => {
          const count = reportTypes.filter((r) => r.category === cat.key).length;
          return (
            <button
              key={cat.key}
              onClick={() => { setActiveCategory(activeCategory === cat.key ? null : cat.key); setSelectedReport(null); }}
              className={`p-4 rounded-2xl border transition-all duration-200 text-left ${activeCategory === cat.key ? "ring-2 shadow-lg" : "hover:shadow-md"}`}
              style={{
                borderColor: activeCategory === cat.key ? cat.color : "hsl(var(--border))",
                background: activeCategory === cat.key ? `${cat.color}10` : "hsl(var(--card))",
                ...(activeCategory === cat.key ? { boxShadow: `0 4px 20px ${cat.color}20`, ringColor: cat.color } : {}),
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${cat.color}20` }}>
                  <cat.icon className="w-5 h-5" style={{ color: cat.color }} />
                </div>
                <div>
                  <p className="text-sm font-bold">{cat.label}</p>
                  <p className="text-xs text-muted-foreground">{count} รายงาน</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Report detail or list */}
      {selectedReport ? (
        renderReportDetail()
      ) : (
        <div className="space-y-4">
          {categories
            .filter((c) => !activeCategory || c.key === activeCategory)
            .map((cat) => {
              const catReports = filteredReports.filter((r) => r.category === cat.key);
              if (catReports.length === 0) return null;
              const isExpanded = expandedCats[cat.key];
              return (
                <div key={cat.key} className="rounded-2xl border border-border bg-card overflow-hidden">
                  <button
                    onClick={() => toggleCat(cat.key)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${cat.color}20` }}>
                        <cat.icon className="w-4 h-4" style={{ color: cat.color }} />
                      </div>
                      <span className="font-bold text-sm">{cat.label}</span>
                      <span className="text-xs text-muted-foreground">({catReports.length})</span>
                    </div>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  {isExpanded && (
                    <div className="border-t border-border">
                      {catReports.map((report) => (
                        <button
                          key={report.id}
                          onClick={() => setSelectedReport(report.id)}
                          className="w-full flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors border-b border-border last:border-b-0 text-left"
                        >
                          <report.icon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{report.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{report.description}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground px-2 py-1 rounded-lg bg-muted/50">
                              <Eye className="w-3 h-3" />
                              ดูรายงาน
                            </span>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};

export default Reports;
