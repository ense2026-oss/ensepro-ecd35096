import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useEmployees, Employee, CustomPayrollItem } from "@/contexts/EmployeeContext";
import {
  Banknote, Users, TrendingUp, FileText, Search, Download, Eye, X,
  Calculator, Receipt, Wallet, ShieldCheck, ChevronDown, ChevronUp, Settings2, Plus, Trash2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  calculateAnnualIncome, calculateExpenseDeduction, calculateTotalDeductions,
  calculateProgressiveTax, calculateMonthlyTax, formatCurrency,
  DEFAULT_TAX_DEDUCTION, type TaxConfig, type TaxDeduction,
} from "@/utils/taxCalculation";
import { toast } from "sonner";
import { exportPnd1Excel, exportPnd1Pdf, exportPayslipExcel, exportPayslipPdf, exportAllPayslipsExcel } from "@/utils/exportPayroll";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

/* ─── Mock payroll config ─── */
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

/* ─── Mock attendance data ─── */
const mockAttendanceData: Record<string, { workDays: number; otHours: number; lateDays: number; absentDays: number; leaveDays: number }> = {
  "a3f1b2c4-1234-5678-90ab-cdef01234567": { workDays: 22, otHours: 12, lateDays: 0, absentDays: 0, leaveDays: 0 },
  "b4e2c3d5-2345-6789-01bc-def012345678": { workDays: 21, otHours: 4, lateDays: 1, absentDays: 0, leaveDays: 1 },
  "c5f3d4e6-3456-7890-12cd-ef0123456789": { workDays: 22, otHours: 20, lateDays: 0, absentDays: 0, leaveDays: 0 },
  "d6g4e5f7-4567-8901-23de-f01234567890": { workDays: 15, otHours: 0, lateDays: 0, absentDays: 0, leaveDays: 7 },
  "e7h5f6g8-5678-9012-34ef-012345678901": { workDays: 22, otHours: 18, lateDays: 2, absentDays: 0, leaveDays: 0 },
  "f8i6g7h9-6789-0123-45f0-123456789012": { workDays: 20, otHours: 6, lateDays: 0, absentDays: 2, leaveDays: 0 },
  "g9j7h8i0-7890-1234-56g1-234567890123": { workDays: 0, otHours: 0, lateDays: 0, absentDays: 0, leaveDays: 0 },
  "h0k8i9j1-8901-2345-67h2-345678901234": { workDays: 22, otHours: 2, lateDays: 0, absentDays: 0, leaveDays: 0 },
  "i1l9j0k2-9012-3456-78i3-456789012345": { workDays: 22, otHours: 0, lateDays: 0, absentDays: 0, leaveDays: 0 },
};

