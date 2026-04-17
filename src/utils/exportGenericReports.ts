/* ─── Generic Excel exports for Employee/OT/Shift/Payroll reports ─── */
import { createExcelWithHeader } from "@/utils/excelHeader";

const today = () => new Date().toLocaleDateString("th-TH");

/* ═══════════════════ EMPLOYEE REPORTS ═══════════════════ */
export function exportEmployeeReportExcel(
  rows: any[],
  reportName: string,
  filterMonth: string,
  filterYear: string
) {
  const headers = ["ลำดับที่", "ชื่อ-สกุล", "แผนก", "ตำแหน่ง", "ประเภท", "วันเริ่มงาน", "สถานะ"];
  const total = rows.length;
  const body: (string | number)[][] = rows.map((r, i) => [
    total - i,
    r.name ?? "-",
    r.dept ?? "-",
    r.position ?? "-",
    r.type ?? "-",
    r.startDate ?? "-",
    r.status ?? "-",
  ]);
  body.push(["", `รวมทั้งหมด ${total} คน`, "", "", "", "", ""]);

  createExcelWithHeader({
    sheetName: "ข้อมูลพนักงาน",
    title: reportName,
    subtitle: `ประจำเดือน ${filterMonth} พ.ศ. ${filterYear}`,
    dateRange: `วันที่ออกรายงาน: ${today()}`,
    headers,
    rows: body,
    colWidths: [8, 28, 18, 22, 14, 16, 14],
    fileName: `Employee_Report_${filterMonth}_${filterYear}.xlsx`,
  });
}

/* ═══════════════════ OVERTIME REPORTS ═══════════════════ */
export function exportOvertimeReportExcel(
  rows: any[],
  reportName: string,
  filterMonth: string,
  filterYear: string
) {
  const headers = ["ลำดับที่", "ชื่อ-สกุล", "แผนก", "วันที่", "เริ่ม", "สิ้นสุด", "ชั่วโมง", "ประเภท", "สถานะ"];
  const total = rows.length;
  const body: (string | number)[][] = rows.map((r, i) => [
    total - i,
    r.name ?? "-",
    r.dept ?? "-",
    r.date ?? "-",
    r.startTime ?? "-",
    r.endTime ?? "-",
    Number(r.hours) || 0,
    r.otType ?? "-",
    r.status ?? "-",
  ]);
  const totalHours = Math.round(rows.reduce((s, r: any) => s + (Number(r.hours) || 0), 0) * 100) / 100;
  body.push(["", `รวมทั้งหมด (${total} รายการ)`, "", "", "", "", totalHours, "", ""]);

  createExcelWithHeader({
    sheetName: "OT",
    title: reportName,
    subtitle: `ประจำเดือน ${filterMonth} พ.ศ. ${filterYear}`,
    dateRange: `วันที่ออกรายงาน: ${today()}`,
    headers,
    rows: body,
    colWidths: [8, 26, 18, 14, 10, 10, 10, 16, 14],
    fileName: `Overtime_Report_${filterMonth}_${filterYear}.xlsx`,
  });
}

/* ═══════════════════ SHIFT REPORTS ═══════════════════ */
export function exportShiftReportExcel(
  rows: any[],
  reportName: string,
  filterMonth: string,
  filterYear: string
) {
  const headers = ["ลำดับที่", "ชื่อ-สกุล", "แผนก", "กะ", "ช่วงเวลา", "ประเภท", "สถานะ"];
  const total = rows.length;
  const body: (string | number)[][] = rows.map((r, i) => [
    total - i,
    r.name ?? "-",
    r.dept ?? "-",
    r.shift ?? "-",
    r.period ?? "-",
    r.assignmentType === "day" ? "รายวัน" : "ประจำ",
    r.status ?? "-",
  ]);
  body.push(["", `รวมทั้งหมด ${total} รายการ`, "", "", "", "", ""]);

  createExcelWithHeader({
    sheetName: "ตารางกะ",
    title: reportName,
    subtitle: `ประจำเดือน ${filterMonth} พ.ศ. ${filterYear}`,
    dateRange: `วันที่ออกรายงาน: ${today()}`,
    headers,
    rows: body,
    colWidths: [8, 26, 18, 14, 18, 12, 14],
    fileName: `Shift_Report_${filterMonth}_${filterYear}.xlsx`,
  });
}

