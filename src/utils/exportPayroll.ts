/* ───────────────────── Payroll Export Utilities ───────────────────── */
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { registerThaiFont } from "@/utils/thaiFontLoader";
import type { Employee } from "@/contexts/EmployeeContext";
import {
  calculateAnnualIncome, calculateMonthlyTax, calculateExpenseDeduction,
  calculateTotalDeductions, calculateProgressiveTax, formatCurrency,
  DEFAULT_TAX_DEDUCTION, type TaxConfig, type TaxDeduction,
} from "@/utils/taxCalculation";

/* ─── Payroll config (same as Payroll page) ─── */
const PAYROLL_CONFIG = {
  otRateWorkday: 1.5,
  diligenceEnabled: true,
  diligenceAmount: 2000,
  ssfEnabled: true,
  ssfRate: 5,
  ssfCeiling: 750,
  taxConfig: { enabled: true, method: "progressive" as const, flatRate: 5 },
};

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

function calcPayrollForExport(emp: Employee) {
  const salary = Number(emp.salary) || 0;
  const att = mockAttendanceData[emp.id] || { workDays: 22, otHours: 0, lateDays: 0, absentDays: 0, leaveDays: 0 };
  const hourlyRate = salary / 30 / 8;
  const otPay = Math.round(att.otHours * hourlyRate * PAYROLL_CONFIG.otRateWorkday);
  const diligence = PAYROLL_CONFIG.diligenceEnabled && att.lateDays === 0 && att.absentDays === 0 ? PAYROLL_CONFIG.diligenceAmount : 0;

  // Custom items
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

/** Export ภ.ง.ด.1 to Excel */
export function exportPnd1Excel(employees: Employee[], month: string, year: string) {
  const activeEmps = employees.filter((e) => e.status === "active");
  const taxConfig: TaxConfig = { enabled: true, method: "progressive", flatRate: 5 };

  const rows = activeEmps.map((emp, i) => {
    const p = calcPayrollForExport(emp);
    return {
      "ลำดับ": i + 1,
      "ชื่อ-สกุล": `${emp.prefix}${emp.firstName} ${emp.lastName}`,
      "เลขบัตรประชาชน": emp.nationalId,
      "เงินได้ (บาท)": p.grossPay,
      "ภาษีหัก ณ ที่จ่าย (บาท)": p.monthlyTax,
    };
  });

  const totalIncome = rows.reduce((s, r) => s + (r["เงินได้ (บาท)"] as number), 0);
  const totalTax = rows.reduce((s, r) => s + (r["ภาษีหัก ณ ที่จ่าย (บาท)"] as number), 0);
  rows.push({
    "ลำดับ": "" as any,
    "ชื่อ-สกุล": `รวมทั้งหมด (${activeEmps.length} คน)`,
    "เลขบัตรประชาชน": "",
    "เงินได้ (บาท)": totalIncome,
    "ภาษีหัก ณ ที่จ่าย (บาท)": totalTax,
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 6 }, { wch: 25 }, { wch: 18 }, { wch: 15 }, { wch: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ภ.ง.ด.1");
  XLSX.writeFile(wb, `PND1_${month}_${year}.xlsx`);
}

/** Export payslip to Excel */
export function exportPayslipExcel(emp: Employee) {
  const p = calcPayrollForExport(emp);
  const rows: { "รายการ": string; "จำนวน (บาท)": number | string }[] = [
    { "รายการ": "เงินเดือน", "จำนวน (บาท)": p.salary },
    { "รายการ": `ค่าล่วงเวลา (${p.otHours} ชม.)`, "จำนวน (บาท)": p.otPay },
    { "รายการ": "เบี้ยขยัน", "จำนวน (บาท)": p.diligence },
  ];
  // Custom income
  p.customItems.filter((i) => i.type === "income").forEach((item) => {
    rows.push({ "รายการ": item.name, "จำนวน (บาท)": item.amount });
  });
  rows.push(
    { "รายการ": "รวมรายได้", "จำนวน (บาท)": p.grossPay },
    { "รายการ": "", "จำนวน (บาท)": "" },
    { "รายการ": "หัก: ประกันสังคม", "จำนวน (บาท)": -p.ssf },
    { "รายการ": "หัก: ภาษีหัก ณ ที่จ่าย", "จำนวน (บาท)": -p.monthlyTax },
  );
  // Custom deductions
  p.customItems.filter((i) => i.type === "deduction").forEach((item) => {
    rows.push({ "รายการ": `หัก: ${item.name}`, "จำนวน (บาท)": -item.amount });
  });
  rows.push(
    { "รายการ": "รวมหัก", "จำนวน (บาท)": -p.totalDeduct },
    { "รายการ": "", "จำนวน (บาท)": "" },
    { "รายการ": "เงินได้สุทธิ", "จำนวน (บาท)": p.netPay },
  );

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 30 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "สลิปเงินเดือน");
  XLSX.writeFile(wb, `Payslip_${emp.firstName}_${emp.lastName}.xlsx`);
}

/** Export all payslips to Excel (one sheet per employee) */
export function exportAllPayslipsExcel(employees: Employee[]) {
  const activeEmps = employees.filter((e) => e.status === "active");
  const wb = XLSX.utils.book_new();

  activeEmps.forEach((emp) => {
    const p = calcPayrollForExport(emp);
    const rows: { "รายการ": string; "จำนวน (บาท)": number | string }[] = [
      { "รายการ": `พนักงาน: ${emp.prefix}${emp.firstName} ${emp.lastName}`, "จำนวน (บาท)": "" },
      { "รายการ": `ตำแหน่ง: ${emp.position} (${emp.dept})`, "จำนวน (บาท)": "" },
      { "รายการ": "", "จำนวน (บาท)": "" },
      { "รายการ": "เงินเดือน", "จำนวน (บาท)": p.salary },
      { "รายการ": `ค่าล่วงเวลา (${p.otHours} ชม.)`, "จำนวน (บาท)": p.otPay },
      { "รายการ": "เบี้ยขยัน", "จำนวน (บาท)": p.diligence },
    ];
    p.customItems.filter((i) => i.type === "income").forEach((item) => {
      rows.push({ "รายการ": item.name, "จำนวน (บาท)": item.amount });
    });
    rows.push(
      { "รายการ": "รวมรายได้", "จำนวน (บาท)": p.grossPay },
      { "รายการ": "", "จำนวน (บาท)": "" },
      { "รายการ": "หัก: ประกันสังคม", "จำนวน (บาท)": -p.ssf },
      { "รายการ": "หัก: ภาษีหัก ณ ที่จ่าย", "จำนวน (บาท)": -p.monthlyTax },
    );
    p.customItems.filter((i) => i.type === "deduction").forEach((item) => {
      rows.push({ "รายการ": `หัก: ${item.name}`, "จำนวน (บาท)": -item.amount });
    });
    rows.push(
      { "รายการ": "รวมหัก", "จำนวน (บาท)": -p.totalDeduct },
      { "รายการ": "", "จำนวน (บาท)": "" },
      { "รายการ": "เงินได้สุทธิ", "จำนวน (บาท)": p.netPay },
    );
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 35 }, { wch: 18 }];
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

/** Export ภ.ง.ด.1 to PDF */
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
    return [
      i + 1,
      `${emp.prefix}${emp.firstName} ${emp.lastName}`,
      emp.nationalId,
      formatCurrency(p.grossPay),
      formatCurrency(p.monthlyTax),
    ];
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

/** Export single payslip to PDF */
export async function exportPayslipPdf(emp: Employee) {
  const p = calcPayrollForExport(emp);
  const doc = await createPdf();

  // Header
  doc.setFontSize(20);
  doc.setFont("THSarabunNew", "bold");
  doc.text("สลิปเงินเดือน", 14, 18);
  doc.setFontSize(12);
  doc.setFont("THSarabunNew", "normal");
  doc.text(`พนักงาน: ${emp.prefix}${emp.firstName} ${emp.lastName}`, 14, 28);
  doc.text(`ตำแหน่ง: ${emp.position} | แผนก: ${emp.dept}`, 14, 34);
  doc.text(`เลขบัตรประชาชน: ${emp.nationalId}`, 14, 40);

  // Income table
  const incomeRows: string[][] = [
    ["เงินเดือน", formatCurrency(p.salary)],
    [`ค่าล่วงเวลา (${p.otHours} ชม.)`, formatCurrency(p.otPay)],
    ["เบี้ยขยัน", formatCurrency(p.diligence)],
  ];
  p.customItems.filter((i) => i.type === "income").forEach((item) => {
    incomeRows.push([item.name, formatCurrency(item.amount)]);
  });
  incomeRows.push(["รวมรายได้", formatCurrency(p.grossPay)]);

  autoTable(doc, {
    startY: 48,
    head: [["รายการรายได้", "จำนวน (บาท)"]],
    body: incomeRows,
    styles: { fontSize: 11, font: "THSarabunNew" },
    headStyles: { fillColor: [34, 197, 94], font: "THSarabunNew", fontStyle: "bold" },
  });

  // Deductions table
  const finalY = (doc as any).lastAutoTable?.finalY || 90;
  const deductRows: string[][] = [
    ["ประกันสังคม", formatCurrency(p.ssf)],
    ["ภาษีหัก ณ ที่จ่าย", formatCurrency(p.monthlyTax)],
  ];
  p.customItems.filter((i) => i.type === "deduction").forEach((item) => {
    deductRows.push([item.name, formatCurrency(item.amount)]);
  });
  deductRows.push(["รวมหัก", formatCurrency(p.totalDeduct)]);

  autoTable(doc, {
    startY: finalY + 6,
    head: [["รายการหัก", "จำนวน (บาท)"]],
    body: deductRows,
    styles: { fontSize: 11, font: "THSarabunNew" },
    headStyles: { fillColor: [239, 68, 68], font: "THSarabunNew", fontStyle: "bold" },
  });

  // Net pay
  const finalY2 = (doc as any).lastAutoTable?.finalY || 130;
  doc.setFontSize(16);
  doc.setFont("THSarabunNew", "bold");
  doc.text(`เงินได้สุทธิ: ${formatCurrency(p.netPay)} บาท`, 14, finalY2 + 14);

  doc.save(`Payslip_${emp.firstName}_${emp.lastName}.pdf`);
}
