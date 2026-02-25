/* ───────────────────── Tax Calculation Utility ───────────────────── */

export interface TaxDeduction {
  personal: number;       // ค่าลดหย่อนส่วนตัว (60,000)
  spouse: number;         // คู่สมรส (60,000)
  children: number;       // บุตร (30,000 x จำนวน)
  childrenAfter2018: number; // บุตรตั้งแต่ปี 2561 (60,000 x จำนวน)
  socialSecurity: number; // ประกันสังคม (สูงสุด 9,000)
  lifeInsurance: number;  // ประกันชีวิต (สูงสุด 100,000)
  pvd: number;            // กองทุนสำรองเลี้ยงชีพ (สูงสุด 500,000)
  donation: number;       // เงินบริจาค
  other: number;          // อื่นๆ
  otherNote?: string;     // หมายเหตุลดหย่อนอื่นๆ
}

export interface TaxConfig {
  enabled: boolean;
  method: "progressive" | "flat";
  flatRate: number; // e.g. 5 = 5%
}

export interface TaxBracket {
  min: number;
  max: number | null;
  rate: number; // percentage
  label: string;
}

export const TAX_BRACKETS: TaxBracket[] = [
  { min: 0,         max: 150000,   rate: 0,  label: "0 - 150,000" },
  { min: 150001,    max: 300000,   rate: 5,  label: "150,001 - 300,000" },
  { min: 300001,    max: 500000,   rate: 10, label: "300,001 - 500,000" },
  { min: 500001,    max: 750000,   rate: 15, label: "500,001 - 750,000" },
  { min: 750001,    max: 1000000,  rate: 20, label: "750,001 - 1,000,000" },
  { min: 1000001,   max: 2000000,  rate: 25, label: "1,000,001 - 2,000,000" },
  { min: 2000001,   max: 5000000,  rate: 30, label: "2,000,001 - 5,000,000" },
  { min: 5000001,   max: null,     rate: 35, label: "5,000,001 ขึ้นไป" },
];

export const DEFAULT_TAX_DEDUCTION: TaxDeduction = {
  personal: 60000,
  spouse: 0,
  children: 0,
  childrenAfter2018: 0,
  socialSecurity: 0,
  lifeInsurance: 0,
  pvd: 0,
  donation: 0,
  other: 0,
  otherNote: "",
};

/** คำนวณรายได้รวมต่อปี */
export function calculateAnnualIncome(
  monthlySalary: number,
  monthlyOT: number = 0,
  monthlyAllowances: number = 0
): number {
  return (monthlySalary + monthlyOT + monthlyAllowances) * 12;
}

/** คำนวณหักค่าใช้จ่าย 50% สูงสุด 100,000 */
export function calculateExpenseDeduction(annualIncome: number): number {
  return Math.min(annualIncome * 0.5, 100000);
}

/** รวมค่าลดหย่อนทั้งหมด */
export function calculateTotalDeductions(deductions: TaxDeduction): number {
  return (
    deductions.personal +
    deductions.spouse +
    deductions.children +
    deductions.childrenAfter2018 +
    deductions.socialSecurity +
    deductions.lifeInsurance +
    deductions.pvd +
    deductions.donation +
    deductions.other
  );
}

/** คำนวณภาษีแบบขั้นบันได */
export function calculateProgressiveTax(netIncome: number): number {
  if (netIncome <= 0) return 0;

  let tax = 0;
  let remaining = netIncome;

  const bracketRanges = [
    { limit: 150000, rate: 0 },
    { limit: 150000, rate: 0.05 },
    { limit: 200000, rate: 0.10 },
    { limit: 250000, rate: 0.15 },
    { limit: 250000, rate: 0.20 },
    { limit: 1000000, rate: 0.25 },
    { limit: 3000000, rate: 0.30 },
    { limit: Infinity, rate: 0.35 },
  ];

  for (const bracket of bracketRanges) {
    if (remaining <= 0) break;
    const taxable = Math.min(remaining, bracket.limit);
    tax += taxable * bracket.rate;
    remaining -= taxable;
  }

  return Math.round(tax);
}

/** คำนวณภาษีต่อเดือน */
export function calculateMonthlyTax(
  config: TaxConfig,
  annualIncome: number,
  deductions: TaxDeduction
): number {
  if (!config.enabled) return 0;

  if (config.method === "flat") {
    return Math.round((annualIncome * config.flatRate) / 100 / 12);
  }

  // Progressive
  const expenseDeduction = calculateExpenseDeduction(annualIncome);
  const totalDeductions = calculateTotalDeductions(deductions);
  const netIncome = Math.max(0, annualIncome - expenseDeduction - totalDeductions);
  const annualTax = calculateProgressiveTax(netIncome);
  return Math.round(annualTax / 12);
}

/** คำนวณภาษีต่อปี */
export function calculateAnnualTax(
  config: TaxConfig,
  annualIncome: number,
  deductions: TaxDeduction
): number {
  if (!config.enabled) return 0;

  if (config.method === "flat") {
    return Math.round((annualIncome * config.flatRate) / 100);
  }

  const expenseDeduction = calculateExpenseDeduction(annualIncome);
  const totalDeductions = calculateTotalDeductions(deductions);
  const netIncome = Math.max(0, annualIncome - expenseDeduction - totalDeductions);
  return calculateProgressiveTax(netIncome);
}

/** Format number with commas */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString("th-TH");
}
