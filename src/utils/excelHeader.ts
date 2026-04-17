import * as XLSX from "xlsx-js-style";

const COMPANY_NAME = "บริษัทพลังงานนครพิงค์ จำกัด";

interface ExcelHeaderOptions {
  ws: XLSX.WorkSheet;
  title: string;
  subtitle?: string;
  dateRange?: string;
  columnCount: number;
}

// ─── Style presets ───
const BORDER_THIN = {
  top: { style: "thin", color: { rgb: "000000" } },
  bottom: { style: "thin", color: { rgb: "000000" } },
  left: { style: "thin", color: { rgb: "000000" } },
  right: { style: "thin", color: { rgb: "000000" } },
} as any;

const COMPANY_STYLE = {
  font: { name: "TH Sarabun New", sz: 20, bold: true, color: { rgb: "000000" } },
  alignment: { horizontal: "center", vertical: "center" },
  fill: { patternType: "solid", fgColor: { rgb: "D9D2E9" } }, // light purple
  border: BORDER_THIN,
} as any;

const TITLE_STYLE = {
  font: { name: "TH Sarabun New", sz: 16, bold: true, color: { rgb: "000000" } },
  alignment: { horizontal: "center", vertical: "center" },
  fill: { patternType: "solid", fgColor: { rgb: "FFF2CC" } }, // light yellow
  border: BORDER_THIN,
} as any;

const SUBTITLE_STYLE = {
  font: { name: "TH Sarabun New", sz: 14, color: { rgb: "000000" } },
  alignment: { horizontal: "center", vertical: "center" },
  fill: { patternType: "solid", fgColor: { rgb: "FFF2CC" } },
  border: BORDER_THIN,
} as any;

const TABLE_HEADER_STYLE = {
  font: { name: "TH Sarabun New", sz: 12, bold: true, color: { rgb: "000000" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  fill: { patternType: "solid", fgColor: { rgb: "F2F2F2" } },
  border: BORDER_THIN,
} as any;

const TABLE_CELL_STYLE = {
  font: { name: "TH Sarabun New", sz: 12, color: { rgb: "000000" } },
  alignment: { vertical: "center", wrapText: true },
  border: BORDER_THIN,
} as any;

/**
 * Adds a professional header block to a worksheet.
 * Returns the starting row (0-indexed) for data after the header.
 */
export function addExcelHeader({ ws, title, subtitle, dateRange, columnCount }: ExcelHeaderOptions): number {
  const lastCol = Math.max(columnCount - 1, 0);
  if (!ws["!merges"]) ws["!merges"] = [];

  // Row 0: Company name
  XLSX.utils.sheet_add_aoa(ws, [[COMPANY_NAME]], { origin: "A1" });
  ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } });
  applyRowStyle(ws, 0, lastCol, COMPANY_STYLE);

  // Row 1: Title
  XLSX.utils.sheet_add_aoa(ws, [[title]], { origin: "A2" });
  ws["!merges"].push({ s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } });
  applyRowStyle(ws, 1, lastCol, TITLE_STYLE);

  // Row 2: Subtitle / date range
  const sub = [subtitle, dateRange].filter(Boolean).join(" | ");
  if (sub) {
    XLSX.utils.sheet_add_aoa(ws, [[sub]], { origin: "A3" });
    ws["!merges"].push({ s: { r: 2, c: 0 }, e: { r: 2, c: lastCol } });
    applyRowStyle(ws, 2, lastCol, SUBTITLE_STYLE);
  }

  // Row 3: blank spacer (no styling)
  // Data column-headers start at row index 4 (Excel row 5)
  return 4;
}

function applyRowStyle(ws: XLSX.WorkSheet, rowIdx: number, lastCol: number, style: any) {
  for (let c = 0; c <= lastCol; c++) {
    const addr = XLSX.utils.encode_cell({ r: rowIdx, c });
    if (!ws[addr]) ws[addr] = { t: "s", v: "" };
    ws[addr].s = style;
  }
}

/**
 * Helper: creates a workbook with a professionally-headed sheet.
 */
export function createExcelWithHeader(opts: {
  sheetName: string;
  title: string;
  subtitle?: string;
  dateRange?: string;
  headers: string[];
  rows: (string | number)[][];
  colWidths?: number[];
  fileName: string;
}) {
  const { sheetName, title, subtitle, dateRange, headers, rows, colWidths, fileName } = opts;
  const columnCount = headers.length;
  const lastCol = columnCount - 1;

  const ws = XLSX.utils.aoa_to_sheet([]);

  // Header block
  const dataStartRow = addExcelHeader({ ws, title, subtitle, dateRange, columnCount });

  // Column headers
  XLSX.utils.sheet_add_aoa(ws, [headers], { origin: { r: dataStartRow, c: 0 } });
  applyRowStyle(ws, dataStartRow, lastCol, TABLE_HEADER_STYLE);

  // Data rows
  if (rows.length > 0) {
    XLSX.utils.sheet_add_aoa(ws, rows, { origin: { r: dataStartRow + 1, c: 0 } });
    for (let i = 0; i < rows.length; i++) {
      const r = dataStartRow + 1 + i;
      for (let c = 0; c <= lastCol; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) ws[addr] = { t: "s", v: "" };
        // Center-align numeric-ish cells, left-align text
        const val = ws[addr].v;
        const isNumeric = typeof val === "number" || (typeof val === "string" && /^-?\d+(\.\d+)?$/.test(val));
        ws[addr].s = {
          ...TABLE_CELL_STYLE,
          alignment: { ...TABLE_CELL_STYLE.alignment, horizontal: isNumeric ? "center" : "left" },
        };
      }
    }
  }

  // Determine the worksheet range to ensure all styled cells are saved
  const totalRows = dataStartRow + 1 + rows.length;
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: totalRows - 1, c: lastCol } });

  // Column widths
  ws["!cols"] = colWidths
    ? colWidths.map((w) => ({ wch: w }))
    : headers.map((h) => ({ wch: Math.max(h.length * 2, 14) }));

  // Row heights
  ws["!rows"] = [
    { hpt: 32 }, // Company name
    { hpt: 26 }, // Title
    { hpt: 22 }, // Subtitle
    { hpt: 8 },  // Spacer
    { hpt: 24 }, // Column headers
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
}
