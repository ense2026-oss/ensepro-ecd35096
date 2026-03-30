import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_MODULES: Record<string, boolean> = {
  employees: true,
  organization: true,
  contracts: true,
  attendance: true,
  leave: true,
  overtime: true,
  "check-in": true,
  "shift-management": true,
  payroll: true,
  reports: true,
  "face-scanner": false,
};

export function useModuleSettings() {
  const [modules, setModules] = useState<Record<string, boolean>>(DEFAULT_MODULES);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase
      .from("company_settings")
      .select("value")
      .eq("key", "module_settings")
      .maybeSingle();

    if (data?.value && typeof data.value === "object" && !Array.isArray(data.value)) {
      const merged = { ...DEFAULT_MODULES, ...(data.value as Record<string, boolean>) };
      setModules(merged);
      window.dispatchEvent(new CustomEvent("module-settings-changed", { detail: merged }));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();

    const channel = supabase
      .channel("module-settings-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "company_settings",
          filter: "key=eq.module_settings",
        },
        (payload) => {
          if (payload.new && "value" in payload.new) {
            const val = payload.new.value as Record<string, boolean>;
            const merged = { ...DEFAULT_MODULES, ...val };
            setModules(merged);
            window.dispatchEvent(new CustomEvent("module-settings-changed", { detail: merged }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSettings]);

  const updateModules = useCallback(async (newModules: Record<string, boolean>) => {
    setModules(newModules);
    window.dispatchEvent(new CustomEvent("module-settings-changed", { detail: newModules }));

    // Upsert to DB
    const { data: existing } = await supabase
      .from("company_settings")
      .select("id")
      .eq("key", "module_settings")
      .maybeSingle();

    if (existing) {
      await supabase
        .from("company_settings")
        .update({ value: newModules as any, updated_at: new Date().toISOString() })
        .eq("key", "module_settings");
    } else {
      await supabase
        .from("company_settings")
        .insert({ key: "module_settings", value: newModules as any });
    }
  }, []);

  return { modules, loading, updateModules };
}
