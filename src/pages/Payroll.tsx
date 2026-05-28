import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useEmployees, Employee, CustomPayrollItem } from "@/contexts/EmployeeContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Banknote, Users, TrendingUp, FileText, Search, Download, Eye, X,
  Calculator, Receipt, Wallet, ShieldCheck, ChevronDown, ChevronUp, Settings2, Plus, Trash2,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import EmployeeAvatar from "@/components/ui/employee-avatar";
import {
  calculateAnnualIncome, calculateExpenseDeduction, calculateTotalDeductions,
  calculateProgressiveTax, calculateMonthlyTax, formatCurrency,
  DEFAULT_TAX_DEDUCTION, type TaxConfig, type TaxDeduction,
} from "@/utils/taxCalculation";
import { toast } from "sonner";
import { exportPnd1Excel, exportPnd1Pdf, exportPayslipExcel, exportPayslipPdf, exportPayslipPdfFromSnapshot, exportAllPayslipsExcel } from "@/utils/exportPayroll";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePayrollPeriod, type PayslipRow } from "@/hooks/usePayrollPeriod";
import { useAuth } from "@/contexts/AuthContext";

/* ─── Payroll config ─── */
const PAYROLL_CONFIG = {
  otRateWorkday: 1.5,
  otRateHoliday: 3.0,
  diligenceEnabled: true,
  diligenceAmount: 2000,
  ssfEnabled: true,
  ssfRate: 5,
  ssfCeiling: 750,
  taxConfig: { enabled: true, method: "progressive" as const, flatRate: 5 },
  shiftAllowanceAfternoon: 50,
  shiftAllowanceNight: 100,
};

/* ─── Attendance data type ─── */
interface AttendanceStats {
  workDays: number;
  otHours: number;
  lateDays: number;
  absentDays: number;
  leaveDays: number;
}

/* ─── Per-month inline overrides ─── */
export interface PayrollOverride {
  base_salary?: number | null;
  ot_pay?: number | null;
  diligence?: number | null;
  ssf?: number | null;
  tax?: number | null;
}

/* ─── Calculation helpers ─── */
function calcPayroll(emp: Employee, config: typeof PAYROLL_CONFIG, att: AttendanceStats, override?: PayrollOverride) {
  const salary = override?.base_salary != null ? Number(override.base_salary) : (Number(emp.salary) || 0);

  const hourlyRate = salary / 30 / 8;
  const computedOt = Math.round(att.otHours * hourlyRate * config.otRateWorkday);
  const otPay = override?.ot_pay != null ? Number(override.ot_pay) : computedOt;
  const computedDiligence = config.diligenceEnabled && att.lateDays === 0 && att.absentDays === 0 ? config.diligenceAmount : 0;
  const diligence = override?.diligence != null ? Number(override.diligence) : computedDiligence;

  const customItems = (emp.customPayrollItems || []).filter((i) => i.enabled);
  const customIncome = customItems.filter((i) => i.type === "income").reduce((s, i) => s + i.amount, 0);
  const customDeductions = customItems.filter((i) => i.type === "deduction").reduce((s, i) => s + i.amount, 0);

  const grossPay = salary + otPay + diligence + customIncome;
  const computedSsf = config.ssfEnabled ? Math.min(Math.round(salary * config.ssfRate / 100), config.ssfCeiling) : 0;
  const ssf = override?.ssf != null ? Number(override.ssf) : computedSsf;

  const deductions: TaxDeduction = emp.taxDeductions || { ...DEFAULT_TAX_DEDUCTION };
  const annualIncome = calculateAnnualIncome(salary, otPay, diligence + customIncome);
  const computedTax = calculateMonthlyTax(config.taxConfig, annualIncome, deductions);
  const monthlyTax = override?.tax != null ? Number(override.tax) : computedTax;

  const totalDeduct = ssf + monthlyTax + customDeductions;
  const netPay = grossPay - totalDeduct;

  return { salary, otPay, otHours: att.otHours, diligence, grossPay, ssf, monthlyTax, totalDeduct, netPay, att, annualIncome, deductions, customIncome, customDeductions, customItems };
}

/* ─── Inline Editable Cell ─── */
function EditableCell({
  value, onChange, className = "",
}: {
  value: number; onChange: (v: number) => void; className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(String(value));
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [editing, value]);

  const commit = () => {
    setEditing(false);
    const n = Number(draft);
    if (!isNaN(n) && n !== value) onChange(n);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        className={`w-20 text-right text-sm tabular-nums border rounded px-1.5 py-0.5 bg-background outline-none focus:ring-1 focus:ring-primary ${className}`}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`cursor-pointer hover:bg-primary/10 rounded px-1 py-0.5 transition-colors tabular-nums ${className}`}
      title="คลิกเพื่อแก้ไข"
    >
      {formatCurrency(value)}
    </span>
  );
}

/* ─── Summary Card ─── */
function SummaryCard({ icon: Icon, label, value, color, bg }: { icon: React.ElementType; label: string; value: string; color: string; bg: string }) {
  return (
    <div className="card-base p-4" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className="text-xl font-bold font-display mt-1" style={{ color }}>{value}</p>
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: bg }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
    </div>
  );
}

