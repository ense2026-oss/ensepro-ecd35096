/* ───────────────────── Payroll Export Utilities ───────────────────── */
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { registerThaiFont } from "@/utils/thaiFontLoader";
import { createExcelWithHeader, addExcelHeader } from "@/utils/excelHeader";
import { supabase } from "@/integrations/supabase/client";
import type { Employee } from "@/contexts/EmployeeContext";

async function fetchCompanyLogo(): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("company_settings")
      .select("value")
      .eq("key", "branding")
      .maybeSingle();
    const v = data?.value as any;
    return v?.logoOnlyUrl || v?.logoUrl || null;
  } catch {
    return null;
  }
}

async function urlToDataUrl(url: string): Promise<{ dataUrl: string; format: string } | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const format = blob.type.includes("png") ? "PNG" : blob.type.includes("jpeg") || blob.type.includes("jpg") ? "JPEG" : "PNG";
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve({ dataUrl: reader.result as string, format });
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
import {
  calculateAnnualIncome, calculateMonthlyTax, calculateExpenseDeduction,
  calculateTotalDeductions, calculateProgressiveTax, formatCurrency,
  DEFAULT_TAX_DEDUCTION, type TaxConfig, type TaxDeduction,
} from "@/utils/taxCalculation";

/* ─── Payroll config (live from settings, same source as the Payroll page) ─── */
import { fetchPayrollConfig, DEFAULT_PAYROLL_CONFIG, type PayrollConfig } from "@/utils/payrollConfig";

let PAYROLL_CONFIG: PayrollConfig = { ...DEFAULT_PAYROLL_CONFIG };

export interface ExportAttendanceSummary {
  workDays: number; otHours: number; lateDays: number; absentDays: number; leaveDays: number;
}

const EMPTY_ATTENDANCE: ExportAttendanceSummary = { workDays: 0, otHours: 0, lateDays: 0, absentDays: 0, leaveDays: 0 };

let attendanceByEmployee: Record<string, ExportAttendanceSummary> = {};

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Load live payroll settings + real attendance/OT for the given period.
 * Must be awaited before calling the export functions below.
 */
export async function primePayrollExportData(year: number, month: number): Promise<void> {
  PAYROLL_CONFIG = await fetchPayrollConfig();
  attendanceByEmployee = {};

  const from = `${year}-${pad2(month)}-01`;
  const to = `${year}-${pad2(month)}-31`;

  const [attRes, otRes, leaveRes] = await Promise.all([
    supabase.from("attendance_records").select("employee_id,status,late,date").gte("date", from).lte("date", to),
    supabase.from("overtime_requests").select("employee_id,hours,date,status").gte("date", from).lte("date", to).eq("status", "approved"),
    supabase.from("leave_requests").select("employee_id,days,date_from,status").gte("date_from", from).lte("date_from", to).eq("status", "approved"),
  ]);

  const bucket = (id: string) => (attendanceByEmployee[id] ||= { ...EMPTY_ATTENDANCE });

  (attRes.data || []).forEach((r: any) => {
    const b = bucket(r.employee_id);
    if (r.status === "absent") b.absentDays += 1;
    else if (r.status !== "dayoff") b.workDays += 1;
    if (r.late) b.lateDays += 1;
  });
  (otRes.data || []).forEach((r: any) => { bucket(r.employee_id).otHours += Number(r.hours) || 0; });
  (leaveRes.data || []).forEach((r: any) => { bucket(r.employee_id).leaveDays += Number(r.days) || 0; });
}