/* ─── Calculation helpers ─── */
function calcPayroll(emp: Employee, config: typeof PAYROLL_CONFIG) {
  const salary = Number(emp.salary) || 0;
  const att = mockAttendanceData[emp.id] || { workDays: 22, otHours: 0, lateDays: 0, absentDays: 0, leaveDays: 0 };

  const hourlyRate = salary / 30 / 8;
  const otPay = Math.round(att.otHours * hourlyRate * config.otRateWorkday);
  const diligence = config.diligenceEnabled && att.lateDays === 0 && att.absentDays === 0 ? config.diligenceAmount : 0;

  const customItems = (emp.customPayrollItems || []).filter((i) => i.enabled);
  const customIncome = customItems.filter((i) => i.type === "income").reduce((s, i) => s + i.amount, 0);
  const customDeductions = customItems.filter((i) => i.type === "deduction").reduce((s, i) => s + i.amount, 0);

  const grossPay = salary + otPay + diligence + customIncome;
  const ssf = config.ssfEnabled ? Math.min(Math.round(salary * config.ssfRate / 100), config.ssfCeiling) : 0;

  const deductions: TaxDeduction = emp.taxDeductions || { ...DEFAULT_TAX_DEDUCTION };
  const annualIncome = calculateAnnualIncome(salary, otPay, diligence + customIncome);
  const monthlyTax = calculateMonthlyTax(config.taxConfig, annualIncome, deductions);

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
      {value > 0 ? formatCurrency(value) : "-"}
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
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" style={{ color: "hsl(var(--primary))" }} />
            แก้ไขรายการ - {emp.firstName} {emp.lastName}
          </DialogTitle>
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
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" style={{ color: "hsl(var(--primary))" }} />
            สลิปเงินเดือน - {emp.firstName} {emp.lastName}
          </DialogTitle>
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

  const activeEmployees = useMemo(() => employees.filter((e) => e.status === "active"), [employees]);

  const depts = useMemo(() => {
    const s = new Set(activeEmployees.map((e) => e.dept));
    return Array.from(s).sort();
  }, [activeEmployees]);

  const payrollData = useMemo(() => {
    return activeEmployees.map((emp) => ({ emp, payroll: calcPayroll(emp, PAYROLL_CONFIG) }));
  }, [activeEmployees]);

  /* ─── Collect all unique custom item names across employees ─── */
  const dynamicColumns = useMemo(() => {
    const incomeNames = new Map<string, string>(); // name -> first seen id
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

  /* ─── Inline edit helper: update a specific custom item amount by name ─── */
  const updateCustomItemAmount = useCallback((emp: Employee, itemName: string, type: "income" | "deduction", newAmount: number) => {
    const items = [...(emp.customPayrollItems || [])];
    const idx = items.findIndex((i) => i.name === itemName && i.type === type);
    if (idx >= 0) {
      items[idx] = { ...items[idx], amount: newAmount };
    } else {
      // auto-create the item for this employee
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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display">ระบบเงินเดือน</h2>
          <p className="text-sm text-muted-foreground mt-0.5">สรุปเงินเดือนประจำเดือน กุมภาพันธ์ 2569</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => { exportAllPayslipsExcel(employees); toast.success("ส่งออกสลิปเงินเดือนทั้งหมด Excel สำเร็จ"); }} className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">
            <Download className="w-4 h-4" /> Export Excel
          </button>
          <button onClick={async () => { await exportPnd1Pdf(employees, "กุมภาพันธ์", "2569"); toast.success("ส่งออก ภ.ง.ด.1 PDF สำเร็จ"); }} className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">
            <FileText className="w-4 h-4" /> ภ.ง.ด.1 PDF
          </button>
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
      </div>

      {/* Table */}
      <div className="card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr style={{ background: "hsl(var(--muted))" }}>
                <th className="text-left px-4 py-3 font-semibold sticky left-0 z-10" style={{ background: "hsl(var(--muted))" }}>พนักงาน</th>
                <th className="text-right px-3 py-3 font-semibold cursor-pointer select-none" onClick={() => toggleSort("salary")}>
                  เงินเดือน <SortIcon field="salary" />
                </th>
                <th className="text-right px-3 py-3 font-semibold">OT</th>
                <th className="text-right px-3 py-3 font-semibold">เบี้ยขยัน</th>
                {/* Dynamic income columns */}
                {dynamicColumns.income.map((name) => (
                  <th key={`h-inc-${name}`} className="text-right px-3 py-3 font-semibold text-emerald-600">{name}</th>
                ))}
                <th className="text-right px-3 py-3 font-semibold">ประกันสังคม</th>
                <th className="text-right px-3 py-3 font-semibold">ภาษี</th>
                {/* Dynamic deduction columns */}
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
              {filtered.map(({ emp, payroll }) => (
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
                  <td className="text-right px-3 py-3">{formatCurrency(payroll.salary)}</td>
                  <td className="text-right px-3 py-3 tabular-nums">{formatCurrency(payroll.otPay)}</td>
                  <td className="text-right px-3 py-3 tabular-nums">{formatCurrency(payroll.diligence)}</td>
                  {/* Dynamic income cells — inline editable */}
                  {dynamicColumns.income.map((name) => (
                    <td key={`${emp.id}-inc-${name}`} className="text-right px-3 py-3">
                      <EditableCell
                        value={getCustomItemAmount(emp, name, "income")}
                        onChange={(v) => updateCustomItemAmount(emp, name, "income", v)}
                      />
                    </td>
                  ))}
                  <td className="text-right px-3 py-3 tabular-nums">{formatCurrency(payroll.ssf)}</td>
                  <td className="text-right px-3 py-3 tabular-nums">{formatCurrency(payroll.monthlyTax)}</td>
                  {/* Dynamic deduction cells — inline editable */}
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
                      <button onClick={async () => { await exportPayslipPdf(emp); toast.success(`ส่งออกสลิป PDF: ${emp.firstName}`); }} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="ส่งออก PDF"><FileText className="w-3.5 h-3.5 text-muted-foreground" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={totalDynColSpan} className="text-center py-8 text-muted-foreground">ไม่พบข้อมูล</td></tr>
              )}
            </tbody>
            {filtered.length > 0 && (
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
      </div>

      {selectedEmp && (
        <PayslipDialog open={payslipOpen} onClose={() => setPayslipOpen(false)} emp={selectedEmp} payroll={calcPayroll(selectedEmp, PAYROLL_CONFIG)} />
      )}

      {customItemsEmp && (
        <CustomItemsDialog open={customItemsOpen} onClose={() => setCustomItemsOpen(false)} emp={customItemsEmp} onSave={handleSaveCustomItems} />
      )}
    </div>
  );
};

export default Payroll;