/* ─── Custom Items Dialog ─── */
function CustomItemsDialog({
  open, onClose, emp, onSave,
}: {
  open: boolean; onClose: () => void; emp: Employee;
  onSave: (items: CustomPayrollItem[]) => void;
}) {
  const [items, setItems] = useState<CustomPayrollItem[]>(emp.customPayrollItems || []);

  useEffect(() => {
    if (open) setItems(emp.customPayrollItems || []);
  }, [open, emp]);

  const addItem = (type: "income" | "deduction") => {
    setItems([...items, { id: crypto.randomUUID(), name: "", type, amount: 0, enabled: true }]);
  };

  const updateItem = (id: string, field: keyof CustomPayrollItem, value: any) => {
    setItems(items.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  };

  const removeItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id));
  };

  const handleSave = () => {
    const valid = items.filter((i) => i.name.trim() !== "");
    onSave(valid);
    onClose();
    toast.success(`บันทึกรายการเพิ่มเติมของ ${emp.firstName} สำเร็จ`);
  };

  const incomeItems = items.filter((i) => i.type === "income");
  const deductionItems = items.filter((i) => i.type === "deduction");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pb-[10px]">
            <Settings2 className="w-5 h-5" style={{ color: "hsl(var(--primary))" }} />
            แก้ไขรายการ - {emp.firstName} {emp.lastName}
          </DialogTitle>
          <DialogDescription className="sr-only">แก้ไขรายการเงินเดือน</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Income items */}
          <div>
            <p className="font-semibold text-sm flex items-center gap-1.5 mb-3">
              <TrendingUp className="w-4 h-4 text-emerald-500" /> รายรับเพิ่มเติม
            </p>
            <div className="space-y-2">
              {incomeItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg border">
                  <Switch checked={item.enabled} onCheckedChange={(v) => updateItem(item.id, "enabled", v)} />
                  <Input placeholder="ชื่อรายการ" value={item.name} onChange={(e) => updateItem(item.id, "name", e.target.value)} className="flex-1 h-8 text-sm" />
                  <Input type="number" placeholder="จำนวนเงิน" value={item.amount || ""} onChange={(e) => updateItem(item.id, "amount", Number(e.target.value))} className="w-24 h-8 text-sm text-right" />
                  <button onClick={() => removeItem(item.id)} className="p-1 rounded hover:bg-destructive/10 transition-colors"><Trash2 className="w-4 h-4 text-destructive" /></button>
                </div>
              ))}
              {incomeItems.length === 0 && <p className="text-xs text-muted-foreground py-2">ยังไม่มีรายรับเพิ่มเติม</p>}
            </div>
            <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={() => addItem("income")}>
              <Plus className="w-3 h-3 mr-1" /> เพิ่มรายรับ
            </Button>
          </div>

          {/* Deduction items */}
          <div>
            <p className="font-semibold text-sm flex items-center gap-1.5 mb-3">
              <Wallet className="w-4 h-4 text-red-500" /> รายการหักเพิ่มเติม
            </p>
            <div className="space-y-2">
              {deductionItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg border">
                  <Switch checked={item.enabled} onCheckedChange={(v) => updateItem(item.id, "enabled", v)} />
                  <Input placeholder="ชื่อรายการ" value={item.name} onChange={(e) => updateItem(item.id, "name", e.target.value)} className="flex-1 h-8 text-sm" />
                  <Input type="number" placeholder="จำนวนเงิน" value={item.amount || ""} onChange={(e) => updateItem(item.id, "amount", Number(e.target.value))} className="w-24 h-8 text-sm text-right" />
                  <button onClick={() => removeItem(item.id)} className="p-1 rounded hover:bg-destructive/10 transition-colors"><Trash2 className="w-4 h-4 text-destructive" /></button>
                </div>
              ))}
              {deductionItems.length === 0 && <p className="text-xs text-muted-foreground py-2">ยังไม่มีรายการหักเพิ่มเติม</p>}
            </div>
            <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={() => addItem("deduction")}>
              <Plus className="w-3 h-3 mr-1" /> เพิ่มรายการหัก
            </Button>
          </div>

          <Button onClick={handleSave} className="w-full">บันทึก</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Payslip Dialog ─── */
