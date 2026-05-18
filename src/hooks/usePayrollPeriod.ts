import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data: per } = await supabase
      .from("payroll_periods")
      .select("*")
      .eq("year", year)
      .eq("month", month)
      .maybeSingle();
    if (!per) {
      setPeriod(null);
      setPayslips([]);
      setLoading(false);
      return;
    }
    setPeriod(per as PayrollPeriod);
    const { data: rows } = await supabase
      .from("payslips")
      .select("*")
      .eq("period_id", per.id);
    setPayslips((rows as any as PayslipRow[]) || []);
    setLoading(false);
  }, [year, month]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // realtime
  useEffect(() => {
    const channel = supabase
      .channel(`payroll-${year}-${month}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "payroll_periods" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "payslips" }, refetch)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch, year, month]);

  return { period, payslips, loading, refetch };
}
