import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmployees } from "@/contexts/EmployeeContext";
import {
  calculateAnnualIncome, calculateMonthlyTax, formatCurrency,
  DEFAULT_TAX_DEDUCTION, type TaxConfig,
} from "@/utils/taxCalculation";
import { exportPnd1Excel, exportPnd1Pdf, exportAllPayslipsExcel } from "@/utils/exportPayroll";
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
  Printer,
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
type ReportCategory = "employees" | "organization" | "attendance" | "leave" | "shifts" | "payroll";
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
  // Organization
  { id: "org-structure", name: "โครงสร้างองค์กร", description: "แผนผังโครงสร้างแผนกและตำแหน่งงานทั้งหมด", icon: GitBranch, category: "organization" },
  { id: "org-headcount", name: "Headcount ตามแผนก", description: "จำนวนพนักงานแยกตามแผนกและตำแหน่ง", icon: Building2, category: "organization" },
  { id: "org-ratio", name: "อัตราส่วนบุคลากร", description: "สัดส่วนพนักงานตามประเภท เพศ และอายุงาน", icon: PieChart, category: "organization" },
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
  { key: "organization", label: "โครงสร้างองค์กร", icon: GitBranch, color: "#87FF0F" },
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

const headcountData = [
  { dept: "IT", count: 45 },
  { dept: "HR", count: 12 },
  { dept: "Sales", count: 38 },
  { dept: "Marketing", count: 15 },
  { dept: "Finance", count: 20 },
  { dept: "Operations", count: 30 },
];

const hiringTrend = [
  { month: "ม.ค.", เข้าใหม่: 5, ลาออก: 2 },
  { month: "ก.พ.", เข้าใหม่: 3, ลาออก: 1 },
  { month: "มี.ค.", เข้าใหม่: 8, ลาออก: 3 },
  { month: "เม.ย.", เข้าใหม่: 4, ลาออก: 2 },
  { month: "พ.ค.", เข้าใหม่: 6, ลาออก: 1 },
  { month: "มิ.ย.", เข้าใหม่: 7, ลาออก: 4 },
];

// --- Mock table data ---
const mockEmployeeTable = [
  { id: "EMP-001", name: "สมชาย ใจดี", dept: "IT", position: "Senior Developer", type: "พนักงานประจำ", startDate: "01/03/2565", status: "ทำงาน" },
  { id: "EMP-002", name: "สมหญิง รักงาน", dept: "HR", position: "HR Manager", type: "พนักงานประจำ", startDate: "15/06/2563", status: "ทำงาน" },
  { id: "EMP-003", name: "วิชัย เก่งกาจ", dept: "Sales", position: "Sales Lead", type: "พนักงานประจำ", startDate: "01/01/2564", status: "ทำงาน" },
  { id: "EMP-004", name: "นภา สดใส", dept: "Marketing", position: "Designer", type: "สัญญาจ้าง", startDate: "10/08/2566", status: "ทำงาน" },
  { id: "EMP-005", name: "ประภาส มั่นคง", dept: "Finance", position: "Accountant", type: "พนักงานประจำ", startDate: "20/04/2562", status: "ทำงาน" },
];

const mockAttendanceTable = [
  { id: "EMP-001", name: "สมชาย ใจดี", date: "20/02/2569", checkIn: "08:02", checkOut: "17:15", status: "ปกติ", hours: "9:13" },
  { id: "EMP-002", name: "สมหญิง รักงาน", date: "20/02/2569", checkIn: "08:45", checkOut: "17:30", status: "สาย", hours: "8:45" },
  { id: "EMP-003", name: "วิชัย เก่งกาจ", date: "20/02/2569", checkIn: "07:55", checkOut: "18:00", status: "ปกติ", hours: "10:05" },
  { id: "EMP-004", name: "นภา สดใส", date: "20/02/2569", checkIn: "09:10", checkOut: "17:00", status: "สาย", hours: "7:50" },
  { id: "EMP-005", name: "ประภาส มั่นคง", date: "20/02/2569", checkIn: "08:00", checkOut: "17:00", status: "ปกติ", hours: "9:00" },
];

// mockLeaveTable removed - now fetched from database

