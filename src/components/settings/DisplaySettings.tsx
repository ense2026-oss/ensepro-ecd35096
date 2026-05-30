import { useState, useEffect } from "react";
import { Palette, Type, Check, RotateCcw, Paintbrush, ChevronDown, ChevronUp } from "lucide-react";

// --- Color conversion helpers ---
const hslToHex = (hslStr: string): string => {
  try {
    const [h, sRaw, lRaw] = hslStr.split(" ").map((v) => parseFloat(v));
    const s = sRaw / 100;
    const l = lRaw / 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * Math.max(0, Math.min(1, color)))
        .toString(16)
        .padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  } catch {
    return "#ff870f";
  }
};

const hexToHsl = (hex: string): string => {
  try {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
        case g: h = ((b - r) / d + 2) * 60; break;
        case b: h = ((r - g) / d + 4) * 60; break;
      }
    }
    return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  } catch {
    return "31 100% 53%";
  }
};

// --- Data ---
const themePresets = [
  { id: "default", name: "เขียว (ค่าเริ่มต้น)", primary: "150 80% 40%", accent: "120 60% 50%", highlight: "90 70% 55%" },
  { id: "blue", name: "น้ำเงิน", primary: "220 90% 56%", accent: "180 70% 45%", highlight: "200 80% 60%" },
  { id: "orange", name: "ส้ม", primary: "31 100% 53%", accent: "90 100% 53%", highlight: "60 100% 53%" },
  { id: "purple", name: "ม่วง", primary: "270 70% 55%", accent: "300 60% 50%", highlight: "250 80% 65%" },
  { id: "red", name: "แดง", primary: "0 80% 55%", accent: "15 90% 55%", highlight: "350 70% 60%" },
  { id: "teal", name: "เทล", primary: "180 60% 45%", accent: "160 50% 50%", highlight: "200 60% 55%" },
  { id: "custom", name: "กำหนดเอง", primary: "150 80% 40%", accent: "120 60% 50%", highlight: "90 70% 55%" },
];

const fontOptions = [
  { id: "inter", name: "Inter", family: "'Inter', system-ui, sans-serif", sample: "Aa กขค 0123" },
  { id: "jakarta", name: "Plus Jakarta Sans", family: "'Plus Jakarta Sans', system-ui, sans-serif", sample: "Aa กขค 0123" },
  { id: "sarabun", name: "Sarabun", family: "'Sarabun', system-ui, sans-serif", sample: "Aa กขค 0123", googleFont: "Sarabun:wght@300;400;500;600;700" },
  { id: "prompt", name: "Prompt", family: "'Prompt', system-ui, sans-serif", sample: "Aa กขค 0123", googleFont: "Prompt:wght@300;400;500;600;700" },
  { id: "kanit", name: "Kanit", family: "'Kanit', system-ui, sans-serif", sample: "Aa กขค 0123", googleFont: "Kanit:wght@300;400;500;600;700" },
  { id: "noto-sans-thai", name: "Noto Sans Thai", family: "'Noto Sans Thai', system-ui, sans-serif", sample: "Aa กขค 0123", googleFont: "Noto+Sans+Thai:wght@300;400;500;600;700" },
];

const fontSizeOptions = [
  { id: "small", name: "เล็ก", scale: 0.9 },
  { id: "medium", name: "ปกติ", scale: 1 },
  { id: "large", name: "ใหญ่", scale: 1.1 },
];

const borderRadiusOptions = [
  { id: "none", name: "ไม่มี", value: "0rem" },
  { id: "small", name: "เล็กน้อย", value: "0.375rem" },
  { id: "medium", name: "ปานกลาง", value: "0.75rem" },
  { id: "large", name: "มาก", value: "1rem" },
  { id: "full", name: "มากที่สุด", value: "1.5rem" },
];

interface CustomColors {
  sidebarBg: string;
  sidebarFont: string;
  primary: string;
  primaryFont: string;
  secondary: string;
  secondaryFont: string;
  topbarBg: string;
  topbarFont: string;
  pageBg: string;
  cardBg: string;
  accent: string;
  destructive: string;
}

const defaultCustomColors: CustomColors = {
  sidebarBg: "0 0% 5%",
  sidebarFont: "0 0% 90%",
  primary: "150 80% 40%",
  primaryFont: "0 0% 100%",
  secondary: "0 0% 90%",
  secondaryFont: "0 0% 15%",
  topbarBg: "0 0% 100%",
  topbarFont: "0 0% 8%",
  pageBg: "0 0% 96%",
  cardBg: "0 0% 100%",
  accent: "120 60% 50%",
  destructive: "0 84% 60%",
};

