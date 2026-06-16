import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useModuleSettings } from "@/hooks/useModuleSettings";
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
  locked?: boolean;
}

const MODULE_DEFS: ModuleConfig[] = [
  { id: "employees", label: "ข้อมูลพนักงาน", description: "จัดการข้อมูลพนักงานทั้งหมด", icon: Users, locked: true },
  { id: "attendance", label: "บันทึกเวลา", description: "ระบบบันทึกเวลาเข้า-ออกงาน", icon: Clock },
  { id: "check-in", label: "ระบบลงเวลา (Check-in)", description: "ลงเวลาเข้า-ออกงานด้วย GPS และพื้นที่เข้างาน", icon: MapPin },
  { id: "leave", label: "ระบบลางาน", description: "การลาและอนุมัติการลา", icon: CalendarDays },
  { id: "overtime", label: "ระบบโอที", description: "การทำงานล่วงเวลาและอนุมัติ", icon: Clock },
  { id: "shift-management", label: "จัดการกะทำงาน", description: "กำหนดกะและจัดตารางงาน", icon: CalendarDays },
  { id: "payroll", label: "จัดการเงินเดือน", description: "คำนวณเงินเดือนและสลิป", icon: Banknote },
  { id: "reports", label: "รายงาน", description: "รายงานและสรุปข้อมูลต่างๆ", icon: FileText },
  { id: "face-scanner", label: "เครื่องสแกนหน้า", description: "ตั้งค่าเครื่องสแกนหน้า", icon: ScanFace },
];

const ModuleSettings = () => {
  const { modules, loading, updateModules } = useModuleSettings();

  const handleToggle = (id: string) => {
    const def = MODULE_DEFS.find((m) => m.id === id);
    if (!def || def.locked) return;

    const newModules = { ...modules, [id]: !modules[id] };
    updateModules(newModules);
    toast.success(`${def.label} ${modules[id] ? "ปิดใช้งานแล้ว" : "เปิดใช้งานแล้ว"}`);
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground py-4">กำลังโหลด...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">ตั้งค่าโมดูล</h3>
        <p className="text-sm text-muted-foreground mt-1">เปิด/ปิดโมดูลต่างๆ ในระบบ การเปลี่ยนแปลงจะมีผลทันทีกับผู้ใช้ทุกคน</p>
      </div>

      <div className="space-y-2">
        {MODULE_DEFS.map((mod) => {
          const enabled = modules[mod.id] !== false;
          return (
            <div
              key={mod.id}
              className="flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors"
              style={{
                borderColor: "hsl(var(--border))",
                background: enabled ? "hsl(var(--card))" : "hsl(var(--muted) / 0.3)",
                opacity: enabled ? 1 : 0.7,
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0"
                  style={{
                    background: enabled
                      ? "hsl(var(--primary) / 0.1)"
                      : "hsl(var(--muted))",
                    color: enabled
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
                checked={enabled}
                onCheckedChange={() => handleToggle(mod.id)}
                disabled={mod.locked}
                aria-label={`Toggle ${mod.label}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ModuleSettings;
