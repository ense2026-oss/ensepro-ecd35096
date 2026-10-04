/* ───────── Payslip letter layout (blueprint style) for jsPDF ───────── */
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/utils/taxCalculation";
// Import the letterhead directly from src/assets so Vite bundles it (served by
// Vercel). The old *.asset.json pointed at a Lovable /__l5e/ URL that 404s in
// production, which is why the logo disappeared from the payslip.
import letterheadImg from "@/assets/payslip-letterhead.jpg";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export interface PayslipLetterItem { label: string; amount: number }

export interface PayslipLetterData {
  employeeName: string;
  monthLabel: string;      // e.g. "สิงหาคม"
  yearBE: number | string; // e.g. 2569
  incomes: PayslipLetterItem[];
  deductions: PayslipLetterItem[];
  totalIncome: number;   // รวมเงินได้ (สุทธิหลังหัก)
  netPay: number;        // เงินโอนเข้าบัญชี
}

interface LetterSettings {
  companyName: string;
  signerName: string;
  signerTitle: string;
  headerImageUrl: string;
}

const DEFAULTS: LetterSettings = {
  companyName: "บริษัท พลังงานนครพิงค์ จำกัด",
  signerName: "(นางสาวสุรีย์ ตียปรีชญา)",
  signerTitle: "พนักงานการเงิน",
  headerImageUrl: letterheadImg,
};

async function fetchLetterSettings(): Promise<LetterSettings> {
  try {
    const { data } = await supabase
      .from("company_settings")
      .select("key,value")
      .in("key", ["company", "branding", "payslip_letter"]);
    const map: Record<string, any> = {};
    (data || []).forEach((r: any) => { map[r.key] = r.value; });
    const letter = map.payslip_letter || {};
    return {
      companyName: letter.companyName || map.company?.name || map.company?.companyName || DEFAULTS.companyName,
      signerName: letter.signerName || DEFAULTS.signerName,
      signerTitle: letter.signerTitle || DEFAULTS.signerTitle,
      headerImageUrl: letter.headerImageUrl || DEFAULTS.headerImageUrl,
    };
  } catch {
    return DEFAULTS;
  }
}

async function toDataUrl(url: string): Promise<{ dataUrl: string; format: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    // Only real images may reach jsPDF. A missing/placeholder asset (e.g. a
    // Lovable /__l5e/ URL that 404s to the SPA index.html) returns HTML — feeding
    // that to addImage used to risk a corrupt, unopenable PDF.
    if (!blob.type.startsWith("image/")) return null;
    // Re-encode through a canvas so jsPDF always gets a clean, compatible PNG
    // (normalises CMYK / progressive JPEGs and other formats that can corrupt output).
    try {
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      bitmap.close?.();
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0);
        return { dataUrl: canvas.toDataURL("image/png"), format: "PNG" };
      }
    } catch { /* fall through to raw data-url below */ }
    // Fallback: the content is a valid image type but couldn't be canvas-decoded —
    // pass it through as-is (still a real image, so safe for addImage).
    const format = blob.type.includes("png") ? "PNG" : "JPEG";
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

const BLACK: [number, number, number] = [0, 0, 0];