// --- Shift mock data ---
const shiftDistribution = [
  { month: "ม.ค.", กะเช้า: 180, กะบ่าย: 120, กะดึก: 90 },
  { month: "ก.พ.", กะเช้า: 175, กะบ่าย: 125, กะดึก: 85 },
  { month: "มี.ค.", กะเช้า: 190, กะบ่าย: 115, กะดึก: 95 },
  { month: "เม.ย.", กะเช้า: 170, กะบ่าย: 130, กะดึก: 88 },
  { month: "พ.ค.", กะเช้า: 185, กะบ่าย: 118, กะดึก: 92 },
  { month: "มิ.ย.", กะเช้า: 192, กะบ่าย: 122, กะดึก: 86 },
];

const shiftPieData = [
  { name: "กะเช้า", value: 45, color: "#22c55e" },
  { name: "กะบ่าย", value: 30, color: "#3b82f6" },
  { name: "กะดึก", value: 25, color: "#a855f7" },
];

const mockShiftTable = [
  { id: "EMP-001", name: "สมชาย ใจดี", dept: "IT", shift: "กะเช้า", period: "01/02/2569 - 28/02/2569", days: 20, hours: "160:00", status: "ปฏิบัติงาน" },
  { id: "EMP-002", name: "สมหญิง รักงาน", dept: "HR", shift: "กะเช้า", period: "01/02/2569 - 28/02/2569", days: 20, hours: "160:00", status: "ปฏิบัติงาน" },
  { id: "EMP-003", name: "วิชัย เก่งกาจ", dept: "Sales", shift: "กะบ่าย", period: "01/02/2569 - 28/02/2569", days: 18, hours: "144:00", status: "ปฏิบัติงาน" },
  { id: "EMP-004", name: "นภา สดใส", dept: "Marketing", shift: "กะดึก", period: "01/02/2569 - 28/02/2569", days: 22, hours: "176:00", status: "ปฏิบัติงาน" },
  { id: "EMP-005", name: "ประภาส มั่นคง", dept: "Finance", shift: "กะบ่าย", period: "01/02/2569 - 28/02/2569", days: 19, hours: "152:00", status: "ปฏิบัติงาน" },
  { id: "EMP-006", name: "จันทร์เพ็ญ วงษ์สวัสดิ์", dept: "Sales", shift: "กะดึก", period: "15/02/2569 - 28/02/2569", days: 10, hours: "80:00", status: "เปลี่ยนกะ" },
];

const shiftChangeLog = [
  { id: "EMP-003", name: "วิชัย เก่งกาจ", fromShift: "กะเช้า", toShift: "กะบ่าย", date: "05/02/2569", reason: "ความจำเป็นส่วนตัว", approver: "ผู้จัดการฝ่ายขาย" },
  { id: "EMP-006", name: "จันทร์เพ็ญ วงษ์สวัสดิ์", fromShift: "กะบ่าย", toShift: "กะดึก", date: "15/02/2569", reason: "สลับกับเพื่อนร่วมงาน", approver: "ผู้จัดการฝ่ายขาย" },
  { id: "EMP-004", name: "นภา สดใส", fromShift: "กะเช้า", toShift: "กะดึก", date: "01/02/2569", reason: "กำหนดตามนโยบายบริษัท", approver: "ฝ่ายบุคคล" },
];

const shiftCoverageData = [
  { time: "00:00-06:00", จำนวนพนักงาน: 12 },
  { time: "06:00-08:00", จำนวนพนักงาน: 25 },
  { time: "08:00-12:00", จำนวนพนักงาน: 45 },
  { time: "12:00-14:00", จำนวนพนักงาน: 40 },
  { time: "14:00-17:00", จำนวนพนักงาน: 42 },
  { time: "17:00-22:00", จำนวนพนักงาน: 30 },
  { time: "22:00-00:00", จำนวนพนักงาน: 15 },
];

// --- Fiscal year options ---
const taxCumulativeData = [
  { month: "ม.ค.", ภาษีสะสม: 28500, ภาษีเดือนนี้: 28500 },
  { month: "ก.พ.", ภาษีสะสม: 57000, ภาษีเดือนนี้: 28500 },
  { month: "มี.ค.", ภาษีสะสม: 86200, ภาษีเดือนนี้: 29200 },
  { month: "เม.ย.", ภาษีสะสม: 114700, ภาษีเดือนนี้: 28500 },
  { month: "พ.ค.", ภาษีสะสม: 143900, ภาษีเดือนนี้: 29200 },
  { month: "มิ.ย.", ภาษีสะสม: 172400, ภาษีเดือนนี้: 28500 },
];

