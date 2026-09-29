import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePageQuery } from "@/hooks/usePageQuery";

export type PayrollPeriodStatus = "draft" | "published";

export interface PayrollPeriod {
  id: string;
  year: number;
  month: number;
  status: PayrollPeriodStatus;
  published_at: string | null;
  published_by: string | null;
  note: string;
}

export interface PayslipAttendance {
  workDays: number;
  otHours: number;
  lateDays: number;
  absentDays: number;
  leaveDays: number;
}

export interface PayslipCustomItem {
  id: string;
  name: string;
  type: "income" | "deduction";
  amount: number;
  enabled?: boolean;
}

export interface PayslipTaxBreakdown {
  annualIncome: number;
  expenseDeduction: number;
  totalDeductions: number;
  netIncome: number;
  annualTax: number;
}

export interface PayslipRow {
  id: string;
  period_id: string;
  employee_id: string;
  base_salary: number;
  ot_pay: number;
  ot_hours: number;
  diligence: number;
  custom_income: number;
  custom_deduction: number;
  gross_pay: number;
  ssf: number;
  tax: number;
  total_deduct: number;
  net_pay: number;
  attendance: PayslipAttendance;
  custom_items: PayslipCustomItem[];
  tax_breakdown: PayslipTaxBreakdown;
}

export function usePayrollPeriod(year: number, month: number) {
  const [period, setPeriod] = useState<PayrollPeriod | null>(null);
  const [payslips, setPayslips] = useState<PayslipRow[]>([]);

  // Cached via React Query: revisiting a period renders instantly from cache and
  // only refetches in the background; 504s are retried before showing an error.
  const { loading, refetch } = usePageQuery(
    ["payroll-period", year, month],
    async () => {
      const perRes = await supabase
        .from("payroll_periods")
        .select("*")
        .eq("year", year)
        .eq("month", month)
        .maybeSingle();
      if (perRes.error) throw new Error(perRes.error.message || "โหลดข้อมูลไม่สำเร็จ");
      const per = perRes.data;
      if (!per) return { period: null as PayrollPeriod | null, payslips: [] as PayslipRow[] };
      const rowsRes = await supabase
        .from("payslips")
        .select("*")
        .eq("period_id", per.id);
      if (rowsRes.error) throw new Error(rowsRes.error.message || "โหลดข้อมูลไม่สำเร็จ");
      return {
        period: per as PayrollPeriod,
        payslips: ((rowsRes.data as any as PayslipRow[]) || []),
      };
    },
    (d) => {
      setPeriod(d.period);
      setPayslips(d.payslips);
    },
  );

  // realtime
  useEffect(() => {
    const onChange = () => { refetch(); };
    const channel = supabase
      .channel(`payroll-${year}-${month}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "payroll_periods" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "payslips" }, onChange)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch, year, month]);

  return { period, payslips, loading, refetch };
}
