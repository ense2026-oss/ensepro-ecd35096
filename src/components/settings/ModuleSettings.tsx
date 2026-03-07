import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Users,
  GitBranch,
  Clock,
  CalendarDays,
  MapPin,
  Banknote,
  FileSignature,
  FileText,
  ScanFace,
} from "lucide-react";

interface ModuleConfig {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  enabled: boolean;
  locked?: boolean; // Cannot be toggled off
}

const DEFAULT_MODULES: ModuleConfig[] = [
  { id: "employees", label: "ข้อมูลพนักงาน", description: "จัดการข้อมูลพนักงานทั้งหมด", icon: Users, enabled: true, locked: true },
  { id: "organization", label: "โครงสร้างองค์กร", description: "จัดการแผนกและตำแหน่งงาน", icon: GitBranch, enabled: true },
  { id: "contracts", label: "จัดการสัญญาจ้าง", description: "สร้างและจัดการสัญญาจ้างพนักงาน", icon: FileSignature, enabled: true },
  { id: "attendance", label: "บันทึกเวลา", description: "ระบบบันทึกเวลาเข้า-ออกงาน", icon: Clock, enabled: true },
  { id: "leave", label: "ระบบลางาน", description: "การลาและอนุมัติการลา", icon: CalendarDays, enabled: true },
  { id: "overtime", label: "ระบบโอที", description: "การทำงานล่วงเวลาและอนุมัติ", icon: Clock, enabled: true },
  { id: "check-in", label: "ลงเวลาเข้า-ออกงาน", description: "สแกนหน้าหรือ GPS ลงเวลา", icon: MapPin, enabled: true },
  { id: "shift-management", label: "จัดการกะทำงาน", description: "กำหนดกะและจัดตารางงาน", icon: CalendarDays, enabled: true },
  { id: "payroll", label: "จัดการเงินเดือน", description: "คำนวณเงินเดือนและสลิป", icon: Banknote, enabled: true },
  { id: "reports", label: "รายงาน", description: "รายงานและสรุปข้อมูลต่างๆ", icon: FileText, enabled: true },
  { id: "face-scanner", label: "เครื่องสแกนหน้า", description: "ตั้งค่าเครื่องสแกนหน้า", icon: ScanFace, enabled: false },
];

const STORAGE_KEY = "module-settings";

const ModuleSettings = () => {
  const [modules, setModules] = useState<ModuleConfig[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, boolean>;
        return DEFAULT_MODULES.map((m) => ({
          ...m,
          enabled: parsed[m.id] !== undefined ? parsed[m.id] : m.enabled,
        }));
      }
    } catch {}
    return DEFAULT_MODULES;
  });

  useEffect(() => {
    const obj: Record<string, boolean> = {};
    modules.forEach((m) => (obj[m.id] = m.enabled));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    // Dispatch event so Sidebar/MobileFooterNav can react in real-time
    window.dispatchEvent(new CustomEvent("module-settings-changed", { detail: obj }));
  }, [modules]);

  const handleToggle = (id: string) => {
    setModules((prev) =>
      prev.map((m) =>
        m.id === id && !m.locked ? { ...m, enabled: !m.enabled } : m
      )
    );
    const mod = modules.find((m) => m.id === id);
    if (mod) {
      toast.success(`${mod.label} ${mod.enabled ? "ปิดใช้งานแล้ว" : "เปิดใช้งานแล้ว"}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">ตั้งค่าโมดูล</h3>
        <p className="text-sm text-muted-foreground mt-1">เปิด/ปิดโมดูลต่างๆ ในระบบ การเปลี่ยนแปลงจะมีผลทันที</p>
      </div>

      <div className="space-y-2">
        {modules.map((mod) => (
          <div
            key={mod.id}
            className="flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors"
            style={{
              borderColor: "hsl(var(--border))",
              background: mod.enabled ? "hsl(var(--card))" : "hsl(var(--muted) / 0.3)",
              opacity: mod.enabled ? 1 : 0.7,
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0"
                style={{
                  background: mod.enabled
                    ? "hsl(var(--primary) / 0.1)"
                    : "hsl(var(--muted))",
                  color: mod.enabled
                    ? "hsl(var(--primary))"
                    : "hsl(var(--muted-foreground))",
                }}
              >
                <mod.icon className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <Label className="text-sm font-medium leading-tight">{mod.label}</Label>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{mod.description}</p>
              </div>
            </div>

            <Switch
              checked={mod.enabled}
              onCheckedChange={() => handleToggle(mod.id)}
              disabled={mod.locked}
              aria-label={`Toggle ${mod.label}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ModuleSettings;
