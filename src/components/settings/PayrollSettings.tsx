import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { TAX_BRACKETS } from "@/utils/taxCalculation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { usePayrollConfig, savePayrollConfig, type PayrollConfig } from "@/utils/payrollConfig";

const otRateOptions = [
  { value: "1.0", label: "1.0 เท่า" },
  { value: "1.5", label: "1.5 เท่า" },
  { value: "2.0", label: "2.0 เท่า" },
  { value: "3.0", label: "3.0 เท่า" },
];

const payCycleOptions = [
  { value: "end", label: "สิ้นเดือน" },
  { value: "25", label: "ทุกวันที่ 25" },
  { value: "custom", label: "กำหนดเอง" },
];

interface PayrollTemplate {
  id: string;
  name: string;
  type: "income" | "deduction";
  defaultAmount: number;
}

const PayrollSettings = () => {
  const { toast } = useToast();
  const { config, loading, reload } = usePayrollConfig();
  const [saving, setSaving] = useState(false);

  // OT
  const [otWeekdayRate, setOtWeekdayRate] = useState("1.5");
  const [otHolidayRate, setOtHolidayRate] = useState("3.0");
  const [otPublicHolidayRate, setOtPublicHolidayRate] = useState("3.0");
  const [allowHolidayOT, setAllowHolidayOT] = useState(true);
  const [maxOTHours, setMaxOTHours] = useState("36");

  // Diligence
  const [diligenceEnabled, setDiligenceEnabled] = useState(true);
  const [diligenceAmount, setDiligenceAmount] = useState("2000");
  const [deductLate, setDeductLate] = useState(true);
  const [lateThreshold, setLateThreshold] = useState("3");
  const [deductAbsent, setDeductAbsent] = useState(true);
  const [absentThreshold, setAbsentThreshold] = useState("1");

  // SSF & Tax
  const [ssfEnabled, setSsfEnabled] = useState(true);
  const [ssfRate, setSsfRate] = useState("5");
  const [ssfCeiling, setSsfCeiling] = useState("750");
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxMethod, setTaxMethod] = useState<"progressive" | "flat">("progressive");
  const [flatRate, setFlatRate] = useState("5");

  // Shift & Pay Cycle
  const [shiftAfternoon, setShiftAfternoon] = useState("50");
  const [shiftNight, setShiftNight] = useState("100");
  const [payCycle, setPayCycle] = useState("end");
  const [customPayDay, setCustomPayDay] = useState("28");

  // Custom Payroll Item Templates
  const [templates, setTemplates] = useState<PayrollTemplate[]>([]);

  // Populate form when config loads
  useEffect(() => {
    if (loading) return;
    setOtWeekdayRate(String(config.otRateWorkday));
    setOtHolidayRate(String(config.otRateHoliday));
    setOtPublicHolidayRate(String(config.otRatePublicHoliday));
    setAllowHolidayOT(config.allowHolidayOT);
    setMaxOTHours(String(config.maxOTHours));
    setDiligenceEnabled(config.diligenceEnabled);
    setDiligenceAmount(String(config.diligenceAmount));
    setDeductLate(config.deductLate);
    setLateThreshold(String(config.lateThreshold));
    setDeductAbsent(config.deductAbsent);
    setAbsentThreshold(String(config.absentThreshold));
    setSsfEnabled(config.ssfEnabled);
    setSsfRate(String(config.ssfRate));
    setSsfCeiling(String(config.ssfCeiling));
    setTaxEnabled(config.taxConfig.enabled);
    setTaxMethod(config.taxConfig.method);
    setFlatRate(String(config.taxConfig.flatRate));
    setShiftAfternoon(String(config.shiftAllowanceAfternoon));
    setShiftNight(String(config.shiftAllowanceNight));
    setPayCycle(config.payCycle);
    setCustomPayDay(String(config.customPayDay));
    setTemplates(config.templates);
  }, [loading, config]);

  const addTemplate = (type: "income" | "deduction") => {
    setTemplates([...templates, { id: crypto.randomUUID(), name: "", type, defaultAmount: 0 }]);
  };

  const updateTemplate = (id: string, field: keyof PayrollTemplate, value: any) => {
    setTemplates(templates.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const removeTemplate = (id: string) => {
    setTemplates(templates.filter((t) => t.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    const payload: PayrollConfig = {
      otRateWorkday: Number(otWeekdayRate),
      otRateHoliday: Number(otHolidayRate),
      otRatePublicHoliday: Number(otPublicHolidayRate),
      allowHolidayOT,
      maxOTHours: Number(maxOTHours),
      diligenceEnabled,
      diligenceAmount: Number(diligenceAmount),
      deductLate,
      lateThreshold: Number(lateThreshold),
      deductAbsent,
      absentThreshold: Number(absentThreshold),
      ssfEnabled,
      ssfRate: Number(ssfRate),
      ssfCeiling: Number(ssfCeiling),
      taxConfig: { enabled: taxEnabled, method: taxMethod, flatRate: Number(flatRate) },
      shiftAllowanceAfternoon: Number(shiftAfternoon),
      shiftAllowanceNight: Number(shiftNight),
      payCycle,
      customPayDay: Number(customPayDay),
      templates,
    };
    const { error } = await savePayrollConfig(payload);
    setSaving(false);
    if (error) {
      toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
    } else {
      await reload();
      toast({ title: "บันทึกสำเร็จ", description: "การตั้งค่าเงินเดือนถูกอัปเดตแล้ว และมีผลกับการคำนวณทันที" });
    }
  };

  const inputClass = "w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/30 outline-none focus:ring-2 focus:ring-primary/30 transition-all";
  const selectClass = "w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/30 outline-none focus:ring-2 focus:ring-primary/30 transition-all cursor-pointer";

  const incomeTemplates = templates.filter((t) => t.type === "income");
  const deductionTemplates = templates.filter((t) => t.type === "deduction");

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">กำหนดค่าการคำนวณเงินเดือน ค่าล่วงเวลา ภาษี และสวัสดิการ</p>

      {/* ── OT Settings ── */}
      <div className="card-base p-5 space-y-4">
        <h4 className="font-semibold flex items-center gap-2">⏱ อัตราค่าล่วงเวลา (OT)</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">OT วันทำงาน</label>
            <select value={otWeekdayRate} onChange={(e) => setOtWeekdayRate(e.target.value)} className={selectClass}>
              {otRateOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">OT วันหยุด</label>
            <select value={otHolidayRate} onChange={(e) => setOtHolidayRate(e.target.value)} className={selectClass}>
              {otRateOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">OT วันหยุดนักขัตฤกษ์</label>
            <select value={otPublicHolidayRate} onChange={(e) => setOtPublicHolidayRate(e.target.value)} className={selectClass}>
              {otRateOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-3">
            <Switch checked={allowHolidayOT} onCheckedChange={setAllowHolidayOT} />
            <span className="text-sm">อนุญาตให้ทำ OT ในวันหยุด</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">OT สูงสุด/เดือน (ชม.)</label>
            <input type="number" value={maxOTHours} onChange={(e) => setMaxOTHours(e.target.value)} className={`${inputClass} w-20`} />
          </div>
        </div>
      </div>

      {/* ── Diligence ── */}
      <div className="card-base p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold flex items-center gap-2">🏆 เบี้ยขยัน</h4>
          <Switch checked={diligenceEnabled} onCheckedChange={setDiligenceEnabled} />
        </div>
        {diligenceEnabled && (
          <>
            <div className="space-y-1.5 max-w-xs">
              <label className="text-xs font-medium text-muted-foreground">จำนวนเงินเบี้ยขยัน (บาท/เดือน)</label>
              <input type="number" value={diligenceAmount} onChange={(e) => setDiligenceAmount(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">เงื่อนไขตัดเบี้ยขยัน</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Switch checked={deductLate} onCheckedChange={setDeductLate} />
                  <span className="text-sm min-w-[5rem]">มาสายเกิน</span>
                  <input type="number" value={lateThreshold} onChange={(e) => setLateThreshold(e.target.value)}
                    className={`${inputClass} flex-1 text-center`} disabled={!deductLate} />
                  <span className="text-sm text-muted-foreground">ครั้ง</span>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={deductAbsent} onCheckedChange={setDeductAbsent} />
                  <span className="text-sm min-w-[5rem]">ขาดงานเกิน</span>
                  <input type="number" value={absentThreshold} onChange={(e) => setAbsentThreshold(e.target.value)}
                    className={`${inputClass} flex-1 text-center`} disabled={!deductAbsent} />
                  <span className="text-sm text-muted-foreground">วัน</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── SSF & Tax ── */}
      <div className="card-base p-5 space-y-4">
        <h4 className="font-semibold flex items-center gap-2">💰 ประกันสังคม และภาษี</h4>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Switch checked={ssfEnabled} onCheckedChange={setSsfEnabled} />
            <span className="text-sm font-medium">หักประกันสังคม</span>
          </div>
          {ssfEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md pl-8">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">อัตรา (%)</label>
                <input type="number" value={ssfRate} onChange={(e) => setSsfRate(e.target.value)} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">เพดานสูงสุด (บาท/เดือน)</label>
                <input type="number" value={ssfCeiling} onChange={(e) => setSsfCeiling(e.target.value)} className={inputClass} />
              </div>
            </div>
          )}
        </div>
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center gap-3">
            <Switch checked={taxEnabled} onCheckedChange={setTaxEnabled} />
            <span className="text-sm font-medium">หักภาษี ณ ที่จ่าย</span>
          </div>
          {taxEnabled && (
            <div className="pl-8 space-y-4">
              <div className="space-y-1.5 max-w-xs">
                <label className="text-xs font-medium text-muted-foreground">วิธีคำนวณ</label>
                <select value={taxMethod} onChange={(e) => setTaxMethod(e.target.value as "progressive" | "flat")} className={selectClass}>
                  <option value="progressive">ขั้นบันได ตามกฎหมาย (Progressive)</option>
                  <option value="flat">คำนวณเอง (Flat Rate %)</option>
                </select>
              </div>
              {taxMethod === "flat" ? (
                <div className="space-y-1.5 max-w-xs">
                  <label className="text-xs font-medium text-muted-foreground">อัตราภาษี (%)</label>
                  <input type="number" value={flatRate} onChange={(e) => setFlatRate(e.target.value)} className={inputClass} />
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">ตารางอัตราภาษีขั้นบันได (ตามกฎหมายไทย)</p>
                  <div className="rounded-xl border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">รายได้สุทธิ (บาท/ปี)</TableHead>
                          <TableHead className="text-xs text-right">อัตรา</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {TAX_BRACKETS.map((b, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-sm">{b.label}</TableCell>
                            <TableCell className="text-sm text-right font-semibold">
                              {b.rate === 0 ? (
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary">ยกเว้น</span>
                              ) : (
                                `${b.rate}%`
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-muted-foreground">* ตารางนี้เป็นแบบอ่านอย่างเดียว อ้างอิงตามกฎหมายภาษีเงินได้บุคคลธรรมดา</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Custom Payroll Item Templates ── */}
      <div className="card-base p-5 space-y-4">
        <h4 className="font-semibold flex items-center gap-2">📋 รายการรายรับ/รายหักเพิ่มเติม (Template)</h4>
        <p className="text-xs text-muted-foreground">กำหนดรายการเริ่มต้นที่ใช้บ่อย สามารถนำไปใช้เมื่อเพิ่มรายการให้พนักงานได้สะดวก</p>

        {/* Income Templates */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">รายรับเพิ่มเติม</p>
          <div className="space-y-2">
            {incomeTemplates.map((t) => (
              <div key={t.id} className="flex items-center gap-2">
                <Input
                  placeholder="ชื่อรายการ"
                  value={t.name}
                  onChange={(e) => updateTemplate(t.id, "name", e.target.value)}
                  className="flex-1 h-9 text-sm"
                />
                <Input
                  type="number"
                  placeholder="จำนวนเงินเริ่มต้น"
                  value={t.defaultAmount || ""}
                  onChange={(e) => updateTemplate(t.id, "defaultAmount", Number(e.target.value))}
                  className="w-28 h-9 text-sm text-right"
                />
                <span className="text-xs text-muted-foreground">บาท</span>
                <button onClick={() => removeTemplate(t.id)} className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </div>
            ))}
            {incomeTemplates.length === 0 && <p className="text-xs text-muted-foreground py-1">ยังไม่มี Template รายรับเพิ่มเติม</p>}
          </div>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => addTemplate("income")}>
            <Plus className="w-3 h-3 mr-1" /> เพิ่ม Template รายรับ
          </Button>
        </div>

        {/* Deduction Templates */}
        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">รายการหักเพิ่มเติม</p>
          <div className="space-y-2">
            {deductionTemplates.map((t) => (
              <div key={t.id} className="flex items-center gap-2">
                <Input
                  placeholder="ชื่อรายการ"
                  value={t.name}
                  onChange={(e) => updateTemplate(t.id, "name", e.target.value)}
                  className="flex-1 h-9 text-sm"
                />
                <Input
                  type="number"
                  placeholder="จำนวนเงินเริ่มต้น"
                  value={t.defaultAmount || ""}
                  onChange={(e) => updateTemplate(t.id, "defaultAmount", Number(e.target.value))}
                  className="w-28 h-9 text-sm text-right"
                />
                <span className="text-xs text-muted-foreground">บาท</span>
                <button onClick={() => removeTemplate(t.id)} className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </div>
            ))}
            {deductionTemplates.length === 0 && <p className="text-xs text-muted-foreground py-1">ยังไม่มี Template รายการหัก</p>}
          </div>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => addTemplate("deduction")}>
            <Plus className="w-3 h-3 mr-1" /> เพิ่ม Template รายการหัก
          </Button>
        </div>
      </div>

      {/* ── Shift & Pay Cycle ── */}
      <div className="card-base p-5 space-y-4">
        <h4 className="font-semibold flex items-center gap-2">🔄 ค่ากะ และรอบจ่ายเงิน</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">ค่ากะบ่าย (บาท/วัน)</label>
            <input type="number" value={shiftAfternoon} onChange={(e) => setShiftAfternoon(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">ค่ากะดึก (บาท/วัน)</label>
            <input type="number" value={shiftNight} onChange={(e) => setShiftNight(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">รอบจ่ายเงินเดือน</label>
            <select value={payCycle} onChange={(e) => setPayCycle(e.target.value)} className={selectClass}>
              {payCycleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        {payCycle === "custom" && (
          <div className="space-y-1.5 max-w-xs">
            <label className="text-xs font-medium text-muted-foreground">วันที่จ่ายเงินเดือน</label>
            <input type="number" min="1" max="31" value={customPayDay} onChange={(e) => setCustomPayDay(e.target.value)} className={inputClass} />
          </div>
        )}
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving || loading}
        className="px-6 py-2.5 rounded-xl text-sm font-bold text-primary-foreground disabled:opacity-50 flex items-center gap-2"
        style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        บันทึกการตั้งค่า
      </button>
    </div>
  );
};

export default PayrollSettings;
