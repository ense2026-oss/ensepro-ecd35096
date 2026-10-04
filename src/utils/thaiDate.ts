// Shared Thai date formatting.
//
// Converts a CE "YYYY-MM-DD" string to a Thai display with the Buddhist year,
// e.g. "1978-09-09" -> "9 กันยายน 2521" (or "9 ก.ย. 2521" when short).
//
// IMPORTANT: strings that are NOT a strict YYYY-MM-DD are returned unchanged.
// This makes formatThaiDate safe to apply anywhere a date is shown — values that
// are already formatted (or not dates at all) pass through untouched, so there is
// no risk of double-formatting.

const THAI_MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

export interface ThaiDateOptions {
  /** Use short month names (ม.ค.) instead of full (มกราคม). */
  short?: boolean;
  /** What to return for an empty value. Default "—". */
  empty?: string;
}

export function formatThaiDate(input?: string | number | null, opts?: ThaiDateOptions): string {
  const s = (input ?? "").toString().trim();
  if (!s) return opts?.empty ?? "—";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s; // already formatted / not a YYYY-MM-DD date → leave as-is
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return s;
  const months = opts?.short ? THAI_MONTHS_SHORT : THAI_MONTHS_FULL;
  return `${d} ${months[mo - 1]} ${y + 543}`;
}

/** Short variant helper: formatThaiDateShort("2521-...") -> "9 ก.ย. 2564". */
export function formatThaiDateShort(input?: string | number | null): string {
  return formatThaiDate(input, { short: true });
}
