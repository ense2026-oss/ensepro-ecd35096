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

  const fetchSettings = useCallback(async (retriesLeft = 2): Promise<void> => {
    const { data, error } = await supabase
      .from("company_settings")
      .select("value")
      .eq("key", "module_settings")
      .maybeSingle();

    if (error) {
      console.error("Failed to load module settings", error);
      // Transient network/auth blips shouldn't silently fall back to "everything enabled" —
      // retry a couple of times before giving up.
      if (retriesLeft > 0) {
        await new Promise((r) => setTimeout(r, 800));
        return fetchSettings(retriesLeft - 1);
      }
      setLoading(false);
      return;
    }

    if (data?.value && typeof data.value === "object" && !Array.isArray(data.value)) {
      const merged = { ...DEFAULT_MODULES, ...(data.value as Record<string, boolean>) };
      setModules(merged);
      window.dispatchEvent(new CustomEvent("module-settings-changed", { detail: merged }));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();

    // Instant in-app sync: any instance that calls updateModules dispatches this event.
    const handleLocalChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as Record<string, boolean> | undefined;
      if (detail && typeof detail === "object") {
        setModules({ ...DEFAULT_MODULES, ...detail });
      }
    };
    window.addEventListener("module-settings-changed", handleLocalChange);

    // Cross-client realtime sync via DB changes (unique channel name per instance).
    const channel = supabase
      .channel(`module-settings-realtime-${Math.random().toString(36).slice(2)}`)
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
          }
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener("module-settings-changed", handleLocalChange);
      supabase.removeChannel(channel);
    };
  }, [fetchSettings]);

  const updateModules = useCallback(async (newModules: Record<string, boolean>): Promise<{ error?: string }> => {
    let previousModules: Record<string, boolean>;
    setModules((prev) => { previousModules = prev; return newModules; });
    window.dispatchEvent(new CustomEvent("module-settings-changed", { detail: newModules }));

    const rollback = () => {
      setModules(previousModules);
      window.dispatchEvent(new CustomEvent("module-settings-changed", { detail: previousModules }));
    };

    // Upsert to DB
    const { data: existing, error: selectError } = await supabase
      .from("company_settings")
      .select("id")
      .eq("key", "module_settings")
      .maybeSingle();

    if (selectError) {
      rollback();
      return { error: selectError.message };
    }

    if (existing) {
      // .select() after update lets us detect an RLS policy silently blocking the
      // write (0 rows returned, no error) instead of reporting a false success.
      const { data: updated, error } = await supabase
        .from("company_settings")
        .update({ value: newModules as any, updated_at: new Date().toISOString() })
        .eq("key", "module_settings")
        .select("id");
      if (error) {
        rollback();
        return { error: error.message };
      }
      if (!updated || updated.length === 0) {
        rollback();
        return { error: "ไม่มีสิทธิ์บันทึกการตั้งค่านี้" };
      }
    } else {
      const { error } = await supabase
        .from("company_settings")
        .insert({ key: "module_settings", value: newModules as any });
      if (error) {
        rollback();
        return { error: error.message };
      }
    }

    return {};
  }, []);

  return { modules, loading, updateModules };
}
