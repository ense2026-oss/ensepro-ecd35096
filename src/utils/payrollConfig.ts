/* ───────────────────── Payroll Config (shared) ─────────────────────
 * Single source of truth for payroll calculation settings.
 * Persisted in company_settings (key = "payroll_config").
 * Falls back to DEFAULT_PAYROLL_CONFIG when not set.
 * ------------------------------------------------------------------- */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PayrollTemplate {
  id: string;
  name: string;
  type: "income" | "deduction";
  defaultAmount: number;
}

export interface PayrollConfig {
  // OT
  otRateWorkday: number;
  otRateHoliday: number;
  otRatePublicHoliday: number;
  allowHolidayOT: boolean;
  maxOTHours: number;
  // Diligence
  diligenceEnabled: boolean;
  diligenceAmount: number;
  deductLate: boolean;
  lateThreshold: number;
  deductAbsent: boolean;
  absentThreshold: number;
  // SSF & Tax
  ssfEnabled: boolean;
  ssfRate: number;
  ssfCeiling: number;
  taxConfig: { enabled: boolean; method: "progressive" | "flat"; flatRate: number };
  // Shift & pay cycle
  shiftAllowanceAfternoon: number;
  shiftAllowanceNight: number;
  payCycle: string;
  customPayDay: number;
  // Templates
  templates: PayrollTemplate[];
}

export const DEFAULT_PAYROLL_CONFIG: PayrollConfig = {
  otRateWorkday: 1.5,
  otRateHoliday: 3.0,
  otRatePublicHoliday: 3.0,
  allowHolidayOT: true,
  maxOTHours: 36,
  diligenceEnabled: true,
  diligenceAmount: 2000,
  deductLate: true,
  lateThreshold: 3,
  deductAbsent: true,
  absentThreshold: 1,
  ssfEnabled: true,
  ssfRate: 5,
  ssfCeiling: 750,
  taxConfig: { enabled: true, method: "progressive", flatRate: 5 },
  shiftAllowanceAfternoon: 50,
  shiftAllowanceNight: 100,
  payCycle: "end",
  customPayDay: 28,
  templates: [
    { id: "t1", name: "ค่าตอบแทนวิชาชีพ", type: "income", defaultAmount: 1000 },
    { id: "t2", name: "หักเงิน กยศ.", type: "deduction", defaultAmount: 500 },
    { id: "t3", name: "หักผ่อนชำระหนี้", type: "deduction", defaultAmount: 1200 },
    { id: "t4", name: "หักค่าประกันการทำงาน", type: "deduction", defaultAmount: 300 },
  ],
};

const SETTINGS_KEY = "payroll_config";

/** Merge a partial/raw config object onto the defaults safely. */
export function mergePayrollConfig(raw: unknown): PayrollConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...DEFAULT_PAYROLL_CONFIG };
  const r = raw as Record<string, any>;
  return {
    ...DEFAULT_PAYROLL_CONFIG,
    ...r,
    taxConfig: { ...DEFAULT_PAYROLL_CONFIG.taxConfig, ...(r.taxConfig || {}) },
    templates: Array.isArray(r.templates) ? r.templates : DEFAULT_PAYROLL_CONFIG.templates,
  };
}

/** One-shot fetch (for non-React utilities like exportPayroll). */
export async function fetchPayrollConfig(): Promise<PayrollConfig> {
  try {
    const { data } = await supabase
      .from("company_settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();
    return mergePayrollConfig(data?.value);
  } catch {
    return { ...DEFAULT_PAYROLL_CONFIG };
  }
}

/** Persist config to company_settings (upsert). */
export async function savePayrollConfig(config: PayrollConfig): Promise<{ error: any }> {
  const value = JSON.parse(JSON.stringify(config));
  const { data: existing } = await supabase
    .from("company_settings")
    .select("id")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("company_settings")
      .update({ value, updated_at: new Date().toISOString() })
      .eq("key", SETTINGS_KEY);
    return { error };
  }
  const { error } = await supabase
    .from("company_settings")
    .insert([{ key: SETTINGS_KEY, value }]);
  return { error };
}

/** React hook with realtime sync. */
export function usePayrollConfig() {
  const [config, setConfig] = useState<PayrollConfig>(DEFAULT_PAYROLL_CONFIG);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const c = await fetchPayrollConfig();
    setConfig(c);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("payroll-config-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "company_settings", filter: `key=eq.${SETTINGS_KEY}` },
        (payload) => {
          if (payload.new && "value" in payload.new) {
            setConfig(mergePayrollConfig((payload.new as any).value));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  return { config, loading, reload: load };
}