function calcPayrollForExport(emp: Employee) {
  const salary = Number(emp.salary) || 0;
  const att = attendanceByEmployee[emp.id] || { ...EMPTY_ATTENDANCE };
  const hourlyRate = salary / 30 / 8;
  const otPay = PAYROLL_CONFIG.otEnabled ? Math.round(att.otHours * hourlyRate * PAYROLL_CONFIG.otRateWorkday) : 0;
  const tooLate = PAYROLL_CONFIG.deductLate && att.lateDays >= PAYROLL_CONFIG.lateThreshold;
  const tooAbsent = PAYROLL_CONFIG.deductAbsent && att.absentDays >= PAYROLL_CONFIG.absentThreshold;
  const diligence = PAYROLL_CONFIG.diligenceEnabled && !tooLate && !tooAbsent ? PAYROLL_CONFIG.diligenceAmount : 0;

  const customItems = (emp.customPayrollItems || []).filter((i) => i.enabled);
  const customIncome = customItems.filter((i) => i.type === "income").reduce((s, i) => s + i.amount, 0);
  const customDeductions = customItems.filter((i) => i.type === "deduction").reduce((s, i) => s + i.amount, 0);

  const grossPay = salary + otPay + diligence + customIncome;
  const ssf = PAYROLL_CONFIG.ssfEnabled ? Math.min(Math.round(salary * PAYROLL_CONFIG.ssfRate / 100), PAYROLL_CONFIG.ssfCeiling) : 0;
  const deductions: TaxDeduction = emp.taxDeductions || { ...DEFAULT_TAX_DEDUCTION };
  const annualIncome = calculateAnnualIncome(salary, otPay, diligence + customIncome);
  const monthlyTax = calculateMonthlyTax(PAYROLL_CONFIG.taxConfig, annualIncome, deductions);
  const totalDeduct = ssf + monthlyTax + customDeductions;
  const netPay = grossPay - totalDeduct;
  return { salary, otPay, otHours: att.otHours, diligence, grossPay, ssf, monthlyTax, totalDeduct, netPay, att, annualIncome, deductions, customIncome, customDeductions, customItems };
}

/* ═══════════════════════ EXCEL EXPORTS ═══════════════════════ */

export function exportPnd1Excel(employees: Employee[], month: string, year: string) {
  const activeEmps = employees.filter((e) => e.status === "active");

  const headers = ["ลำดับ", "ชื่อ-สกุล", "เลขบัตรประชาชน", "เงินได้ (บาท)", "ภาษีหัก ณ ที่จ่าย (บาท)"];
  const rows: (string | number)[][] = activeEmps.map((emp, i) => {
    const p = calcPayrollForExport(emp);
    return [i + 1, `${emp.prefix}${emp.firstName} ${emp.lastName}`, emp.nationalId, p.grossPay, p.monthlyTax];
  });

  const totalIncome = activeEmps.reduce((s, e) => s + calcPayrollForExport(e).grossPay, 0);
  const totalTax = activeEmps.reduce((s, e) => s + calcPayrollForExport(e).monthlyTax, 0);
  rows.push(["", `รวมทั้งหมด (${activeEmps.length} คน)`, "", totalIncome, totalTax]);

  createExcelWithHeader({
    sheetName: "ภ.ง.ด.1",
    title: "รายงานภาษีหัก ณ ที่จ่าย (ภ.ง.ด.1)",
    subtitle: `ประจำเดือน ${month} พ.ศ. ${year}`,
    dateRange: `วันที่ออกรายงาน: ${new Date().toLocaleDateString("th-TH")}`,
    headers,
    rows,
    colWidths: [8, 25, 18, 15, 20],
    fileName: `PND1_${month}_${year}.xlsx`,
  });
}

export function exportPayslipExcel(emp: Employee) {
  const p = calcPayrollForExport(emp);
  const headers = ["รายการ", "จำนวน (บาท)"];
  const rows: (string | number)[][] = [
    ["เงินเดือน", p.salary],
    [`ค่าล่วงเวลา (${p.otHours} ชม.)`, p.otPay],
    ["เบี้ยขยัน", p.diligence],
  ];
  p.customItems.filter((i) => i.type === "income").forEach((item) => {
    rows.push([item.name, item.amount]);
  });
  rows.push(["รวมรายได้", p.grossPay], ["", ""], ["หัก: ประกันสังคม", -p.ssf], ["หัก: ภาษีหัก ณ ที่จ่าย", -p.monthlyTax]);
  p.customItems.filter((i) => i.type === "deduction").forEach((item) => {
    rows.push([`หัก: ${item.name}`, -item.amount]);
  });
  rows.push(["รวมหัก", -p.totalDeduct], ["", ""], ["เงินได้สุทธิ", p.netPay]);

  createExcelWithHeader({
    sheetName: "สลิปเงินเดือน",
    title: "สลิปเงินเดือน",
    subtitle: `${emp.prefix}${emp.firstName} ${emp.lastName} | ${emp.position} (${emp.dept})`,
    dateRange: `วันที่ออกรายงาน: ${new Date().toLocaleDateString("th-TH")}`,
    headers,
    rows,
    colWidths: [30, 18],
    fileName: `Payslip_${emp.firstName}_${emp.lastName}.xlsx`,
  });
}