const colorFields: { key: keyof CustomColors; label: string; icon: string }[] = [
  { key: "sidebarBg", label: "พื้นหลัง Sidebar", icon: "◧" },
  { key: "sidebarFont", label: "ฟอนต์เมนู Sidebar", icon: "A" },
  { key: "primary", label: "สีปุ่มหลัก", icon: "●" },
  { key: "primaryFont", label: "ฟอนต์ปุ่มหลัก", icon: "A" },
  { key: "secondary", label: "สีปุ่มรอง", icon: "○" },
  { key: "secondaryFont", label: "ฟอนต์ปุ่มรอง", icon: "A" },
  { key: "topbarBg", label: "พื้นหลัง Navigation Bar", icon: "▬" },
  { key: "topbarFont", label: "ฟอนต์ Navigation Bar", icon: "A" },
  { key: "pageBg", label: "พื้นหลังหน้าเว็บ", icon: "▢" },
  { key: "cardBg", label: "พื้นหลังการ์ด", icon: "▣" },
  { key: "accent", label: "สีเน้น (Accent)", icon: "◆" },
  { key: "destructive", label: "สีลบ/อันตราย", icon: "⚠" },
];

const STORAGE_KEY = "hrpro-display-settings";

// Per-user personal display key (does not affect the global/main program theme)
export const getPersonalDisplayKey = (userId: string) => `${STORAGE_KEY}::${userId}`;

interface DisplaySettingsState {
  themeId: string;
  fontId: string;
  fontSizeId: string;
  borderRadiusId: string;
  customColors: CustomColors;
}

const defaultSettings: DisplaySettingsState = {
  themeId: "default",
  fontId: "sarabun",
  fontSizeId: "large",
  borderRadiusId: "full",
  customColors: { ...defaultCustomColors },
};

const loadSettings = (key: string = STORAGE_KEY): DisplaySettingsState => {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...defaultSettings,
        ...parsed,
        customColors: { ...defaultCustomColors, ...(parsed.customColors || {}) },
      };
    }
  } catch {}
  return defaultSettings;
};

const loadFont = (googleFont?: string) => {
  if (!googleFont) return;
  const id = `font-${googleFont.split(":")[0].replace(/\+/g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${googleFont}&display=swap`;
  document.head.appendChild(link);
};

export const applyDisplaySettings = (settings?: DisplaySettingsState) => {
  const s = settings || loadSettings();
  const root = document.documentElement;

  if (s.themeId === "custom") {
    const c = s.customColors;
    root.style.setProperty("--primary", c.primary);
    root.style.setProperty("--primary-foreground", c.primaryFont);
    root.style.setProperty("--secondary", c.secondary);
    root.style.setProperty("--secondary-foreground", c.secondaryFont);
    root.style.setProperty("--sidebar-background", c.sidebarBg);
    root.style.setProperty("--sidebar-foreground", c.sidebarFont);
    root.style.setProperty("--sidebar-primary", c.primary);
    root.style.setProperty("--sidebar-primary-foreground", c.primaryFont);
    root.style.setProperty("--topbar-background", c.topbarBg);
    root.style.setProperty("--foreground", c.topbarFont);
    root.style.setProperty("--background", c.pageBg);
    root.style.setProperty("--card", c.cardBg);
    root.style.setProperty("--popover", c.cardBg);
    root.style.setProperty("--accent", c.accent);
    root.style.setProperty("--destructive", c.destructive);
    root.style.setProperty("--ring", c.primary);
    root.style.setProperty("--sidebar-ring", c.primary);
    root.style.setProperty("--chart-1", c.primary);
  } else {
    const theme = themePresets.find((t) => t.id === s.themeId) || themePresets[0];
    root.style.setProperty("--primary", theme.primary);
    root.style.setProperty("--ring", theme.primary);
    root.style.setProperty("--sidebar-primary", theme.primary);
    root.style.setProperty("--sidebar-ring", theme.primary);
    root.style.setProperty("--chart-1", theme.primary);
    // Reset custom overrides
    ["--primary-foreground", "--secondary", "--secondary-foreground", "--sidebar-background",
     "--sidebar-foreground", "--sidebar-primary-foreground", "--topbar-background",
     "--foreground", "--background", "--card", "--popover", "--accent", "--destructive"
    ].forEach((prop) => root.style.removeProperty(prop));
  }

  // Font
  const font = fontOptions.find((f) => f.id === s.fontId) || fontOptions[0];
  if (font.googleFont) loadFont(font.googleFont);
  root.style.setProperty("--font-body", font.family);
  document.body.style.fontFamily = font.family;

  // Font size
  const fontSize = fontSizeOptions.find((f) => f.id === s.fontSizeId) || fontSizeOptions[1];
  root.style.fontSize = `${fontSize.scale * 16}px`;

  // Border radius
  const radius = borderRadiusOptions.find((r) => r.id === s.borderRadiusId) || borderRadiusOptions[2];
  root.style.setProperty("--radius", radius.value);
};