function PayslipDialog({ open, onClose, emp, payroll }: { open: boolean; onClose: () => void; emp: Employee; payroll: ReturnType<typeof calcPayroll> }) {
  const taxConfig = PAYROLL_CONFIG.taxConfig;
  const expenseDeduction = calculateExpenseDeduction(payroll.annualIncome);
  const totalDeductions = calculateTotalDeductions(payroll.deductions);
  const netIncome = Math.max(0, payroll.annualIncome - expenseDeduction - totalDeductions);
  const annualTax = calculateProgressiveTax(netIncome);

  const customIncomeItems = payroll.customItems.filter((i) => i.type === "income");
  const customDeductionItems = payroll.customItems.filter((i) => i.type === "deduction");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pb-[10px]">
            <Receipt className="w-5 h-5" style={{ color: "hsl(var(--primary))" }} />
            สลิปเงินเดือน - {emp.firstName} {emp.lastName}
          </DialogTitle>
          <DialogDescription className="sr-only">รายละเอียดสลิปเงินเดือน</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "hsl(var(--muted))" }}>
            <EmployeeAvatar photoUrl={emp.photoUrl} avatar={emp.avatar} avatarColor={emp.avatarColor} avatarTextColor={emp.avatarTextColor} firstName={emp.firstName} size="lg" />
            <div>
              <p className="font-semibold">{emp.prefix}{emp.firstName} {emp.lastName}</p>
              <p className="text-xs text-muted-foreground">{emp.position} • {emp.dept}</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: "วันทำงาน", val: payroll.att.workDays, c: "hsl(var(--primary))" },
              { label: "OT (ชม.)", val: payroll.otHours, c: "hsl(31 100% 53%)" },
              { label: "สาย", val: payroll.att.lateDays, c: "hsl(0 84% 50%)" },
              { label: "ลา", val: payroll.att.leaveDays, c: "hsl(220 90% 50%)" },
            ].map((s) => (
              <div key={s.label} className="p-2 rounded-lg border">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="font-bold text-lg" style={{ color: s.c }}>{s.val}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> รายได้</p>
            <div className="space-y-1.5">
              <PayslipRow label="เงินเดือน" value={formatCurrency(payroll.salary)} />
              <PayslipRow label={`ค่าล่วงเวลา (${payroll.otHours} ชม. x${PAYROLL_CONFIG.otRateWorkday})`} value={formatCurrency(payroll.otPay)} />
              <PayslipRow label="เบี้ยขยัน" value={formatCurrency(payroll.diligence)} />
              {customIncomeItems.map((item) => <PayslipRow key={item.id} label={item.name} value={formatCurrency(item.amount)} />)}
              <div className="border-t pt-1.5"><PayslipRow label="รวมรายได้" value={formatCurrency(payroll.grossPay)} bold /></div>
            </div>
          </div>

          <div>
            <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> รายการหัก</p>
            <div className="space-y-1.5">
              <PayslipRow label="ประกันสังคม" value={formatCurrency(payroll.ssf)} />
              <PayslipRow label={`ภาษีหัก ณ ที่จ่าย (${taxConfig.method === "progressive" ? "ขั้นบันได" : `Flat ${taxConfig.flatRate}%`})`} value={formatCurrency(payroll.monthlyTax)} />
              {customDeductionItems.map((item) => <PayslipRow key={item.id} label={item.name} value={formatCurrency(item.amount)} />)}
              <div className="border-t pt-1.5"><PayslipRow label="รวมหัก" value={formatCurrency(payroll.totalDeduct)} bold /></div>
            </div>
          </div>

          <div className="p-3 rounded-xl" style={{ background: "hsl(var(--primary) / 0.08)", border: "1px solid hsl(var(--primary) / 0.2)" }}>
            <div className="flex justify-between items-center">
              <span className="font-semibold" style={{ color: "hsl(var(--primary))" }}>เงินได้สุทธิ</span>
              <span className="text-xl font-bold font-display" style={{ color: "hsl(var(--primary))" }}>฿{formatCurrency(payroll.netPay)}</span>
            </div>
          </div>

          <div className="rounded-xl border p-3 space-y-1.5">
            <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> รายละเอียดภาษี (ประมาณการ)</p>
            <PayslipRow label="รายได้รวม/ปี" value={formatCurrency(payroll.annualIncome)} />
            <PayslipRow label="หักค่าใช้จ่าย (50% สูงสุด 100,000)" value={formatCurrency(expenseDeduction)} />
            <PayslipRow label="หักค่าลดหย่อน" value={formatCurrency(totalDeductions)} />
            <PayslipRow label="รายได้สุทธิ/ปี" value={formatCurrency(netIncome)} bold />
            <PayslipRow label="ภาษี/ปี" value={formatCurrency(annualTax)} />
            <PayslipRow label="ภาษี/เดือน" value={formatCurrency(payroll.monthlyTax)} bold />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PayslipRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

/* ─── Month/Year helpers ─── */
const THAI_MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

function getMonthDateRange(year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { startDate, endDate, totalWorkingDays: lastDay };
}

/* ═══════════════════════ Main Page ═══════════════════════ */
const Payroll = () => {
  const { employees, updateEmployee } = useEmployees();
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("all");
  const [sortField, setSortField] = useState<"name" | "salary" | "net">("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [payslipOpen, setPayslipOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [customItemsOpen, setCustomItemsOpen] = useState(false);
  const [customItemsEmp, setCustomItemsEmp] = useState<Employee | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Month/Year selector
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  // Real attendance data
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStats>>({});
  const [overrideMap, setOverrideMap] = useState<Record<string, PayrollOverride>>({});
  const [loadingData, setLoadingData] = useState(true);

  const activeEmployees = useMemo(() => employees.filter((e) => e.status === "active"), [employees]);

  // Fetch real attendance, leave, OT data for selected month
  useEffect(() => {
    const fetchPayrollData = async () => {
      setLoadingData(true);
      const { startDate, endDate } = getMonthDateRange(selectedYear, selectedMonth);

      try {
        const [attRes, leaveRes, otRes] = await Promise.all([
          supabase.from("attendance_records").select("employee_id, status, late, ot_hours, date")
            .gte("date", startDate).lte("date", endDate),
          supabase.from("leave_requests").select("employee_id, days, status, date_from, date_to")
            .or(`date_from.lte.${endDate},date_to.gte.${startDate}`)
            .in("status", ["approved"]),
          supabase.from("overtime_requests").select("employee_id, hours, status")
            .gte("date", startDate).lte("date", endDate)
            .eq("status", "approved"),
        ]);

        const map: Record<string, AttendanceStats> = {};

        // Initialize all active employees
        activeEmployees.forEach((emp) => {
          map[emp.id] = { workDays: 0, otHours: 0, lateDays: 0, absentDays: 0, leaveDays: 0 };
        });

        // Process attendance records
        (attRes.data || []).forEach((rec: any) => {
          if (!map[rec.employee_id]) map[rec.employee_id] = { workDays: 0, otHours: 0, lateDays: 0, absentDays: 0, leaveDays: 0 };
          const stats = map[rec.employee_id];
          if (rec.status === "present" || rec.status === "late") {
            stats.workDays++;
          } else if (rec.status === "absent") {
            stats.absentDays++;
          }
          if (rec.late) stats.lateDays++;
          stats.otHours += Number(rec.ot_hours) || 0;
        });

        // Process approved leave
        (leaveRes.data || []).forEach((lr: any) => {
          if (!map[lr.employee_id]) return;
          map[lr.employee_id].leaveDays += Number(lr.days) || 0;
        });

        // Process approved OT (add to otHours if not already from attendance)
        (otRes.data || []).forEach((ot: any) => {
          if (!map[ot.employee_id]) return;
          // Only add OT hours from approved OT requests if attendance doesn't track them
          const attOt = map[ot.employee_id].otHours;
          if (attOt === 0) {
            map[ot.employee_id].otHours += Number(ot.hours) || 0;
          }
        });

        setAttendanceMap(map);
      } catch (err) {
        console.error("Failed to fetch payroll data:", err);
      } finally {
        setLoadingData(false);
      }
    };

    if (activeEmployees.length > 0) {
      fetchPayrollData();
    } else {
      setLoadingData(false);
    }
  }, [activeEmployees, selectedMonth, selectedYear]);

  // Fetch overrides for the selected month
  const fetchOverrides = useCallback(async () => {
    const { data, error } = await supabase
      .from("payroll_overrides")
      .select("*")
      .eq("year", selectedYear)
      .eq("month", selectedMonth);
    if (error) {
      console.error("Failed to load payroll overrides", error);
      return;
    }
    const m: Record<string, PayrollOverride> = {};
    (data || []).forEach((row: any) => {
      m[row.employee_id] = {
        base_salary: row.base_salary,
        ot_pay: row.ot_pay,
        diligence: row.diligence,
        ssf: row.ssf,
        tax: row.tax,
      };
    });
    setOverrideMap(m);
  }, [selectedYear, selectedMonth]);

  useEffect(() => { fetchOverrides(); }, [fetchOverrides]);

  const setOverrideField = useCallback(async (
    employeeId: string,
    field: keyof PayrollOverride,
    value: number,
  ) => {
    // Optimistic update
    setOverrideMap((prev) => ({
      ...prev,
      [employeeId]: { ...(prev[employeeId] || {}), [field]: value },
    }));
    const existing = overrideMap[employeeId];
    const payload: any = {
      employee_id: employeeId,
      year: selectedYear,
      month: selectedMonth,
      ...(existing || {}),
      [field]: value,
    };
    const { error } = await supabase
      .from("payroll_overrides")
      .upsert(payload, { onConflict: "employee_id,year,month" });
    if (error) {
      console.error(error);
      toast.error("บันทึกค่าไม่สำเร็จ: " + error.message);
      fetchOverrides();
    }
  }, [overrideMap, selectedMonth, selectedYear, fetchOverrides]);


  const depts = useMemo(() => {
    const s = new Set(activeEmployees.map((e) => e.dept));
    return Array.from(s).sort();
  }, [activeEmployees]);

  // Period & snapshot integration
  const { period, payslips: snapshotRows, loading: periodLoading, refetch: refetchPeriod } = usePayrollPeriod(selectedYear, selectedMonth);
  const { user } = useAuth();
  const isPublished = period?.status === "published";
  const hasPeriod = !!period;

  const snapshotMap = useMemo(() => {
    const m: Record<string, PayslipRow> = {};
    snapshotRows.forEach((r) => { m[r.employee_id] = r; });
    return m;
  }, [snapshotRows]);

  const payrollData = useMemo(() => {
    return activeEmployees.map((emp) => {
      // If a period exists, prefer the frozen snapshot
      const snap = snapshotMap[emp.id];
      if (snap) {
        const att: AttendanceStats = snap.attendance || { workDays: 0, otHours: 0, lateDays: 0, absentDays: 0, leaveDays: 0 };
        const ov = overrideMap[emp.id];
        const salary = ov?.base_salary != null ? Number(ov.base_salary) : Number(snap.base_salary) || 0;
        const otPay = ov?.ot_pay != null ? Number(ov.ot_pay) : Number(snap.ot_pay) || 0;
        const diligence = ov?.diligence != null ? Number(ov.diligence) : Number(snap.diligence) || 0;
        const ssf = ov?.ssf != null ? Number(ov.ssf) : Number(snap.ssf) || 0;
        const monthlyTax = ov?.tax != null ? Number(ov.tax) : Number(snap.tax) || 0;
        const customIncome = Number(snap.custom_income) || 0;
        const customDeductions = Number(snap.custom_deduction) || 0;
        const grossPay = salary + otPay + diligence + customIncome;
        const totalDeduct = ssf + monthlyTax + customDeductions;
        const netPay = grossPay - totalDeduct;
        return {
          emp,
          payroll: {
            salary, otPay,
            otHours: Number(snap.ot_hours) || 0,
            diligence, grossPay, ssf, monthlyTax, totalDeduct, netPay,
            att,
            annualIncome: snap.tax_breakdown?.annualIncome || 0,
            deductions: emp.taxDeductions || { ...DEFAULT_TAX_DEDUCTION },
            customIncome, customDeductions,
            customItems: (snap.custom_items || []).map((i) => ({ ...i, enabled: true })) as CustomPayrollItem[],
          },
          fromSnapshot: true as const,
        };
      }
      const att = attendanceMap[emp.id] || { workDays: 0, otHours: 0, lateDays: 0, absentDays: 0, leaveDays: 0 };
      return { emp, payroll: calcPayroll(emp, PAYROLL_CONFIG, att, overrideMap[emp.id]), fromSnapshot: false as const };
    });
  }, [activeEmployees, attendanceMap, snapshotMap, overrideMap]);

  /* ─── Collect all unique custom item names across employees ─── */
  const dynamicColumns = useMemo(() => {
    const incomeNames = new Map<string, string>();
    const deductionNames = new Map<string, string>();
    activeEmployees.forEach((emp) => {
      (emp.customPayrollItems || []).forEach((item) => {
        if (!item.name.trim()) return;
        if (item.type === "income" && !incomeNames.has(item.name)) incomeNames.set(item.name, item.id);
        if (item.type === "deduction" && !deductionNames.has(item.name)) deductionNames.set(item.name, item.id);
      });
    });
    return {
      income: Array.from(incomeNames.keys()),
      deduction: Array.from(deductionNames.keys()),
    };
  }, [activeEmployees]);

  const filtered = useMemo(() => {
    let list = payrollData;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(({ emp }) =>
        `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(q) ||
        emp.position.toLowerCase().includes(q)
      );
    }
    if (filterDept !== "all") {
      list = list.filter(({ emp }) => emp.dept === filterDept);
    }
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = `${a.emp.firstName}`.localeCompare(`${b.emp.firstName}`);
      else if (sortField === "salary") cmp = a.payroll.salary - b.payroll.salary;
      else cmp = a.payroll.netPay - b.payroll.netPay;
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [payrollData, search, filterDept, sortField, sortAsc]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [search, filterDept, pageSize]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const totals = useMemo(() => {
    return payrollData.reduce(
      (acc, { payroll }) => ({
        gross: acc.gross + payroll.grossPay,
        tax: acc.tax + payroll.monthlyTax,
        ssf: acc.ssf + payroll.ssf,
        net: acc.net + payroll.netPay,
      }),
      { gross: 0, tax: 0, ssf: 0, net: 0 }
    );
  }, [payrollData]);

  const openPayslip = (emp: Employee) => { setSelectedEmp(emp); setPayslipOpen(true); };
  const openCustomItems = (emp: Employee) => { setCustomItemsEmp(emp); setCustomItemsOpen(true); };

  const handleSaveCustomItems = (items: CustomPayrollItem[]) => {
    if (customItemsEmp) updateEmployee(customItemsEmp.id, { customPayrollItems: items });
  };

  const updateCustomItemAmount = useCallback((emp: Employee, itemName: string, type: "income" | "deduction", newAmount: number) => {
    const items = [...(emp.customPayrollItems || [])];
    const idx = items.findIndex((i) => i.name === itemName && i.type === type);
    if (idx >= 0) {
      items[idx] = { ...items[idx], amount: newAmount };
    } else {
      items.push({ id: crypto.randomUUID(), name: itemName, type, amount: newAmount, enabled: true });
    }
    updateEmployee(emp.id, { customPayrollItems: items });
  }, [updateEmployee]);

  const getCustomItemAmount = (emp: Employee, itemName: string, type: "income" | "deduction"): number => {
    const item = (emp.customPayrollItems || []).find((i) => i.name === itemName && i.type === type && i.enabled);
    return item?.amount || 0;
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return null;
    return sortAsc ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />;
  };

  const totalDynColSpan = 4 + 1 + dynamicColumns.income.length + 3 + dynamicColumns.deduction.length + 1 + 1;

  const thaiYear = selectedYear + 543;

  /* ─── Period actions: calculate, publish, unpublish ─── */
  const [savingPeriod, setSavingPeriod] = useState(false);

  const computeAndSavePayslips = useCallback(async () => {
    setSavingPeriod(true);
    try {
      // Ensure period exists
      let periodId = period?.id;
      if (!periodId) {
        const { data: newPer, error } = await supabase
          .from("payroll_periods")
          .insert({ year: selectedYear, month: selectedMonth, status: "draft" })
          .select()
          .single();
        if (error) throw error;
        periodId = newPer.id;
      } else if (isPublished) {
        toast.error("รอบนี้เผยแพร่แล้ว — ต้องยกเลิกการเผยแพร่ก่อนคำนวณใหม่");
        setSavingPeriod(false);
        return;
      }

      // Compute snapshots for all active employees
      const rows = activeEmployees.map((emp) => {
        const att = attendanceMap[emp.id] || { workDays: 0, otHours: 0, lateDays: 0, absentDays: 0, leaveDays: 0 };
        const p = calcPayroll(emp, PAYROLL_CONFIG, att, overrideMap[emp.id]);
        const expenseDeduction = calculateExpenseDeduction(p.annualIncome);
        const totalDeductions = calculateTotalDeductions(p.deductions);
        const netIncome = Math.max(0, p.annualIncome - expenseDeduction - totalDeductions);
        const annualTax = calculateProgressiveTax(netIncome);
        return {
          period_id: periodId,
          employee_id: emp.id,
          base_salary: p.salary,
          ot_pay: p.otPay,
          ot_hours: p.otHours,
          diligence: p.diligence,
          custom_income: p.customIncome,
          custom_deduction: p.customDeductions,
          gross_pay: p.grossPay,
          ssf: p.ssf,
          tax: p.monthlyTax,
          total_deduct: p.totalDeduct,
          net_pay: p.netPay,
          attendance: att as any,
          custom_items: p.customItems as any,
          tax_breakdown: { annualIncome: p.annualIncome, expenseDeduction, totalDeductions, netIncome, annualTax } as any,
        };
      });

      // Wipe existing snapshots for this period, then re-insert (simple recompute strategy)
      await supabase.from("payslips").delete().eq("period_id", periodId);
      const { error: insErr } = await supabase.from("payslips").insert(rows);
      if (insErr) throw insErr;

      await refetchPeriod();
      toast.success(`บันทึกสลิปเดือน ${THAI_MONTHS[selectedMonth - 1]} ${thaiYear} แล้ว (${rows.length} คน)`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "บันทึกสลิปไม่สำเร็จ");
    } finally {
      setSavingPeriod(false);
    }
  }, [period?.id, isPublished, selectedYear, selectedMonth, activeEmployees, attendanceMap, overrideMap, refetchPeriod, thaiYear]);

  const publishPeriod = useCallback(async () => {
    if (!period) return;
    setSavingPeriod(true);
    try {
      const { error } = await supabase
        .from("payroll_periods")
        .update({ status: "published", published_at: new Date().toISOString(), published_by: user?.id || null })
        .eq("id", period.id);
      if (error) throw error;

      // Notify employees with a payslip in this period
      const empIds = snapshotRows.map((r) => r.employee_id);
      if (empIds.length > 0) {
        const { data: empUsers } = await supabase
          .from("employees")
          .select("id, user_id")
          .in("id", empIds);
        const notes = (empUsers || [])
          .filter((e: any) => e.user_id)
          .map((e: any) => ({
            user_id: e.user_id,
            title: `สลิปเงินเดือนเดือน ${THAI_MONTHS[selectedMonth - 1]} ${thaiYear}`,
            description: "พร้อมให้ดาวน์โหลดแล้วในเมนู 'สลิปเงินเดือนของฉัน'",
            type: "system",
            action_label: "เปิดดู",
          }));
        if (notes.length > 0) await supabase.from("app_notifications").insert(notes);
      }

      await refetchPeriod();
      toast.success("เผยแพร่สลิปให้พนักงานเรียบร้อย");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "เผยแพร่ไม่สำเร็จ");
    } finally {
      setSavingPeriod(false);
    }
  }, [period, snapshotRows, selectedMonth, thaiYear, refetchPeriod, user?.id]);

  const unpublishPeriod = useCallback(async () => {
    if (!period) return;
    if (!confirm("ยกเลิกการเผยแพร่สลิปเดือนนี้?")) return;
    setSavingPeriod(true);
    try {
      const { error } = await supabase
        .from("payroll_periods")
        .update({ status: "draft", published_at: null, published_by: null })
        .eq("id", period.id);
      if (error) throw error;
      await refetchPeriod();
      toast.success("ยกเลิกการเผยแพร่แล้ว");
    } catch (e: any) {
      toast.error(e?.message || "ยกเลิกไม่สำเร็จ");
    } finally {
      setSavingPeriod(false);
    }
  }, [period, refetchPeriod]);


  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display">ระบบเงินเดือน</h2>
          <p className="text-sm text-muted-foreground mt-0.5">สรุปเงินเดือนประจำเดือน {THAI_MONTHS[selectedMonth - 1]} {thaiYear}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Month/Year selector */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-2 text-sm rounded-xl border bg-muted/30 outline-none cursor-pointer"
          >
            {THAI_MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 text-sm rounded-xl border bg-muted/30 outline-none cursor-pointer"
          >
            {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map((y) => (
              <option key={y} value={y}>{y + 543}</option>
            ))}
          </select>
          <button onClick={() => { exportAllPayslipsExcel(employees); toast.success("ส่งออกสลิปเงินเดือนทั้งหมด Excel สำเร็จ"); }} className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">
            <Download className="w-4 h-4" /> Export Excel
          </button>
          <button onClick={async () => { await exportPnd1Pdf(employees, THAI_MONTHS[selectedMonth - 1], String(thaiYear)); toast.success("ส่งออก ภ.ง.ด.1 PDF สำเร็จ"); }} className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">
            <FileText className="w-4 h-4" /> ภ.ง.ด.1 PDF
          </button>
        </div>
      </div>

      {/* Period status banner */}
      <div
        className="card-base p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between"
        style={{
          borderLeft: `4px solid ${isPublished ? "hsl(142 70% 40%)" : hasPeriod ? "hsl(31 100% 53%)" : "hsl(var(--muted-foreground))"}`,
        }}
      >
        <div className="flex items-center gap-3">
          <Receipt className="w-5 h-5 text-muted-foreground" />
          <div>
            <p className="font-semibold">
              รอบเงินเดือน {THAI_MONTHS[selectedMonth - 1]} {thaiYear}
              <span
                className="ml-2 inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                style={{
                  background: isPublished ? "hsl(142 70% 90%)" : hasPeriod ? "hsl(31 100% 93%)" : "hsl(var(--muted))",
                  color: isPublished ? "hsl(142 70% 30%)" : hasPeriod ? "hsl(31 100% 40%)" : "hsl(var(--muted-foreground))",
                }}
              >
                {isPublished ? "เผยแพร่แล้ว" : hasPeriod ? "ฉบับร่าง" : "ยังไม่ได้คำนวณ"}
              </span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isPublished
                ? `เผยแพร่เมื่อ ${period?.published_at ? new Date(period.published_at).toLocaleString("th-TH") : "-"} • พนักงานเห็นสลิปของตัวเองได้แล้ว`
                : hasPeriod
                ? `บันทึกสลิป ${snapshotRows.length} คน — ตรวจสอบและกด 'เผยแพร่' เพื่อส่งให้พนักงาน`
                : "ตัวเลขด้านล่างคำนวณจากข้อมูลล่าสุด กดปุ่มเพื่อบันทึกเป็นสลิปประจำเดือนนี้"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isPublished && (
            <Button onClick={computeAndSavePayslips} disabled={savingPeriod || loadingData} size="sm">
              <Calculator className="w-4 h-4 mr-1.5" />
              {hasPeriod ? "คำนวณใหม่" : "คำนวณและบันทึกสลิปเดือนนี้"}
            </Button>
          )}
          {hasPeriod && !isPublished && (
            <Button onClick={publishPeriod} disabled={savingPeriod || snapshotRows.length === 0} size="sm" variant="default">
              <FileText className="w-4 h-4 mr-1.5" />
              เผยแพร่ให้พนักงาน
            </Button>
          )}
          {isPublished && (
            <Button onClick={unpublishPeriod} disabled={savingPeriod} size="sm" variant="outline">
              ยกเลิกการเผยแพร่
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={Banknote} label="รายได้รวม" value={`฿${formatCurrency(totals.gross)}`} color="hsl(var(--primary))" bg="hsl(var(--primary) / 0.1)" />
        <SummaryCard icon={Calculator} label="ภาษีหัก ณ ที่จ่าย" value={`฿${formatCurrency(totals.tax)}`} color="hsl(31 100% 53%)" bg="hsl(31 100% 93%)" />
        <SummaryCard icon={ShieldCheck} label="ประกันสังคม" value={`฿${formatCurrency(totals.ssf)}`} color="hsl(220 90% 50%)" bg="hsl(220 90% 93%)" />
        <SummaryCard icon={Wallet} label="เงินได้สุทธิรวม" value={`฿${formatCurrency(totals.net)}`} color="hsl(90 100% 30%)" bg="hsl(90 100% 92%)" />
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="w-4 h-4" />
        <span>พนักงานที่คำนวณเงินเดือน: <strong className="text-foreground">{activeEmployees.length}</strong> คน</span>
        {loadingData && <span className="text-xs animate-pulse ml-2">กำลังโหลดข้อมูล...</span>}
      </div>

      {/* Filters */}
      <div className="card-base p-4 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input type="text" placeholder="ค้นหาพนักงาน..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border bg-muted/30 outline-none" />
        </div>
        <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="flex-1 min-w-[120px] px-3 py-2 text-sm rounded-xl border bg-muted/30 outline-none cursor-pointer">
          <option value="all">ทุกแผนก</option>
          {depts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
          className="flex-1 min-w-[120px] px-3 py-2 text-sm rounded-xl border bg-muted/30 outline-none cursor-pointer"
        >
          {THAI_MONTHS.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="min-w-[100px] px-3 py-2 text-sm rounded-xl border bg-muted/30 outline-none cursor-pointer"
        >
          {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map((y) => (
            <option key={y} value={y}>{y + 543}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card-base overflow-hidden">
        <div className="overflow-auto max-h-[85vh]">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="sticky top-0 z-20">
              <tr style={{ background: "hsl(var(--muted))" }}>
                <th className="text-left px-4 py-3 font-semibold sticky left-0 z-30" style={{ background: "hsl(var(--muted))" }}>พนักงาน</th>
                <th className="text-right px-3 py-3 font-semibold cursor-pointer select-none" onClick={() => toggleSort("salary")}>
                  เงินเดือน <SortIcon field="salary" />
                </th>
                <th className="text-right px-3 py-3 font-semibold">OT</th>
                <th className="text-right px-3 py-3 font-semibold">เบี้ยขยัน</th>
                {dynamicColumns.income.map((name) => (
                  <th key={`h-inc-${name}`} className="text-right px-3 py-3 font-semibold text-emerald-600">{name}</th>
                ))}
                <th className="text-right px-3 py-3 font-semibold">ประกันสังคม</th>
                <th className="text-right px-3 py-3 font-semibold">ภาษี</th>
                {dynamicColumns.deduction.map((name) => (
                  <th key={`h-ded-${name}`} className="text-right px-3 py-3 font-semibold text-red-500">{name}</th>
                ))}
                <th className="text-right px-3 py-3 font-semibold cursor-pointer select-none" onClick={() => toggleSort("net")}>
                  สุทธิ <SortIcon field="net" />
                </th>
                <th className="text-center px-3 py-3 font-semibold w-24">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map(({ emp, payroll }) => (
                <tr key={emp.id} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 sticky left-0 z-10 bg-background">
                    <div className="flex items-center gap-2.5">
                      <EmployeeAvatar photoUrl={emp.photoUrl} avatar={emp.avatar} avatarColor={emp.avatarColor} avatarTextColor={emp.avatarTextColor} firstName={emp.firstName} size="sm" rounded="lg" />
                      <div>
                        <p className="font-medium leading-tight">{emp.firstName} {emp.lastName}</p>
                        <p className="text-xs text-muted-foreground">{emp.position}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-right px-3 py-3">
                    <EditableCell value={payroll.salary} onChange={(v) => setOverrideField(emp.id, "base_salary", v)} />
                  </td>
                  <td className="text-right px-3 py-3">
                    <EditableCell value={payroll.otPay} onChange={(v) => setOverrideField(emp.id, "ot_pay", v)} />
                  </td>
                  <td className="text-right px-3 py-3">
                    <EditableCell value={payroll.diligence} onChange={(v) => setOverrideField(emp.id, "diligence", v)} />
                  </td>
                  {dynamicColumns.income.map((name) => (
                    <td key={`${emp.id}-inc-${name}`} className="text-right px-3 py-3">
                      <EditableCell
                        value={getCustomItemAmount(emp, name, "income")}
                        onChange={(v) => updateCustomItemAmount(emp, name, "income", v)}
                      />
                    </td>
                  ))}
                  <td className="text-right px-3 py-3">
                    <EditableCell value={payroll.ssf} onChange={(v) => setOverrideField(emp.id, "ssf", v)} />
                  </td>
                  <td className="text-right px-3 py-3">
                    <EditableCell value={payroll.monthlyTax} onChange={(v) => setOverrideField(emp.id, "tax", v)} />
                  </td>
                  {dynamicColumns.deduction.map((name) => (
                    <td key={`${emp.id}-ded-${name}`} className="text-right px-3 py-3">
                      <EditableCell
                        value={getCustomItemAmount(emp, name, "deduction")}
                        onChange={(v) => updateCustomItemAmount(emp, name, "deduction", v)}
                      />
                    </td>
                  ))}
                  <td className="text-right px-3 py-3 tabular-nums font-semibold" style={{ color: "hsl(var(--primary))" }}>{formatCurrency(payroll.netPay)}</td>
                  <td className="text-center px-3 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openPayslip(emp)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="ดูสลิปเงินเดือน"><Eye className="w-4 h-4 text-muted-foreground" /></button>
                      <button onClick={() => openCustomItems(emp)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="แก้ไขรายการเพิ่มเติม"><Settings2 className="w-4 h-4 text-muted-foreground" /></button>
                      <button onClick={async () => {
                        const snap = snapshotMap[emp.id];
                        if (snap) {
                          await exportPayslipPdfFromSnapshot(emp, snap, THAI_MONTHS[selectedMonth - 1], thaiYear);
                        } else {
                          await exportPayslipPdf(emp, THAI_MONTHS[selectedMonth - 1], thaiYear);
                        }
                        toast.success(`ส่งออกสลิป PDF: ${emp.firstName}`);
                      }} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="ส่งออก PDF"><FileText className="w-3.5 h-3.5 text-muted-foreground" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedData.length === 0 && (
                <tr><td colSpan={totalDynColSpan} className="text-center py-8 text-muted-foreground">ไม่พบข้อมูล</td></tr>
              )}
            </tbody>
            {paginatedData.length > 0 && (
              <tfoot>
                <tr className="border-t-2 font-semibold" style={{ background: "hsl(var(--muted) / 0.5)" }}>
                  <td className="px-4 py-3 sticky left-0 z-10" style={{ background: "hsl(var(--muted) / 0.5)" }}>รวมทั้งหมด ({filtered.length} คน)</td>
                  <td className="text-right px-3 py-3 tabular-nums">{formatCurrency(filtered.reduce((s, r) => s + r.payroll.salary, 0))}</td>
                  <td className="text-right px-3 py-3 tabular-nums">{formatCurrency(filtered.reduce((s, r) => s + r.payroll.otPay, 0))}</td>
                  <td className="text-right px-3 py-3 tabular-nums">{formatCurrency(filtered.reduce((s, r) => s + r.payroll.diligence, 0))}</td>
                  {dynamicColumns.income.map((name) => (
                    <td key={`tot-inc-${name}`} className="text-right px-3 py-3 tabular-nums">
                      {formatCurrency(filtered.reduce((s, { emp }) => s + getCustomItemAmount(emp, name, "income"), 0))}
                    </td>
                  ))}
                  <td className="text-right px-3 py-3 tabular-nums">{formatCurrency(filtered.reduce((s, r) => s + r.payroll.ssf, 0))}</td>
                  <td className="text-right px-3 py-3 tabular-nums">{formatCurrency(filtered.reduce((s, r) => s + r.payroll.monthlyTax, 0))}</td>
                  {dynamicColumns.deduction.map((name) => (
                    <td key={`tot-ded-${name}`} className="text-right px-3 py-3 tabular-nums">
                      {formatCurrency(filtered.reduce((s, { emp }) => s + getCustomItemAmount(emp, name, "deduction"), 0))}
                    </td>
                  ))}
                  <td className="text-right px-3 py-3 tabular-nums" style={{ color: "hsl(var(--primary))" }}>{formatCurrency(filtered.reduce((s, r) => s + r.payroll.netPay, 0))}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>แสดง</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2 py-1 rounded-lg border bg-muted/30 outline-none cursor-pointer text-sm"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span>รายการ จาก {filtered.length} รายการ</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce<(number | "...")[]>((acc, p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1]) > 1) acc.push("...");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === "..." ? (
                    <span key={`ellipsis-${i}`} className="px-2 text-sm text-muted-foreground">...</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p as number)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        currentPage === p
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedEmp && (
        <PayslipDialog open={payslipOpen} onClose={() => setPayslipOpen(false)} emp={selectedEmp} payroll={calcPayroll(selectedEmp, PAYROLL_CONFIG, attendanceMap[selectedEmp.id] || { workDays: 0, otHours: 0, lateDays: 0, absentDays: 0, leaveDays: 0 })} />
      )}

      {customItemsEmp && (
        <CustomItemsDialog open={customItemsOpen} onClose={() => setCustomItemsOpen(false)} emp={customItemsEmp} onSave={handleSaveCustomItems} />
      )}
    </div>
  );
};

export default Payroll;