export function exportAllPayslipsExcel(employees: Employee[]) {
  const activeEmps = employees.filter((e) => e.status === "active");
  const wb = XLSX.utils.book_new();

  activeEmps.forEach((emp) => {
    const p = calcPayrollForExport(emp);
    const ws = XLSX.utils.aoa_to_sheet([]);
    const headers = ["รายการ", "จำนวน (บาท)"];

    const dataStartRow = addExcelHeader({
      ws,
      title: "สลิปเงินเดือน",
      subtitle: `${emp.prefix}${emp.firstName} ${emp.lastName} | ${emp.position} (${emp.dept})`,
      dateRange: `วันที่ออกรายงาน: ${new Date().toLocaleDateString("th-TH")}`,
      columnCount: 2,
    });

    const rows: (string | number)[][] = [
      ["เงินเดือน", p.salary],
      [`ค่าล่วงเวลา (${p.otHours} ชม.)`, p.otPay],
      ["เบี้ยขยัน", p.diligence],
    ];
    p.customItems.filter((i) => i.type === "income").forEach((item) => {
      rows.push([item.name, item.amount]);
    });
    rows.push(["รวมรายได้", p.grossPay], ["", ""], ["หัก: ประกันสังคม", -p.ssf], ["หัก: ภาษีหัก ณ ที่จ่าย", -p.monthlyTax]);
    p.customItems.filter((i) => i.type === "deduction").forEach((item) => {
      rows.push([`หัก: ${item.name}`, -item.amount]);
    });
    rows.push(["รวมหัก", -p.totalDeduct], ["", ""], ["เงินได้สุทธิ", p.netPay]);

    XLSX.utils.sheet_add_aoa(ws, [headers], { origin: { r: dataStartRow, c: 0 } });
    XLSX.utils.sheet_add_aoa(ws, rows, { origin: { r: dataStartRow + 1, c: 0 } });
    ws["!cols"] = [{ wch: 35 }, { wch: 18 }];
    ws["!rows"] = [{ hpt: 24 }, { hpt: 22 }, { hpt: 18 }, { hpt: 10 }];

    const sheetName = `${emp.firstName}`.substring(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  XLSX.writeFile(wb, `Payslips_All.xlsx`);
}

/* ═══════════════════════ PDF EXPORTS ═══════════════════════ */

async function createPdf(landscape = false): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "mm", format: "a4" });
  await registerThaiFont(doc);
  return doc;
}

export async function exportPnd1Pdf(employees: Employee[], month: string, year: string) {
  const activeEmps = employees.filter((e) => e.status === "active");
  const doc = await createPdf(true);

  doc.setFontSize(18);
  doc.setFont("THSarabunNew", "bold");
  doc.text(`รายงานภาษีหัก ณ ที่จ่าย (ภ.ง.ด.1)`, 14, 18);
  doc.setFontSize(12);
  doc.setFont("THSarabunNew", "normal");
  doc.text(`ประจำเดือน ${month} พ.ศ. ${year}`, 14, 26);

  const rows = activeEmps.map((emp, i) => {
    const p = calcPayrollForExport(emp);
    return [i + 1, `${emp.prefix}${emp.firstName} ${emp.lastName}`, emp.nationalId, formatCurrency(p.grossPay), formatCurrency(p.monthlyTax)];
  });

  const totalIncome = activeEmps.reduce((s, e) => s + calcPayrollForExport(e).grossPay, 0);
  const totalTax = activeEmps.reduce((s, e) => s + calcPayrollForExport(e).monthlyTax, 0);
  rows.push(["", `รวมทั้งหมด (${activeEmps.length} คน)`, "", formatCurrency(totalIncome), formatCurrency(totalTax)]);

  autoTable(doc, {
    startY: 32,
    head: [["ลำดับ", "ชื่อ-สกุล", "เลขบัตรประชาชน", "เงินได้ (บาท)", "ภาษีหัก (บาท)"]],
    body: rows,
    styles: { fontSize: 11, font: "THSarabunNew" },
    headStyles: { fillColor: [14, 165, 233], font: "THSarabunNew", fontStyle: "bold" },
  });

  doc.save(`PND1_${month}_${year}.pdf`);
}