// Apply on startup: a logged-in user's personal preferences take precedence
// over the global/main program theme (for that user's own view only).
export const applyStartupDisplaySettings = () => {
  try {
    const raw = localStorage.getItem("auth_profile_cache");
    if (raw) {
      const userId = JSON.parse(raw)?.userId;
      if (userId) {
        const personalKey = getPersonalDisplayKey(userId);
        if (localStorage.getItem(personalKey)) {
          applyDisplaySettings(loadSettings(personalKey));
          return;
        }
      }
    }
  } catch { /* ignore */ }
  applyDisplaySettings(loadSettings());
};


const ColorPickerField = ({
  label,
  icon,
  hslValue,
  onChange,
}: {
  label: string;
  icon: string;
  hslValue: string;
  onChange: (hsl: string) => void;
}) => {
  const hex = hslToHex(hslValue);
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl border border-border hover:border-primary/30 transition-colors">
      <span className="text-base w-5 text-center opacity-60">{icon}</span>
      <span className="text-sm font-medium flex-1 min-w-0 truncate">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-muted-foreground uppercase">{hex}</span>
        <label className="relative cursor-pointer">
          <div
            className="w-8 h-8 rounded-lg border-2 border-border shadow-sm transition-shadow hover:shadow-md"
            style={{ background: `hsl(${hslValue})` }}
          />
          <input
            type="color"
            value={hex}
            onChange={(e) => onChange(hexToHsl(e.target.value))}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </label>
      </div>
    </div>
  );
};

interface DisplaySettingsProps {
  /** Override storage key to scope settings (e.g. per-user personal settings) */
  storageKey?: string;
  /** Personal mode: reset reverts to the main program theme instead of defaults */
  personal?: boolean;
}

