import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { registerThaiFont } from "@/utils/thaiFontLoader";
import { createExcelWithHeader } from "@/utils/excelHeader";

const monthShortNames = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// ─── Leave Summary (Monthly) ───

export function exportLeaveSummaryExcel(data: any[], month: string, year: string) {
  const headers = ["ลำดับที่", "ชื่อ-สกุล", "ประเภทการลา", "วันที่เริ่ม", "วันที่สิ้นสุด", "จำนวนวัน", "สถานะ"];
  const rows = data.map((r, i) => [
    data.length - i, r.name, r.type, r.from, r.to, r.days, r.status,
  ]);

  createExcelWithHeader({
    sheetName: "สรุปการลา",
    title: "รายงานสรุปการลาประจำเดือน",
    subtitle: `ประจำเดือน ${month} พ.ศ. ${year}`,
    dateRange: `วันที่ออกรายงาน: ${new Date().toLocaleDateString("th-TH")}`,
    headers,
    rows,
    colWidths: [10, 22, 16, 14, 14, 10, 12],
    fileName: `สรุปการลา_${month}_${year}.xlsx`,
  });
}

export async function exportLeaveSummaryPdf(data: any[], month: string, year: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  await registerThaiFont(doc);
  doc.setFont("THSarabunNew");
  doc.setFontSize(16);
  doc.text(`สรุปการลาประจำเดือน ${month} ${year}`, 14, 18);

  autoTable(doc, {
    startY: 26,
    head: [["ลำดับที่", "ชื่อ-สกุล", "ประเภท", "จาก", "ถึง", "วัน", "สถานะ"]],
    body: data.map((r, i) => [data.length - i, r.name, r.type, r.from, r.to, r.days, r.status]),
    styles: { font: "THSarabunNew", fontSize: 10 },
    headStyles: { fillColor: [255, 135, 15], font: "THSarabunNew", fontStyle: "bold" },
  });

  doc.save(`สรุปการลา_${month}_${year}.pdf`);
}

// ─── Leave Balance (Quota) ───

export function exportLeaveBalanceExcel(data: any[], year: string) {
  if (data.length === 0) return;

  const leaveTypeNames = Object.keys(data[0])
    .filter((k) => k.endsWith("_quota"))
    .map((k) => k.replace("_quota", ""));

  const headers = ["ลำดับที่", "ชื่อ-สกุล",
    ...leaveTypeNames.flatMap((tn) => [`${tn} (โควต้า)`, `${tn} (ใช้ไป)`, `${tn} (คงเหลือ)`]),
    "รวมโควต้า", "รวมใช้ไป", "รวมคงเหลือ",
  ];

  const rows = data.map((r: any, i: number) => [
    data.length - i, r.name,
    ...leaveTypeNames.flatMap((tn) => [r[`${tn}_quota`], r[`${tn}_used`], r[`${tn}_remaining`]]),
    r.totalQuota, r.totalUsed, r.totalRemaining,
  ]);

  createExcelWithHeader({
    sheetName: "โควต้าการลา",
    title: "รายงานโควต้าการลาคงเหลือ",
    subtitle: `ประจำปี พ.ศ. ${year}`,
    dateRange: `วันที่ออกรายงาน: ${new Date().toLocaleDateString("th-TH")}`,
    headers,
    rows,
    fileName: `โควต้าการลา_${year}.xlsx`,
  });
}

export async function exportLeaveBalancePdf(data: any[], year: string) {
  if (data.length === 0) return;

  const leaveTypeNames = Object.keys(data[0])
    .filter((k) => k.endsWith("_quota"))
    .map((k) => k.replace("_quota", ""));

  const doc = new jsPDF({ orientation: "landscape" });
  await registerThaiFont(doc);
  doc.setFont("THSarabunNew");
  doc.setFontSize(16);
  doc.text(`โควต้าการลาคงเหลือ ปี ${year}`, 14, 18);

  const head = ["ลำดับที่", "ชื่อ-สกุล", ...leaveTypeNames.map((n) => `${n}\n(เหลือ/โควต้า)`), "รวม\n(เหลือ/โควต้า)"];

  const body = data.map((r: any, i: number) => [
    data.length - i,
    r.name,
    ...leaveTypeNames.map((tn) => `${r[`${tn}_remaining`]}/${r[`${tn}_quota`]}`),
    `${r.totalRemaining}/${r.totalQuota}`,
  ]);

  autoTable(doc, {
    startY: 26,
    head: [head],
    body,
    styles: { font: "THSarabunNew", fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [255, 135, 15], fontSize: 8 },
    columnStyles: { 0: { cellWidth: 14 }, 1: { cellWidth: 35 } },
  });

  doc.save(`โควต้าการลา_${year}.pdf`);
}

// ─── Leave Yearly ───

export function exportLeaveYearlyExcel(data: any[], year: string) {
  const headers = ["ประเภทการลา", ...monthShortNames, "รวม"];

  const rows = data.map((r: any) => [
    r.type,
    ...monthShortNames.map((m) => r[m] || 0),
    r.total,
  ]);

  // Totals row
  rows.push([
    "รวมทั้งหมด",
    ...monthShortNames.map((m) => data.reduce((sum: number, r: any) => sum + (r[m] || 0), 0)),
    data.reduce((sum: number, r: any) => sum + r.total, 0),
  ]);

  createExcelWithHeader({
    sheetName: "สรุปการลาประจำปี",
    title: "รายงานสรุปการลาประจำปี",
    subtitle: `ประจำปี พ.ศ. ${year}`,
    dateRange: `วันที่ออกรายงาน: ${new Date().toLocaleDateString("th-TH")}`,
    headers,
    rows,
    colWidths: [18, ...monthShortNames.map(() => 8), 10],
    fileName: `สรุปการลาประจำปี_${year}.xlsx`,
  });
}

export async function exportLeaveYearlyPdf(data: any[], year: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  await registerThaiFont(doc);
  doc.setFont("THSarabunNew");
  doc.setFontSize(16);
  doc.text(`สรุปการลาประจำปี ${year}`, 14, 18);

  const head = ["ประเภทการลา", ...monthShortNames, "รวม"];

  const body = data.map((r: any) => [
    r.type,
    ...monthShortNames.map((m) => r[m] || 0),
    r.total,
  ]);

  body.push([
    "รวมทั้งหมด",
    ...monthShortNames.map((m) => data.reduce((s: number, r: any) => s + (r[m] || 0), 0)),
    data.reduce((s: number, r: any) => s + r.total, 0),
  ]);

  autoTable(doc, {
    startY: 26,
    head: [head],
    body,
    styles: { font: "THSarabunNew", fontSize: 9, halign: "center" },
    headStyles: { fillColor: [255, 135, 15], fontSize: 8 },
    columnStyles: { 0: { halign: "left", cellWidth: 30 } },
  });

  doc.save(`สรุปการลาประจำปี_${year}.pdf`);
}
