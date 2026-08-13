import { useState, useEffect } from "react";
import { Plus, X, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useEmployeeFieldOptions,
  saveEmployeeFieldOptions,
  type EmployeeFieldOptions,
} from "@/hooks/useEmployeeFieldOptions";

const FIELDS: { key: keyof EmployeeFieldOptions; label: string }[] = [
  { key: "prefixes", label: "คำนำหน้า" },
  { key: "genders", label: "เพศ" },
  { key: "religions", label: "ศาสนา" },
  { key: "bloodGroups", label: "กรุ๊ปเลือด" },
  { key: "nationalities", label: "สัญชาติ" },
  { key: "maritalStatuses", label: "สถานภาพสมรส" },
  { key: "employeeTypes", label: "ประเภทพนักงาน" },
];

const EmployeeFieldOptionsSettings = () => {
  const { toast } = useToast();
  const { options, loading, reload } = useEmployeeFieldOptions();
  const [draft, setDraft] = useState<EmployeeFieldOptions | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!loading) setDraft(options); }, [loading, options]);

  if (!draft) return null;

  const addItem = (key: keyof EmployeeFieldOptions) => {
    const v = (inputs[key] || "").trim();
    if (!v || draft[key].includes(v)) return;
    setDraft({ ...draft, [key]: [...draft[key], v] });
    setInputs({ ...inputs, [key]: "" });
  };

  const removeItem = (key: keyof EmployeeFieldOptions, value: string) => {
    if (draft[key].length <= 1) return;
    setDraft({ ...draft, [key]: draft[key].filter((v) => v !== value) });
  };

  const save = async () => {
    setSaving(true);
    const { error } = await saveEmployeeFieldOptions(draft);
    setSaving(false);
    if (error) {
      toast({ title: "บันทึกไม่สำเร็จ", description: String((error as { message?: string })?.message || error), variant: "destructive" });
      return;
    }
    toast({ title: "บันทึกตัวเลือกข้อมูลพนักงานแล้ว" });
    reload();
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold">ตัวเลือกข้อมูลพนักงาน</h3>
        <p className="text-sm text-muted-foreground">กำหนดตัวเลือกที่จะแสดงในฟอร์มเพิ่ม/แก้ไขข้อมูลพนักงาน</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map(({ key, label }) => (
          <div key={key} className="rounded-xl border p-3 space-y-2 min-w-0">
            <div className="text-sm font-medium">{label}</div>
            <div className="flex flex-wrap gap-1.5">
              {draft[key].map((v) => (
                <span key={v} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-muted text-xs">
                  {v}
                  <button type="button" onClick={() => removeItem(key, v)} className="hover:text-destructive" aria-label={`ลบ ${v}`}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                value={inputs[key] || ""}
                onChange={(e) => setInputs({ ...inputs, [key]: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(key); } }}
                placeholder={`เพิ่ม${label}`}
                className="flex-1 min-w-0 px-2 py-1.5 text-sm rounded-lg border bg-muted/30 outline-none"
              />
              <button type="button" onClick={() => addItem(key)} className="px-2 py-1.5 rounded-lg border hover:bg-muted" aria-label={`เพิ่ม${label}`}>
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-60">
        <Save className="w-4 h-4" /> {saving ? "กำลังบันทึก..." : "บันทึกตัวเลือก"}
      </button>
    </div>
  );
};

export default EmployeeFieldOptionsSettings;