const payrollSummaryData = [
  { month: "ม.ค.", เงินเดือน: 458000, OT: 42500, เบี้ยขยัน: 14000, ประกันสังคม: 5250, ภาษี: 28500 },
  { month: "ก.พ.", เงินเดือน: 458000, OT: 45200, เบี้ยขยัน: 12000, ประกันสังคม: 5250, ภาษี: 28500 },
  { month: "มี.ค.", เงินเดือน: 458000, OT: 50800, เบี้ยขยัน: 16000, ประกันสังคม: 5250, ภาษี: 29200 },
  { month: "เม.ย.", เงินเดือน: 458000, OT: 38000, เบี้ยขยัน: 10000, ประกันสังคม: 5250, ภาษี: 28500 },
  { month: "พ.ค.", เงินเดือน: 458000, OT: 48600, เบี้ยขยัน: 14000, ประกันสังคม: 5250, ภาษี: 29200 },
  { month: "มิ.ย.", เงินเดือน: 458000, OT: 41000, เบี้ยขยัน: 12000, ประกันสังคม: 5250, ภาษี: 28500 },
];

const fiscalYears = ["2569", "2568", "2567", "2566"];
const months = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

const Reports = () => {
  const { employees } = useEmployees();
  const [activeCategory, setActiveCategory] = useState<ReportCategory | null>(null);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState("2569");
  const [filterMonth, setFilterMonth] = useState("กุมภาพันธ์");
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({ employees: true, organization: true, attendance: true, leave: true, shifts: true, payroll: true });

  // --- Real leave data ---
  const [leaveData, setLeaveData] = useState<any[]>([]);
  const [leavePieData, setLeavePieData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveBalanceData, setLeaveBalanceData] = useState<any[]>([]);
  const [leaveYearlyData, setLeaveYearlyData] = useState<any[]>([]);
  const [leaveYearlyChartData, setLeaveYearlyChartData] = useState<any[]>([]);
  const [leaveMonthlyBarData, setLeaveMonthlyBarData] = useState<any[]>([]);

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
      const startDate = `${ceYear}-${String(monthNum).padStart(2, '0')}-01`;
      const endDay = new Date(ceYear, monthNum, 0).getDate();
      const endDate = `${ceYear}-${String(monthNum).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from("leave_requests")
        .select("*, employees!leave_requests_employee_id_fkey(first_name, last_name, username)")
        .gte("date_from", startDate)
        .lte("date_from", endDate)
        .order("date_from", { ascending: false });

      if (error) throw error;

      const rows = (data || []).map((r: any) => ({
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
      const yearStart = `${ceYear}-01-01`;
      const yearEnd = `${ceYear}-12-31`;

      const [typesRes, requestsRes, empsRes] = await Promise.all([
        supabase.from("leave_types").select("*").order("sort_order"),
        supabase.from("leave_requests").select("employee_id, leave_type_id, leave_type_name, days, status")
          .gte("date_from", yearStart).lte("date_from", yearEnd)
          .neq("status", "rejected"),
        supabase.from("employees").select("id, first_name, last_name, username").eq("status", "active"),
      ]);

      const leaveTypes = typesRes.data || [];
      const requests = requestsRes.data || [];
      const emps = empsRes.data || [];

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
      const yearStart = `${ceYear}-01-01`;
      const yearEnd = `${ceYear}-12-31`;

      const [requestsRes, typesRes] = await Promise.all([
        supabase.from("leave_requests").select("date_from, leave_type_name, days, status")
          .gte("date_from", yearStart).lte("date_from", yearEnd)
          .neq("status", "rejected"),
        supabase.from("leave_types").select("name, color").order("sort_order"),
      ]);

      const requests = requestsRes.data || [];
      const leaveTypes = typesRes.data || [];
      const typeNames = leaveTypes.map((lt: any) => lt.name);

      // Aggregate by month
      const monthlyMap: Record<number, Record<string, number>> = {};
      for (let m = 1; m <= 12; m++) monthlyMap[m] = {};

      requests.forEach((r: any) => {
        const month = parseInt(r.date_from.split("-")[1]);
        const name = r.leave_type_name || "อื่นๆ";
        monthlyMap[month][name] = (monthlyMap[month][name] || 0) + Number(r.days);
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

  useEffect(() => {
    if (selectedReport === "leave-summary") fetchLeaveData();
    else if (selectedReport === "leave-balance") fetchLeaveBalance();
    else if (selectedReport === "leave-yearly") fetchLeaveYearly();
  }, [selectedReport, fetchLeaveData, fetchLeaveBalance, fetchLeaveYearly]);

  const toggleCat = (cat: string) => setExpandedCats((p) => ({ ...p, [cat]: !p[cat] }));

  const filteredReports = activeCategory ? reportTypes.filter((r) => r.category === activeCategory) : reportTypes;

  const handleExport = async (format: ExportFormat) => {
    const reportId = currentReport?.id;

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
    if (reportId === "payroll-summary" || reportId === "payroll-tax-annual") {
      if (format === "excel") {
        exportAllPayslipsExcel(employees);
        toast.success("ส่งออกสลิปเงินเดือนทั้งหมดเป็น Excel สำเร็จ");
      } else {
        await exportPnd1Pdf(employees, filterMonth, filterYear);
        toast.success("ส่งออกรายงานเป็น PDF สำเร็จ");
      }
      return;
    }

    // Generic fallback
    const label = format === "excel" ? "Excel (.xlsx)" : "PDF";
    toast.info(`ฟังก์ชันส่งออก ${label} สำหรับรายงานนี้จะเปิดใช้งานเร็วๆ นี้`);
  };

  const handlePrint = () => window.print();

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
            <button onClick={handlePrint} className="report-export-btn">
              <Printer className="w-4 h-4" />
              <span>พิมพ์</span>
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
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold mb-4">จำนวนวันลาแยกตามเดือน</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={attendanceMonthly.map((d, i) => ({ month: d.month, วันลา: [12, 8, 15, 20, 10, 7][i] }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="วันลา" fill="#FF870F" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {cat === "employees" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold mb-4">แนวโน้มการรับ-ออก พนักงาน</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={hiringTrend}>
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
                <BarChart data={headcountData} layout="vertical">
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

        {cat === "organization" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold mb-4">Headcount ตามแผนก</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={headcountData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="dept" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#87FF0F" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold mb-4">สัดส่วนพนักงานตามประเภท</h3>
              <ResponsiveContainer width="100%" height={260}>
                <RechartsPie>
                  <Pie
                    data={[
                      { name: "พนักงานประจำ", value: 120, color: "#FF870F" },
                      { name: "พนักงานชั่วคราว", value: 25, color: "#9CA3AF" },
                      { name: "พนักงานทดลองงาน", value: 15, color: "#87FF0F" },
                    ]}
                    cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    <Cell fill="#FF870F" />
                    <Cell fill="#9CA3AF" />
                    <Cell fill="#87FF0F" />
                  </Pie>
                  <Tooltip />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {cat === "shifts" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold mb-4">จำนวนพนักงานแยกตามกะรายเดือน</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={shiftDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="กะเช้า" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="กะบ่าย" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="กะดึก" fill="#a855f7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold mb-4">สัดส่วนพนักงานตามกะ</h3>
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
            <span className="text-xs text-muted-foreground">แสดง Mock Data</span>
          </div>
          <div className="overflow-x-auto">
            {(cat === "employees" || cat === "organization") && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold">รหัส</th>
                    <th className="text-left px-4 py-3 font-semibold">ชื่อ-สกุล</th>
                    <th className="text-left px-4 py-3 font-semibold">แผนก</th>
                    <th className="text-left px-4 py-3 font-semibold">ตำแหน่ง</th>
                    <th className="text-left px-4 py-3 font-semibold">ประเภท</th>
                    <th className="text-left px-4 py-3 font-semibold">วันเริ่มงาน</th>
                    <th className="text-left px-4 py-3 font-semibold">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {mockEmployeeTable.map((emp) => (
                    <tr key={emp.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">{emp.id}</td>
                      <td className="px-4 py-3 font-medium">{emp.name}</td>
                      <td className="px-4 py-3">{emp.dept}</td>
                      <td className="px-4 py-3">{emp.position}</td>
                      <td className="px-4 py-3">{emp.type}</td>
                      <td className="px-4 py-3">{emp.startDate}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "hsl(var(--accent-green) / 0.15)", color: "#4CAF50" }}>{emp.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {cat === "attendance" && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold">รหัส</th>
                    <th className="text-left px-4 py-3 font-semibold">ชื่อ-สกุล</th>
                    <th className="text-left px-4 py-3 font-semibold">วันที่</th>
                    <th className="text-left px-4 py-3 font-semibold">เข้างาน</th>
                    <th className="text-left px-4 py-3 font-semibold">ออกงาน</th>
                    <th className="text-left px-4 py-3 font-semibold">ชั่วโมง</th>
                    <th className="text-left px-4 py-3 font-semibold">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {mockAttendanceTable.map((row) => (
                    <tr key={row.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">{row.id}</td>
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
            {cat === "leave" && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold">รหัส</th>
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
                        <td className="px-4 py-3 font-mono text-xs">{row.empId}</td>
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
            {cat === "shifts" && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold">รหัส</th>
                    <th className="text-left px-4 py-3 font-semibold">ชื่อ-สกุล</th>
                    <th className="text-left px-4 py-3 font-semibold">แผนก</th>
                    <th className="text-left px-4 py-3 font-semibold">กะ</th>
                    <th className="text-left px-4 py-3 font-semibold">ช่วงเวลา</th>
                    <th className="text-left px-4 py-3 font-semibold">วันทำงาน</th>
                    <th className="text-left px-4 py-3 font-semibold">ชั่วโมง</th>
                    <th className="text-left px-4 py-3 font-semibold">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {(currentReport?.id === "shift-change" ? [] : mockShiftTable).map((row) => (
                    <tr key={row.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">{row.id}</td>
                      <td className="px-4 py-3 font-medium">{row.name}</td>
                      <td className="px-4 py-3">{row.dept}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{
                          background: row.shift === "กะเช้า" ? "#22c55e" : row.shift === "กะบ่าย" ? "#3b82f6" : "#a855f7"
                        }}>
                          {row.shift}
                        </span>
                      </td>
                      <td className="px-4 py-3">{row.period}</td>
                      <td className="px-4 py-3">{row.days} วัน</td>
                      <td className="px-4 py-3">{row.hours}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{
                          background: row.status === "ปฏิบัติงาน" ? "hsl(var(--accent-green) / 0.15)" : "hsl(31 100% 95%)",
                          color: row.status === "ปฏิบัติงาน" ? "#4CAF50" : "#FF870F",
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
                    <th className="text-left px-4 py-3 font-semibold">รหัส</th>
                    <th className="text-left px-4 py-3 font-semibold">ชื่อ-สกุล</th>
                    <th className="text-left px-4 py-3 font-semibold">จากกะ</th>
                    <th className="text-left px-4 py-3 font-semibold">เป็นกะ</th>
                    <th className="text-left px-4 py-3 font-semibold">วันที่</th>
                    <th className="text-left px-4 py-3 font-semibold">เหตุผล</th>
                    <th className="text-left px-4 py-3 font-semibold">ผู้อนุมัติ</th>
                  </tr>
                </thead>
                <tbody>
                  {shiftChangeLog.map((row, i) => (
                    <tr key={i} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">{row.id}</td>
                      <td className="px-4 py-3 font-medium">{row.name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{
                          background: row.fromShift === "กะเช้า" ? "#22c55e" : row.fromShift === "กะบ่าย" ? "#3b82f6" : "#a855f7"
                        }}>
                          {row.fromShift}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{
                          background: row.toShift === "กะเช้า" ? "#22c55e" : row.toShift === "กะบ่าย" ? "#3b82f6" : "#a855f7"
                        }}>
                          {row.toShift}
                        </span>
                      </td>
                      <td className="px-4 py-3">{row.date}</td>
                      <td className="px-4 py-3">{row.reason}</td>
                      <td className="px-4 py-3">{row.approver}</td>
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
                      {payrollSummaryData.map((row) => (
                        <tr key={row.month} className="border-t border-border hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium">{row.month}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{row.เงินเดือน.toLocaleString("th-TH")}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{row.OT.toLocaleString("th-TH")}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{row.เบี้ยขยัน.toLocaleString("th-TH")}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{row.ประกันสังคม.toLocaleString("th-TH")}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{row.ภาษี.toLocaleString("th-TH")}</td>
                        </tr>
                      ))}
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