/** Draw the payslip as a formal Thai letter (blueprint layout). */
export async function renderPayslipLetter(doc: jsPDF, d: PayslipLetterData): Promise<void> {
  const cfg = await fetchLetterSettings();
  const pageW = doc.internal.pageSize.getWidth();
  const M = 14;                       // page margin
  const contentW = pageW - M * 2;

  /* ── Header image (no border box) ── */
  const imgH = (contentW * 276) / 2000; // letterhead aspect ratio (2000×276)
  const img = await toDataUrl(cfg.headerImageUrl);
  if (img) {
    try {
      doc.addImage(img.dataUrl, img.format, M, 12, contentW, imgH);
    } catch { /* ignore */ }
  }

  const FS_TITLE = 9;
  const FS_BODY = 8.5;

  let y = 12 + imgH + 16;

  /* ── Date (top-right) ── */
  const today = new Date();
  const dateStr = `${today.getDate()} ${THAI_MONTHS[today.getMonth()]} ${String(today.getFullYear() + 543).slice(-2)}`;
  doc.setFont("THSarabunNew", "bold");
  doc.setFontSize(FS_TITLE);
  doc.setTextColor(...BLACK);
  doc.text(dateStr, pageW - M, y, { align: "right" });

  /* ── เรียน ── */
  doc.text(`เรียน  ${d.employeeName}`, M, y + 3);

  /* ── Intro line ── */
  y += 14;
  doc.setFont("THSarabunNew", "normal");
  doc.setFontSize(FS_BODY);
  const intro = `ทาง ${cfg.companyName} ขอแจ้งยอดการคำนวนเงินเดือน ประจำเดือน `;
  const introW = doc.getTextWidth(intro);
  const period = `${d.monthLabel} ${d.yearBE}`;
  const periodW = doc.getTextWidth(period);
  const tail = " ดังนี้";
  const startX = Math.max(M, (pageW - (introW + periodW + doc.getTextWidth(tail))) / 2);
  doc.text(intro, startX, y);
  doc.text(period, startX + introW, y);
  doc.text(tail, startX + introW + periodW, y);

  /* ── Amount box (thin 1px border) ── */
  const rowH = 5;
  const rowsCount = d.incomes.length + d.deductions.length;
  const boxTop = y + 6;
  const contentH = 10 + rowsCount * rowH + 5 + 14;
  const boxH = Math.max(contentH, 150);
  const boxBottom = boxTop + boxH;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.26); // ≈ 1px
  doc.rect(M, boxTop, contentW, boxH, "S");

  const labelX = M + 22;
  const groupX = M + 10;
  const amountX = pageW - M - 32;   // right edge of numbers
  const unitX = pageW - M - 28;
  let ry = boxTop + 10;

  const line = (label: string, amount: number, group?: string) => {
    doc.setFont("THSarabunNew", "bold");
    doc.setFontSize(FS_BODY);
    doc.setTextColor(...BLACK);
    if (group) doc.text(group, groupX, ry);
    doc.text(label, labelX, ry);
    doc.text(formatCurrency(amount), amountX, ry, { align: "right" });
    doc.text("บาท", unitX, ry);
    ry += rowH;
  };

  d.incomes.forEach((it, i) => line(it.label, it.amount, i === 1 ? "บวก" : undefined));
  ry += 5;
  d.deductions.forEach((it, i) => line(it.label, it.amount, i === 0 ? "หัก" : undefined));

  /* ── รวมเงินได้ (bottom of box) ── */
  const sumY = boxBottom - 9;
  doc.setFont("THSarabunNew", "bold");
  doc.setFontSize(FS_TITLE);
  doc.text("รวมเงินได้", labelX, sumY);
  doc.text(formatCurrency(d.totalIncome), amountX, sumY, { align: "right" });
  doc.text("บาท", unitX, sumY);

  /* ── Closing lines ── */
  let cy = boxBottom + 10;
  doc.setFont("THSarabunNew", "normal");
  doc.setFontSize(FS_BODY);
  const c1a = "ดังนั้นคงเหลือเงินได้เพื่อนำเข้าบัญชีเงินเดือน ";
  const c1aW = doc.getTextWidth(c1a);
  const mLabel = `${d.monthLabel}`;
  const mW = doc.getTextWidth(mLabel);
  const c1b = " เป็นเงิน ";
  const c1bW = doc.getTextWidth(c1b);
  const netStr = `${formatCurrency(d.netPay)} บาท`;
  const cx = Math.max(M, (pageW - (c1aW + mW + c1bW + doc.getTextWidth(netStr))) / 2);
  doc.text(c1a, cx, cy);
  doc.text(mLabel, cx + c1aW, cy);
  doc.text(c1b, cx + c1aW + mW, cy);
  doc.text(netStr, cx + c1aW + mW + c1bW, cy);

  cy += 6;
  doc.text("จึงเรียนมาเพื่อทราบ หากมีข้อสงสัยประการใด  ให้ติดต่อฝ่ายการเงิน", cx, cy);

  /* ── Signature ── */
  cy += 16;
  doc.text(cfg.signerName, pageW / 2 + 20, cy, { align: "center" });
  doc.text(cfg.signerTitle, pageW / 2 + 20, cy + 5, { align: "center" });
}

