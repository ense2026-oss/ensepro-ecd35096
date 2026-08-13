import { useState, useEffect } from "react";
import { Save, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import TimeInput24 from "@/components/ui/time-input-24";

const KEY = "attendance_config";
const DEFAULTS = { lateGraceMinutes: 30, defaultShiftStart: "08:00" };

const AttendanceRuleSettings = () => {
  const { toast } = useToast();
  const [grace, setGrace] = useState(DEFAULTS.lateGraceMinutes);
  const [defaultStart, setDefaultStart] = useState(DEFAULTS.defaultShiftStart);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("company_settings").select("value").eq("key", KEY).maybeSingle();
      const v = (data?.value || {}) as Record<string, unknown>;
      setGrace(Number(v.lateGraceMinutes ?? DEFAULTS.lateGraceMinutes));
      setDefaultStart(String(v.defaultShiftStart || DEFAULTS.defaultShiftStart));
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const value = { lateGraceMinutes: Number(grace) || 0, defaultShiftStart: defaultStart };
    const { data: existing } = await supabase.from("company_settings").select("id").eq("key", KEY).maybeSingle();
    const { error } = existing
      ? await supabase.from("company_settings").update({ value, updated_at: new Date().toISOString() }).eq("key", KEY)
      : await supabase.from("company_settings").insert([{ key: KEY, value }]);
    setSaving(false);
    if (error) {
      toast({ title: "บันทึกไม่สำเร็จ", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "บันทึกกติกาการมาสายแล้ว" });
  };

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <div>
          <h3 className="text-sm font-semibold">กติกาการมาสาย</h3>
          <p className="text-xs text-muted-foreground">คำนวณจากเวลาเริ่มกะของพนักงานแต่ละคน + เวลาผ่อนผัน</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">เวลาผ่อนผัน (นาที)</label>
          <input
            type="number"
            min={0}
            max={240}
            value={grace}
            onChange={(e) => setGrace(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm rounded-lg border bg-muted/30 outline-none"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">เวลาเริ่มงานเริ่มต้น (กรณีไม่พบกะ)</label>
          <TimeInput24 value={defaultStart} onChange={setDefaultStart} />
        </div>
      </div>
      <button onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-60">
        <Save className="w-4 h-4" /> {saving ? "กำลังบันทึก..." : "บันทึกกติกา"}
      </button>
    </div>
  );
};

export default AttendanceRuleSettings;
