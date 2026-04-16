import * as XLSX from "xlsx";

const COMPANY_NAME = "บริษัทพลังงานนครพิงค์ จำกัด";

interface ExcelHeaderOptions {
  ws: XLSX.WorkSheet;
  title: string;
  subtitle?: string;
  dateRange?: string;
  columnCount: number;
}

/**
 * Adds a professional header block to an Excel worksheet.
 * Returns the starting row (0-indexed) for data to begin after the header.
 *
 * Layout:
 *   Row 1: Company name (merged across all columns)
 *   Row 2: Title
 *   Row 3: Subtitle / date range
 *   Row 4: (blank spacer)
 *   Row 5+: Data starts here
 */
export function addExcelHeader({ ws, title, subtitle, dateRange, columnCount }: ExcelHeaderOptions): number {
  const lastCol = Math.max(columnCount - 1, 0);

  // Ensure merge array exists
  if (!ws["!merges"]) ws["!merges"] = [];

  // Row 0: Company name
  XLSX.utils.sheet_add_aoa(ws, [[COMPANY_NAME]], { origin: "A1" });
  ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } });

  // Row 1: Title
  XLSX.utils.sheet_add_aoa(ws, [[title]], { origin: "A2" });
  ws["!merges"].push({ s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } });

  // Row 2: Subtitle / date range
  const sub = [subtitle, dateRange].filter(Boolean).join(" | ");
  if (sub) {
    XLSX.utils.sheet_add_aoa(ws, [[sub]], { origin: "A3" });
    ws["!merges"].push({ s: { r: 2, c: 0 }, e: { r: 2, c: lastCol } });
  }

  // Row 3: blank spacer
  // Data starts at row index 4 (Excel row 5)
  return 4;
}

/**
 * Helper: creates a workbook with a professionally-headed sheet.
 * Writes data starting after the header block.
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

  // Create empty worksheet
  const ws = XLSX.utils.aoa_to_sheet([]);

  // Add header block — returns the data start row
  const dataStartRow = addExcelHeader({ ws, title, subtitle, dateRange, columnCount });

  // Add column headers at dataStartRow
  XLSX.utils.sheet_add_aoa(ws, [headers], { origin: { r: dataStartRow, c: 0 } });

  // Add data rows
  if (rows.length > 0) {
    XLSX.utils.sheet_add_aoa(ws, rows, { origin: { r: dataStartRow + 1, c: 0 } });
  }

  // Column widths
  ws["!cols"] = colWidths
    ? colWidths.map((w) => ({ wch: w }))
    : headers.map((h) => ({ wch: Math.max(h.length * 2, 12) }));

  // Row heights for header area
  ws["!rows"] = [
    { hpt: 24 }, // Company name
    { hpt: 22 }, // Title
    { hpt: 18 }, // Subtitle
    { hpt: 10 }, // Spacer
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
}