export function exportShiftChangeLogExcel(
  rows: any[],
  filterMonth: string,
  filterYear: string
) {
  const headers = ["ลำดับที่", "ชื่อ-สกุล", "กะเดิม", "กะใหม่", "วันที่", "หมายเหตุ"];
  const total = rows.length;
  const body: (string | number)[][] = rows.map((r, i) => [
    total - i,
    r.name ?? "-",
    r.fromShift ?? "-",
    r.toShift ?? "-",
    r.date ?? "-",
    r.reason ?? "-",
  ]);

  createExcelWithHeader({
    sheetName: "ประวัติการเปลี่ยนกะ",
    title: "ประวัติการเปลี่ยนกะ",
    subtitle: `ประจำเดือน ${filterMonth} พ.ศ. ${filterYear}`,
    dateRange: `วันที่ออกรายงาน: ${today()}`,
    headers,
    rows: body,
    colWidths: [8, 26, 16, 16, 14, 30],
    fileName: `Shift_Change_${filterMonth}_${filterYear}.xlsx`,
  });
}

/* ═══════════════════ PAYROLL: monthly summary ═══════════════════ */
export function exportPayrollSummaryExcel(rows: any[], filterYear: string) {
  const headers = ["เดือน", "เงินเดือน", "OT", "เบี้ยขยัน", "ประกันสังคม", "ภาษี"];
  const body: (string | number)[][] = rows.map((r) => [
    r.month ?? "-",
    Number(r.เงินเดือน) || 0,
    Number(r.OT) || 0,
    Number(r.เบี้ยขยัน) || 0,
    Number(r.ประกันสังคม) || 0,
    Number(r.ภาษี) || 0,
  ]);
  const sum = (k: string) => rows.reduce((s, r: any) => s + (Number(r[k]) || 0), 0);
  body.push(["รวม", sum("เงินเดือน"), sum("OT"), sum("เบี้ยขยัน"), sum("ประกันสังคม"), sum("ภาษี")]);

  createExcelWithHeader({
    sheetName: "สรุปเงินเดือน",
    title: "สรุปเงินเดือนรายเดือน",
    subtitle: `ประจำปี พ.ศ. ${filterYear}`,
    dateRange: `วันที่ออกรายงาน: ${today()}`,
    headers,
    rows: body,
    colWidths: [12, 18, 14, 14, 16, 14],
    fileName: `Payroll_Summary_${filterYear}.xlsx`,
  });
}

/* ═══════════════════ PAYROLL: tax annual ═══════════════════ */
export function exportTaxAnnualExcel(pnd1Rows: any[], filterYear: string) {
  const headers = ["ลำดับที่", "ชื่อ-สกุล", "เงินเดือน", "รายได้/ปี (ประมาณ)", "ภาษี/เดือน", "ภาษี/ปี (ประมาณ)"];
  const body: (string | number)[][] = pnd1Rows.map((r, i) => [
    i + 1,
    r.name ?? "-",
    Number(r.salary) || 0,
    Number(r.annualIncome) || 0,
    Number(r.monthlyTax) || 0,
    (Number(r.monthlyTax) || 0) * 12,
  ]);
  const totalSalary = pnd1Rows.reduce((s, r: any) => s + (Number(r.salary) || 0), 0);
  const totalAnnual = pnd1Rows.reduce((s, r: any) => s + (Number(r.annualIncome) || 0), 0);
  const totalMonthlyTax = pnd1Rows.reduce((s, r: any) => s + (Number(r.monthlyTax) || 0), 0);
  body.push(["", "รวม", totalSalary, totalAnnual, totalMonthlyTax, totalMonthlyTax * 12]);

  createExcelWithHeader({
    sheetName: "ภาษีสะสมรายปี",
    title: "ภาษีสะสมรายปี",
    subtitle: `ประจำปี พ.ศ. ${filterYear}`,
    dateRange: `วันที่ออกรายงาน: ${today()}`,
    headers,
    rows: body,
    colWidths: [8, 28, 16, 20, 16, 20],
    fileName: `Tax_Annual_${filterYear}.xlsx`,
  });
}