export async function exportPayslipPdf(emp: Employee, month?: string, year?: string | number, onProgress?: (pct: number) => void) {
  onProgress?.(5);
  const p = calcPayrollForExport(emp);
  const doc = await createPdf();
  onProgress?.(40);

  const incomes: PayslipLetterItem[] = [
    { label: "อัตราเงินเดือน", amount: p.salary },
    { label: "ค่าล่วงเวลา", amount: p.otPay },
    { label: "ค่าตอบแทนวิชาชีพ", amount: p.diligence + p.customIncome },
  ];
  const deductions: PayslipLetterItem[] = [
    { label: "ภาษีเงินได้หัก ณ ที่จ่าย", amount: p.monthlyTax },
    { label: "เงินประกันสังคม (5%)", amount: p.ssf },
  ];
  p.customItems.filter((i) => i.type === "deduction").forEach((i) => deductions.push({ label: i.name, amount: i.amount }));

  await renderPayslipLetter(doc, {
    employeeName: `${emp.prefix}${emp.firstName} ${emp.lastName}`,
    monthLabel: month || "",
    yearBE: year ?? "",
    incomes,
    deductions,
    totalIncome: p.netPay,
    netPay: p.netPay,
  });
  onProgress?.(90);

  const suffix = month && year ? `_${month}_${year}` : "";
  doc.save(`Payslip_${emp.firstName}_${emp.lastName}${suffix}.pdf`);
  onProgress?.(100);
}

/* ─── Snapshot-based PDF (from frozen payslip row) ─── */
interface PayslipSnapshotLike {
  base_salary: number;
  ot_pay: number;
  ot_hours: number;
  diligence: number;
  gross_pay: number;
  ssf: number;
  tax: number;
  total_deduct: number;
  net_pay: number;
  custom_items: Array<{ name: string; type: "income" | "deduction"; amount: number }>;
}

export async function exportPayslipPdfFromSnapshot(
  emp: Pick<Employee, "prefix" | "firstName" | "lastName" | "position" | "dept" | "nationalId">,
  snap: PayslipSnapshotLike,
  month: string,
  year: string | number,
  onProgress?: (pct: number) => void,
) {
  onProgress?.(5);
  const doc = await createPdf();
  onProgress?.(40);

  const customIncome = (snap.custom_items || []).filter((i) => i.type === "income").reduce((s, i) => s + Number(i.amount), 0);
  const incomes: PayslipLetterItem[] = [
    { label: "อัตราเงินเดือน", amount: Number(snap.base_salary) },
    { label: "ค่าล่วงเวลา", amount: Number(snap.ot_pay) },
    { label: "ค่าตอบแทนวิชาชีพ", amount: Number(snap.diligence) + customIncome },
  ];
  const deductions: PayslipLetterItem[] = [
    { label: "ภาษีเงินได้หัก ณ ที่จ่าย", amount: Number(snap.tax) },
    { label: "เงินประกันสังคม (5%)", amount: Number(snap.ssf) },
  ];
  (snap.custom_items || []).filter((i) => i.type === "deduction").forEach((i) => deductions.push({ label: i.name, amount: Number(i.amount) }));

  await renderPayslipLetter(doc, {
    employeeName: `${emp.prefix}${emp.firstName} ${emp.lastName}`,
    monthLabel: month,
    yearBE: year,
    incomes,
    deductions,
    totalIncome: Number(snap.net_pay),
    netPay: Number(snap.net_pay),
  });
  onProgress?.(90);

  doc.save(`Payslip_${emp.firstName}_${emp.lastName}_${month}_${year}.pdf`);
  onProgress?.(100);
}

