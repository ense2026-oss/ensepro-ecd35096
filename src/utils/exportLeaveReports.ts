import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { registerThaiFont } from "@/utils/thaiFontLoader";

const monthShortNames = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// ─── Leave Summary (Monthly) ───

export function exportLeaveSummaryExcel(data: any[], month: string, year: string) {
  const ws = XLSX.utils.json_to_sheet(
    data.map((r) => ({
      "รหัส": r.empId,
      "ชื่อ-สกุล": r.name,
      "ประเภทการลา": r.type,
      "วันที่เริ่ม": r.from,
      "วันที่สิ้นสุด": r.to,
      "จำนวนวัน": r.days,
      "สถานะ": r.status,
    }))
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "สรุปการลา");

  ws["!cols"] = [{ wch: 12 }, { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 12 }];
  XLSX.writeFile(wb, `สรุปการลา_${month}_${year}.xlsx`);
}

export async function exportLeaveSummaryPdf(data: any[], month: string, year: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  await registerThaiFont(doc);
  doc.setFont("Sarabun");
  doc.setFontSize(16);
  doc.text(`สรุปการลาประจำเดือน ${month} ${year}`, 14, 18);

  autoTable(doc, {
    startY: 26,
    head: [["รหัส", "ชื่อ-สกุล", "ประเภท", "จาก", "ถึง", "วัน", "สถานะ"]],
    body: data.map((r) => [r.empId, r.name, r.type, r.from, r.to, r.days, r.status]),
    styles: { font: "Sarabun", fontSize: 10 },
    headStyles: { fillColor: [255, 135, 15] },
  });

  doc.save(`สรุปการลา_${month}_${year}.pdf`);
}

// ─── Leave Balance (Quota) ───

export function exportLeaveBalanceExcel(data: any[], year: string) {
  if (data.length === 0) return;

  const leaveTypeNames = Object.keys(data[0])
    .filter((k) => k.endsWith("_quota"))
    .map((k) => k.replace("_quota", ""));

  const rows = data.map((r: any) => {
    const row: any = { "รหัส": r.empId, "ชื่อ-สกุล": r.name };
    leaveTypeNames.forEach((tn) => {
      row[`${tn} (โควต้า)`] = r[`${tn}_quota`];
      row[`${tn} (ใช้ไป)`] = r[`${tn}_used`];
      row[`${tn} (คงเหลือ)`] = r[`${tn}_remaining`];
    });
    row["รวมโควต้า"] = r.totalQuota;
    row["รวมใช้ไป"] = r.totalUsed;
    row["รวมคงเหลือ"] = r.totalRemaining;
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "โควต้าการลา");
  XLSX.writeFile(wb, `โควต้าการลา_${year}.xlsx`);
}

export async function exportLeaveBalancePdf(data: any[], year: string) {
  if (data.length === 0) return;

  const leaveTypeNames = Object.keys(data[0])
    .filter((k) => k.endsWith("_quota"))
    .map((k) => k.replace("_quota", ""));

  const doc = new jsPDF({ orientation: "landscape" });
  await registerThaiFont(doc);
  doc.setFont("Sarabun");
  doc.setFontSize(16);
  doc.text(`โควต้าการลาคงเหลือ ปี ${year}`, 14, 18);

  const head = ["รหัส", "ชื่อ-สกุล", ...leaveTypeNames.map((n) => `${n}\n(เหลือ/โควต้า)`), "รวม\n(เหลือ/โควต้า)"];

  const body = data.map((r: any) => [
    r.empId,
    r.name,
    ...leaveTypeNames.map((tn) => `${r[`${tn}_remaining`]}/${r[`${tn}_quota`]}`),
    `${r.totalRemaining}/${r.totalQuota}`,
  ]);

  autoTable(doc, {
    startY: 26,
    head: [head],
    body,
    styles: { font: "Sarabun", fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [255, 135, 15], fontSize: 8 },
    columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 35 } },
  });

  doc.save(`โควต้าการลา_${year}.pdf`);
}

// ─── Leave Yearly ───

export function exportLeaveYearlyExcel(data: any[], year: string) {
  const rows = data.map((r: any) => {
    const row: any = { "ประเภทการลา": r.type };
    monthShortNames.forEach((m) => { row[m] = r[m] || 0; });
    row["รวม"] = r.total;
    return row;
  });

  // Add totals row
  const totalsRow: any = { "ประเภทการลา": "รวมทั้งหมด" };
  monthShortNames.forEach((m) => {
    totalsRow[m] = data.reduce((sum: number, r: any) => sum + (r[m] || 0), 0);
  });
  totalsRow["รวม"] = data.reduce((sum: number, r: any) => sum + r.total, 0);
  rows.push(totalsRow);

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "สรุปการลาประจำปี");
  XLSX.writeFile(wb, `สรุปการลาประจำปี_${year}.xlsx`);
}

export async function exportLeaveYearlyPdf(data: any[], year: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  await registerThaiFont(doc);
  doc.setFont("Sarabun");
  doc.setFontSize(16);
  doc.text(`สรุปการลาประจำปี ${year}`, 14, 18);

  const head = ["ประเภทการลา", ...monthShortNames, "รวม"];

  const body = data.map((r: any) => [
    r.type,
    ...monthShortNames.map((m) => r[m] || 0),
    r.total,
  ]);

  // Totals row
  body.push([
    "รวมทั้งหมด",
    ...monthShortNames.map((m) => data.reduce((s: number, r: any) => s + (r[m] || 0), 0)),
    data.reduce((s: number, r: any) => s + r.total, 0),
  ]);

  autoTable(doc, {
    startY: 26,
    head: [head],
    body,
    styles: { font: "Sarabun", fontSize: 9, halign: "center" },
    headStyles: { fillColor: [255, 135, 15], fontSize: 8 },
    columnStyles: { 0: { halign: "left", cellWidth: 30 } },
  });

  doc.save(`สรุปการลาประจำปี_${year}.pdf`);
}
