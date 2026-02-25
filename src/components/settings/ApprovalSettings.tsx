import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ApproverType = "role" | "employee";

interface TierApprover {
  type: ApproverType;
  value: string;
}

interface ApprovalModule {
  name: string;
  tiers: TierApprover[];
}

const tierLabels = ["ผู้อนุมัติขั้นแรก", "ผู้อนุมัติขั้นสอง", "ผู้อนุมัติสุดท้าย"];
const tierColors = ["#FF870F", "#87FF0F", "#FFFF0F"];

const roleOptions = ["หัวหน้าตรง", "Manager", "HR Manager", "CEO", "Executive", "Admin"];
const employeeOptions = [
  "สมชาย ใจดี",
  "สมหญิง รักงาน",
  "วิชัย สุขสันต์",
  "นภา แก้วมณี",
  "ประเสริฐ ศรีสุข",
  "จันทร์เพ็ญ วงษ์สวัสดิ์",
];

const defaultTier: TierApprover = { type: "role", value: "หัวหน้าตรง" };

const ApprovalSettings = () => {
  const { toast } = useToast();
  const [modules, setModules] = useState<ApprovalModule[]>([
    { name: "การลา (Leave)", tiers: [{ ...defaultTier }] },
    { name: "การทำ OT", tiers: [{ ...defaultTier }] },
    { name: "การแก้ไขเวลา", tiers: [{ ...defaultTier }] },
  ]);

  const addTier = (mi: number) => {
    setModules((prev) =>
      prev.map((m, i) =>
        i === mi && m.tiers.length < 3
          ? { ...m, tiers: [...m.tiers, { ...defaultTier }] }
          : m
      )
    );
  };

  const removeTier = (mi: number, ti: number) => {
    setModules((prev) =>
      prev.map((m, i) =>
        i === mi && m.tiers.length > 1
          ? { ...m, tiers: m.tiers.filter((_, idx) => idx !== ti) }
          : m
      )
    );
  };

  const updateTier = (mi: number, ti: number, updates: Partial<TierApprover>) => {
    setModules((prev) =>
      prev.map((m, i) =>
        i === mi
          ? {
              ...m,
              tiers: m.tiers.map((t, idx) => {
                if (idx !== ti) return t;
                const newTier = { ...t, ...updates };
                // Reset value when switching type
                if (updates.type && updates.type !== t.type) {
                  newTier.value = updates.type === "role" ? roleOptions[0] : employeeOptions[0];
                }
                return newTier;
              }),
            }
          : m
      )
    );
  };

  const handleSave = () => {
    toast({ title: "บันทึกสำเร็จ", description: "การตั้งค่าระบบอนุมัติถูกอัปเดตแล้ว" });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">กำหนดกระบวนการอนุมัติแบบหลายระดับ (Multi-tier Approval)</p>

      {modules.map((module, mi) => (
        <div key={module.name} className="card-base p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold">{module.name}</h4>
            <span className="text-xs text-muted-foreground">{module.tiers.length} ระดับ</span>
          </div>
          <div className="space-y-3">
            {module.tiers.map((tier, ti) => (
              <div key={ti} className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: tierColors[ti] || "#ccc", color: "#000" }}
                >
                  {ti + 1}
                </div>
                <div className="flex-shrink-0">
                  <p className="text-sm font-medium whitespace-nowrap">
                    Tier {ti + 1} ({tierLabels[ti] || `ระดับที่ ${ti + 1}`})
                  </p>
                </div>

                {/* Type selector */}
                <select
                  value={tier.type}
                  onChange={(e) => updateTier(mi, ti, { type: e.target.value as ApproverType })}
                  className="px-2 py-2 text-sm rounded-xl border outline-none bg-muted/30 cursor-pointer flex-shrink-0"
                >
                  <option value="role">ตาม Role</option>
                  <option value="employee">ระบุพนักงาน</option>
                </select>

                {/* Value selector */}
                <select
                  value={tier.value}
                  onChange={(e) => updateTier(mi, ti, { value: e.target.value })}
                  className="px-3 py-2 text-sm rounded-xl border outline-none bg-muted/30 cursor-pointer flex-1 min-w-[140px]"
                >
                  {(tier.type === "role" ? roleOptions : employeeOptions).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>

                {module.tiers.length > 1 && (
                  <button
                    onClick={() => removeTier(mi, ti)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-destructive flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {module.tiers.length < 3 && (
            <button
              onClick={() => addTier(mi)}
              className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors border border-dashed"
              style={{ borderColor: "hsl(var(--border))" }}
            >
              <Plus className="w-4 h-4" />
              เพิ่มระดับการอนุมัติ
            </button>
          )}
        </div>
      ))}

      <button
        onClick={handleSave}
        className="px-6 py-2.5 rounded-xl text-sm font-bold text-primary-foreground"
        style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}
      >
        บันทึกการตั้งค่า
      </button>
    </div>
  );
};

export default ApprovalSettings;
