import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface BrandingState {
  programName: string;
  programSubtitle: string;
  logoUrl: string | null;
  logoOnlyUrl: string | null;
  displayMode: "logo-only" | "logo-and-name";
}

interface BrandingContextType extends BrandingState {
  setProgramName: (name: string) => void;
  setProgramSubtitle: (subtitle: string) => void;
  setLogoUrl: (url: string | null) => void;
  setLogoOnlyUrl: (url: string | null) => void;
  setDisplayMode: (mode: "logo-only" | "logo-and-name") => void;
}

const BRANDING_CACHE_KEY = "hrpro_branding_cache";

const defaults: BrandingState = {
  programName: "HRPro",
  programSubtitle: "Enterprise",
  logoUrl: null,
  logoOnlyUrl: null,
  displayMode: "logo-and-name",
};

const loadCachedBranding = (): BrandingState => {
  try {
    const cached = localStorage.getItem(BRANDING_CACHE_KEY);
    if (cached) {
      const v = JSON.parse(cached);
      return {
        programName: v.programName ?? defaults.programName,
        programSubtitle: v.programSubtitle ?? defaults.programSubtitle,
        logoUrl: v.logoUrl ?? null,
        logoOnlyUrl: v.logoOnlyUrl ?? null,
        displayMode: v.displayMode ?? defaults.displayMode,
      };
    }
  } catch { /* ignore */ }
  return defaults;
};

const BrandingContext = createContext<BrandingContextType | null>(null);

export const useBranding = () => {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error("useBranding must be used within BrandingProvider");
  return ctx;
};

export const BrandingProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<BrandingState>(loadCachedBranding);

  // Fetch from DB in background, update cache
  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const { data, error } = await supabase
          .from("company_settings")
          .select("value")
          .eq("key", "branding")
          .maybeSingle();
        if (error) {
          console.warn("Branding fetch skipped:", error.message);
          return;
        }
        if (data?.value) {
          const v = data.value as any;
          const newState = {
            programName: v.programName ?? defaults.programName,
            programSubtitle: v.programSubtitle ?? defaults.programSubtitle,
            logoUrl: v.logoUrl ?? null,
            logoOnlyUrl: v.logoOnlyUrl ?? null,
            displayMode: v.displayMode ?? defaults.displayMode,
          };
          setState(newState);
          localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(newState));
        }
      } catch {
        // Use cached/defaults silently
      }
    };
    fetchBranding();
  }, []);

  // Save to DB on change
  const persist = useCallback(async (newState: BrandingState) => {
    const jsonValue = JSON.parse(JSON.stringify(newState));
    const { data: existing } = await supabase
      .from("company_settings")
      .select("id")
      .eq("key", "branding")
      .maybeSingle();

    if (existing) {
      await supabase
        .from("company_settings")
        .update({ value: jsonValue, updated_at: new Date().toISOString() })
        .eq("key", "branding");
    } else {
      await supabase
        .from("company_settings")
        .insert([{ key: "branding", value: jsonValue }]);
    }
  }, []);

  const update = (partial: Partial<BrandingState>) => {
    setState((s) => {
      const next = { ...s, ...partial };
      localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(next));
      persist(next);
      return next;
    });
  };

  return (
    <BrandingContext.Provider
      value={{
        ...state,
        setProgramName: (programName) => update({ programName }),
        setProgramSubtitle: (programSubtitle) => update({ programSubtitle }),
        setLogoUrl: (logoUrl) => update({ logoUrl }),
        setLogoOnlyUrl: (logoOnlyUrl) => update({ logoOnlyUrl }),
        setDisplayMode: (displayMode) => update({ displayMode }),
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
};
