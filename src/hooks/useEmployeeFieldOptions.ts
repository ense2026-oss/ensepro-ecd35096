/* ───────────────────── Employee form dropdown options ─────────────────────
 * Stored in company_settings (key = "employee_field_options") so HR can edit
 * them from Settings instead of them being hardcoded in the form.
 * ------------------------------------------------------------------------- */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EmployeeFieldOptions {
  prefixes: string[];
  religions: string[];
  bloodGroups: string[];
  nationalities: string[];
  maritalStatuses: string[];
  employeeTypes: string[];
  genders: string[];
}

export const DEFAULT_EMPLOYEE_FIELD_OPTIONS: EmployeeFieldOptions = {
  prefixes: ["นาย", "นาง", "นางสาว", "ดร.", "ผศ.ดร."],
  religions: ["พุทธ", "คริสต์", "อิสลาม", "ฮินดู", "อื่นๆ"],
  bloodGroups: ["A", "B", "AB", "O"],
  nationalities: ["ไทย", "ลาว", "พม่า", "กัมพูชา", "อื่นๆ"],
  maritalStatuses: ["โสด", "สมรส", "หย่าร้าง", "หม้าย"],
  employeeTypes: ["รายเดือน", "รายวัน", "พาร์ทไทม์", "สัญญาจ้าง"],
  genders: ["ชาย", "หญิง"],
};

export const EMPLOYEE_FIELD_OPTIONS_KEY = "employee_field_options";

export function mergeEmployeeFieldOptions(raw: unknown): EmployeeFieldOptions {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...DEFAULT_EMPLOYEE_FIELD_OPTIONS };
  const r = raw as Record<string, unknown>;
  const pick = (key: keyof EmployeeFieldOptions) =>
    Array.isArray(r[key]) && (r[key] as string[]).length
      ? (r[key] as string[]).map(String)
      : DEFAULT_EMPLOYEE_FIELD_OPTIONS[key];
  return {
    prefixes: pick("prefixes"),
    religions: pick("religions"),
    bloodGroups: pick("bloodGroups"),
    nationalities: pick("nationalities"),
    maritalStatuses: pick("maritalStatuses"),
    employeeTypes: pick("employeeTypes"),
    genders: pick("genders"),
  };
}

export async function fetchEmployeeFieldOptions(): Promise<EmployeeFieldOptions> {
  try {
    const { data } = await supabase
      .from("company_settings")
      .select("value")
      .eq("key", EMPLOYEE_FIELD_OPTIONS_KEY)
      .maybeSingle();
    return mergeEmployeeFieldOptions(data?.value);
  } catch {
    return { ...DEFAULT_EMPLOYEE_FIELD_OPTIONS };
  }
}

export async function saveEmployeeFieldOptions(options: EmployeeFieldOptions): Promise<{ error: unknown }> {
  const value = JSON.parse(JSON.stringify(options));
  const { data: existing } = await supabase
    .from("company_settings")
    .select("id")
    .eq("key", EMPLOYEE_FIELD_OPTIONS_KEY)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("company_settings")
      .update({ value, updated_at: new Date().toISOString() })
      .eq("key", EMPLOYEE_FIELD_OPTIONS_KEY);
    return { error };
  }
  const { error } = await supabase.from("company_settings").insert([{ key: EMPLOYEE_FIELD_OPTIONS_KEY, value }]);
  return { error };
}

export function useEmployeeFieldOptions() {
  const [options, setOptions] = useState<EmployeeFieldOptions>(DEFAULT_EMPLOYEE_FIELD_OPTIONS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setOptions(await fetchEmployeeFieldOptions());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("employee-field-options-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "company_settings", filter: `key=eq.${EMPLOYEE_FIELD_OPTIONS_KEY}` },
        (payload) => {
          if (payload.new && "value" in payload.new) {
            setOptions(mergeEmployeeFieldOptions((payload.new as Record<string, unknown>).value));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  return { options, loading, reload: load };
}
