import { useState, useEffect } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type ApproverType = "role" | "employee";

interface TierApprover {
  type: ApproverType;
  value: string;
  label?: string;
}

interface ApprovalModule {
  key: string;
  name: string;
  tiers: TierApprover[];
}

const tierLabels = ["ผู้อนุมัติขั้นแรก", "ผู้อนุมัติขั้นสอง", "ผู้อนุมัติสุดท้าย"];
const tierColors = ["#FF870F", "#87FF0F", "#FFFF0F"];

const roleOptions = [
  { value: "admin", label: "Admin" },
  { value: "hr", label: "HR" },
  { value: "manager", label: "Manager" },
  { value: "executive", label: "Executive" },
];

const defaultModules: ApprovalModule[] = [
  { key: "leave", name: "การลา (Leave)", tiers: [{ type: "role", value: "admin" }] },
  { key: "ot", name: "การทำ OT", tiers: [{ type: "role", value: "admin" }] },
  { key: "time_edit", name: "การแก้ไขเวลา", tiers: [{ type: "role", value: "admin" }] },
];

const SETTINGS_KEY = "approval_config";

const ApprovalSettings = () => {
  const { toast } = useToast();
  const [modules, setModules] = useState<ApprovalModule[]>(defaultModules);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [settingsRes, empRes] = await Promise.all([
        supabase.from("company_settings").select("value").eq("key", SETTINGS_KEY).maybeSingle(),
        supabase.from("employees").select("id, first_name, last_name").eq("status", "active").order("first_name"),
      ]);

      if (empRes.data) {
        setEmployees(empRes.data.map(e => ({ id: e.id, name: `${e.first_name} ${e.last_name}` })));
      }

      if (settingsRes.data?.value) {
        try {
          const saved = settingsRes.data.value as unknown as ApprovalModule[];
          if (Array.isArray(saved) && saved.length > 0) {
            setModules(saved);
          }
        } catch { /* use defaults */ }
      }
      setLoading(false);
    };
    load();
  }, []);

  const addTier = (mi: number) => {
    setModules(prev =>
      prev.map((m, i) =>
        i === mi && m.tiers.length < 3
          ? { ...m, tiers: [...m.tiers, { type: "role", value: "admin" }] }
          : m
      )
    );
  };

  const removeTier = (mi: number, ti: number) => {
    setModules(prev =>
      prev.map((m, i) =>
        i === mi && m.tiers.length > 1
          ? { ...m, tiers: m.tiers.filter((_, idx) => idx !== ti) }
          : m
      )
    );
  };

  const updateTier = (mi: number, ti: number, updates: Partial<TierApprover>) => {
    setModules(prev =>
      prev.map((m, i) =>
        i === mi
          ? {
              ...m,
              tiers: m.tiers.map((t, idx) => {
                if (idx !== ti) return t;
                const newTier = { ...t, ...updates };
                if (updates.type && updates.type !== t.type) {
                  newTier.value = updates.type === "role" ? "admin" : (employees[0]?.id || "");
                }
                return newTier;
              }),
            }
          : m
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    // Upsert into company_settings
    const { data: existing } = await supabase
      .from("company_settings")
      .select("id")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();

    let error;
    if (existing) {
      ({ error } = await supabase
        .from("company_settings")
        .update({ value: JSON.parse(JSON.stringify(modules)), updated_at: new Date().toISOString() })
        .eq("key", SETTINGS_KEY));
    } else {
      ({ error } = await supabase
        .from("company_settings")
        .insert([{ key: SETTINGS_KEY, value: JSON.parse(JSON.stringify(modules)) }]));
    }

    setSaving(false);
    if (error) {
      toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "บันทึกสำเร็จ", description: "การตั้งค่าระบบอนุมัติถูกอัปเดตแล้ว" });
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">กำหนดกระบวนการอนุมัติแบบหลายระดับ (Multi-tier Approval)</p>

      {modules.map((module, mi) => (
        <div key={module.key} className="card-base p-5">
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

                <select
                  value={tier.type}
                  onChange={(e) => updateTier(mi, ti, { type: e.target.value as ApproverType })}
                  className="px-2 py-2 text-sm rounded-xl border outline-none bg-muted/30 cursor-pointer flex-shrink-0"
                >
                  <option value="role">ตาม Role</option>
                  <option value="employee">ระบุพนักงาน</option>
                </select>

                {tier.type === "role" ? (
                  <select
                    value={tier.value}
                    onChange={(e) => updateTier(mi, ti, { value: e.target.value })}
                    className="px-3 py-2 text-sm rounded-xl border outline-none bg-muted/30 cursor-pointer flex-1 min-w-[140px]"
                  >
                    {roleOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <div className="flex-1 min-w-[140px]">
                    <SearchableSelect
                      value={tier.value}
                      onChange={(val) => updateTier(mi, ti, { value: val })}
                      options={employees.map((emp) => ({ value: emp.id, label: emp.name }))}
                      placeholder="เลือกพนักงาน"
                    />
                  </div>
                )}

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
        disabled={saving}
        className="px-6 py-2.5 rounded-xl text-sm font-bold text-primary-foreground disabled:opacity-50 flex items-center gap-2"
        style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        บันทึกการตั้งค่า
      </button>
    </div>
  );
};

export default ApprovalSettings;
