import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

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

const STORAGE_KEY = "hrpro-branding";

const defaults: BrandingState = {
  programName: "HRPro",
  programSubtitle: "Enterprise",
  logoUrl: null,
  logoOnlyUrl: null,
  displayMode: "logo-and-name",
};

function load(): BrandingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {}
  return defaults;
}

const BrandingContext = createContext<BrandingContextType | null>(null);

export const useBranding = () => {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error("useBranding must be used within BrandingProvider");
  return ctx;
};

export const BrandingProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<BrandingState>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  return (
    <BrandingContext.Provider
      value={{
        ...state,
        setProgramName: (programName) => setState((s) => ({ ...s, programName })),
        setProgramSubtitle: (programSubtitle) => setState((s) => ({ ...s, programSubtitle })),
        setLogoUrl: (logoUrl) => setState((s) => ({ ...s, logoUrl })),
        setLogoOnlyUrl: (logoOnlyUrl) => setState((s) => ({ ...s, logoOnlyUrl })),
        setDisplayMode: (displayMode) => setState((s) => ({ ...s, displayMode })),
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
};
