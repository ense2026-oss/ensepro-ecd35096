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

const defaults: BrandingState = {
  programName: "HRPro",
  programSubtitle: "Enterprise",
  logoUrl: null,
  logoOnlyUrl: null,
  displayMode: "logo-and-name",
};

const BrandingContext = createContext<BrandingContextType | null>(null);

export const useBranding = () => {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error("useBranding must be used within BrandingProvider");
  return ctx;
};

export const BrandingProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<BrandingState>(defaults);

  // Fetch from DB
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("company_settings")
        .select("value")
        .eq("key", "branding")
        .maybeSingle();
      if (data?.value) {
        const v = data.value as any;
        setState({
          programName: v.programName ?? defaults.programName,
          programSubtitle: v.programSubtitle ?? defaults.programSubtitle,
          logoUrl: v.logoUrl ?? null,
          logoOnlyUrl: v.logoOnlyUrl ?? null,
          displayMode: v.displayMode ?? defaults.displayMode,
        });
      }
    };
    fetch();
  }, []);

  // Save to DB on change
  const persist = useCallback(async (newState: BrandingState) => {
    await supabase
      .from("company_settings")
      .update({ value: newState as any, updated_at: new Date().toISOString() })
      .eq("key", "branding");
  }, []);

  const update = (partial: Partial<BrandingState>) => {
    setState((s) => {
      const next = { ...s, ...partial };
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