const DisplaySettings = ({ storageKey = STORAGE_KEY, personal = false }: DisplaySettingsProps) => {
  const [settings, setSettings] = useState<DisplaySettingsState>(() => loadSettings(storageKey));
  const [showCustom, setShowCustom] = useState(settings.themeId === "custom");

  useEffect(() => {
    applyDisplaySettings(settings);
    localStorage.setItem(storageKey, JSON.stringify(settings));
  }, [settings, storageKey]);

  const update = (key: keyof DisplaySettingsState, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateCustomColor = (key: keyof CustomColors, value: string) => {
    setSettings((prev) => ({
      ...prev,
      themeId: "custom",
      customColors: { ...prev.customColors, [key]: value },
    }));
    if (!showCustom) setShowCustom(true);
  };

  const reset = () => {
    if (personal) {
      // Revert to the main program (global) theme for this user
      localStorage.removeItem(storageKey);
      const global = loadSettings(STORAGE_KEY);
      setSettings(global);
      setShowCustom(global.themeId === "custom");
    } else {
      setSettings(defaultSettings);
      setShowCustom(false);
    }
  };

  const selectTheme = (id: string) => {
    update("themeId", id);
    if (id === "custom") {
      setShowCustom(true);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" />
            การแสดงผล
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">ปรับแต่งสีธีม ฟอนต์ และรูปแบบการแสดงผล</p>
        </div>
        <button onClick={reset} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-border hover:bg-muted transition-colors">
          <RotateCcw className="w-3.5 h-3.5" /> รีเซ็ต
        </button>
      </div>

      {/* Theme Color Presets */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Palette className="w-4 h-4 text-muted-foreground" /> สีธีมหลัก
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {themePresets.filter((t) => t.id !== "custom").map((theme) => {
            const isActive = settings.themeId === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => selectTheme(theme.id)}
                className="relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left"
                style={{
                  borderColor: isActive ? `hsl(${theme.primary})` : "hsl(var(--border))",
                  background: isActive ? `hsl(${theme.primary} / 0.06)` : "transparent",
                }}
              >
                <div className="flex gap-1">
                  <div className="w-6 h-6 rounded-full" style={{ background: `hsl(${theme.primary})` }} />
                  <div className="w-4 h-4 rounded-full mt-1" style={{ background: `hsl(${theme.accent})`, opacity: 0.7 }} />
                </div>
                <span className="text-sm font-medium flex-1">{theme.name}</span>
                {isActive && (
                  <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: `hsl(${theme.primary})` }}>
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
        {/* Preview bar */}
        <div className="flex gap-2 items-center p-3 rounded-xl bg-muted/50">
          <span className="text-xs text-muted-foreground">ตัวอย่าง:</span>
          <div className="flex gap-1.5">
            <div className="h-7 px-4 rounded-lg text-xs font-medium flex items-center text-primary-foreground bg-primary">
              ปุ่มหลัก
            </div>
            <div className="h-7 px-3 rounded-lg text-xs font-medium flex items-center border border-border bg-card">
              ปุ่มรอง
            </div>
          </div>
        </div>
      </section>

      {/* Custom Color Picker Section */}
      <section className="space-y-3">
        <button
          onClick={() => {
            setShowCustom(!showCustom);
            if (!showCustom && settings.themeId !== "custom") {
              selectTheme("custom");
            }
          }}
          className="w-full flex items-center gap-2 text-sm font-semibold py-2 group"
        >
          <Paintbrush className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="flex-1 text-left">กำหนดสีเองตามส่วนต่างๆ</span>
          <span className="text-[10px] font-normal text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
            {settings.themeId === "custom" ? "กำลังใช้งาน" : "ปรับเอง"}
          </span>
          {showCustom ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {showCustom && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-4 rounded-xl border border-dashed border-primary/30 bg-primary/[0.02]">
            {colorFields.map((field) => (
              <ColorPickerField
                key={field.key}
                label={field.label}
                icon={field.icon}
                hslValue={settings.customColors[field.key]}
                onChange={(hsl) => updateCustomColor(field.key, hsl)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Font */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Type className="w-4 h-4 text-muted-foreground" /> ฟอนต์
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {fontOptions.map((font) => {
            const isActive = settings.fontId === font.id;
            if (font.googleFont) loadFont(font.googleFont);
            return (
              <button
                key={font.id}
                onClick={() => update("fontId", font.id)}
                className="flex flex-col items-start p-3 rounded-xl border-2 transition-all text-left"
                style={{
                  borderColor: isActive ? "hsl(var(--primary))" : "hsl(var(--border))",
                  background: isActive ? "hsl(var(--primary) / 0.06)" : "transparent",
                }}
              >
                <span className="text-sm font-semibold">{font.name}</span>
                <span className="text-lg mt-1 text-muted-foreground" style={{ fontFamily: font.family }}>{font.sample}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Font Size */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold">ขนาดตัวอักษร</h4>
        <div className="flex gap-3">
          {fontSizeOptions.map((size) => {
            const isActive = settings.fontSizeId === size.id;
            return (
              <button
                key={size.id}
                onClick={() => update("fontSizeId", size.id)}
                className="flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all"
                style={{
                  borderColor: isActive ? "hsl(var(--primary))" : "hsl(var(--border))",
                  background: isActive ? "hsl(var(--primary) / 0.06)" : "transparent",
                }}
              >
                {size.name}
              </button>
            );
          })}
        </div>
      </section>

      {/* Border Radius */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold">ความโค้งมน</h4>
        <div className="flex gap-3 flex-wrap">
          {borderRadiusOptions.map((r) => {
            const isActive = settings.borderRadiusId === r.id;
            return (
              <button
                key={r.id}
                onClick={() => update("borderRadiusId", r.id)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all min-w-[4.5rem]"
                style={{
                  borderColor: isActive ? "hsl(var(--primary))" : "hsl(var(--border))",
                  background: isActive ? "hsl(var(--primary) / 0.06)" : "transparent",
                }}
              >
                <div className="w-8 h-8 border-2 border-foreground/30" style={{ borderRadius: r.value }} />
                <span className="text-xs font-medium">{r.name}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default DisplaySettings;
