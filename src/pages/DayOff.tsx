import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, CalendarDays, Users, Settings2, Loader2, Plus, Trash2, Save, Copy, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmployees } from "@/contexts/EmployeeContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import SearchableSelect from "@/components/ui/searchable-select";
import { ThaiDatePicker } from "@/components/ui/thai-date-picker";
import EmployeeAvatar from "@/components/ui/employee-avatar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

interface Pattern {
  id: string;
  employee_id: string;
  weekdays: number[];
  effective_from: string;
  effective_to: string | null;
  note: string;
}

interface Override {
  id: string;
  employee_id: string;
  date: string;
  is_dayoff: boolean;
  reason: string;
}

interface CompanyHoliday { id: string; date: string; name: string; }

const WEEKDAY_LABELS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const WEEKDAY_FULL = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

function getMonthDays(year: number, month: number): Date[] {
  const out: Date[] = [];
  const days = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= days; i++) out.push(new Date(year, month, i));
  return out;
}

function isPatternActive(p: Pattern, dateIso: string): boolean {
  if (p.effective_from && dateIso < p.effective_from) return false;
  if (p.effective_to && dateIso > p.effective_to) return false;
  return true;
}

function computeDayoffStatus(empId: string, dateIso: string, dow: number, patterns: Pattern[], overrides: Override[], holidays: Set<string>): "work" | "pattern" | "extra" | "company" {
  const ov = overrides.find((o) => o.employee_id === empId && o.date === dateIso);
  if (ov) {
    if (ov.is_dayoff) return "extra";
    return "work";
  }
  if (holidays.has(dateIso)) return "company";
  const matched = patterns.some((p) => p.employee_id === empId && isPatternActive(p, dateIso) && p.weekdays.includes(dow));
  return matched ? "pattern" : "work";
}

const DayOff = () => {
  const { toast } = useToast();
  const { employees: allEmployees } = useEmployees();
  const employees = useMemo(() => allEmployees.filter((e: any) => (e.role || "").toLowerCase() !== "admin"), [allEmployees]);
  const { user, role, currentUser } = useAuth();
  const isEmployeeRole = role.toLowerCase() === "employee";
  const employeeId = currentUser?.employeeId || null;
  const { canAction } = usePermissions();
  const [params] = useSearchParams();

  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [holidays, setHolidays] = useState<CompanyHoliday[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");

  const canEdit = canAction(role, "day_off", "edit");

  // Tab state
  const initialEmp = params.get("employee") || "";
  const [activeTab, setActiveTab] = useState(initialEmp ? "employee" : "calendar");
  const [selectedEmpId, setSelectedEmpId] = useState<string>(initialEmp);

  // Auto-select self for employee role
  useEffect(() => {
    if (isEmployeeRole && employeeId) {
      setSelectedEmpId(employeeId);
    }
  }, [isEmployeeRole, employeeId]);

  const fetchAll = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    const [pr, or, hr] = await Promise.all([
      supabase.from("employee_dayoff_patterns").select("*"),
      supabase.from("employee_dayoff_overrides").select("*"),
      supabase.from("company_holidays").select("*"),
    ]);
    setPatterns((pr.data as Pattern[]) || []);
    setOverrides((or.data as Override[]) || []);
    setHolidays((hr.data as CompanyHoliday[]) || []);
    if (showLoading) setLoading(false);
  };

  useEffect(() => { fetchAll(true); }, []);

  // Realtime
  useEffect(() => {
    const refetch = () => { fetchAll(false); };
    const channel = supabase
      .channel("dayoff-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_dayoff_overrides" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_dayoff_patterns" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "company_holidays" }, refetch)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const holidaySet = useMemo(() => new Set(holidays.map((h) => h.date)), [holidays]);

  const monthDays = useMemo(() => getMonthDays(year, month), [year, month]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => e.dept && set.add(e.dept));
    return Array.from(set).sort();
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (e.status !== "active") return false;
      if (deptFilter !== "all" && e.dept !== deptFilter) return false;
      if (search && !`${e.firstName}${e.lastName}${e.nickname}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [employees, deptFilter, search]);

  const monthLabel = useMemo(() => {
    const months = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
    return `${months[month]} ${year + 543}`;
  }, [year, month]);

  const navMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const toggleOverride = async (empId: string, dateIso: string, currentStatus: string) => {
    if (!canEdit) return;
    const existing = overrides.find((o) => o.employee_id === empId && o.date === dateIso);
    // Cycle: work -> dayoff -> remove override
    try {
      if (existing) {
        // remove
        await supabase.from("employee_dayoff_overrides").delete().eq("id", existing.id);
      } else {
        // add: invert from current (work->dayoff, pattern/company->work)
        const newVal = currentStatus === "work";
        await supabase.from("employee_dayoff_overrides").insert({
          employee_id: empId,
          date: dateIso,
          is_dayoff: newVal,
          reason: "ปรับวันหยุดจากปฏิทิน",
          created_by: user?.id,
        });
      }
      // realtime will refetch
    } catch (err: any) {
      toast({ title: "ไม่สามารถบันทึกได้", description: err.message, variant: "destructive" });
    }
  };

  const cellColor = (status: string) => {
    switch (status) {
      case "work": return { bg: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", label: "✓" };
      case "pattern": return { bg: "hsl(0 70% 90%)", color: "hsl(0 70% 35%)", label: "●" };
      case "extra": return { bg: "hsl(31 90% 88%)", color: "hsl(31 90% 35%)", label: "+" };
      case "company": return { bg: "hsl(220 80% 90%)", color: "hsl(220 80% 35%)", label: "★" };
      default: return { bg: "transparent", color: "inherit", label: "" };
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold font-display">จัดการวันหยุดพนักงาน</h2>
        <p className="text-sm text-muted-foreground mt-0.5">จัดการวันหยุดส่วนบุคคลแบบยืดหยุ่น · รองรับการเปลี่ยนรายสัปดาห์</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="calendar"><CalendarDays className="w-4 h-4 mr-1.5" />ปฏิทินรายเดือน</TabsTrigger>
          <TabsTrigger value="employee"><Users className="w-4 h-4 mr-1.5" />รายพนักงาน</TabsTrigger>
          <TabsTrigger value="bulk"><Settings2 className="w-4 h-4 mr-1.5" />จัดการแบบกลุ่ม</TabsTrigger>
        </TabsList>

        {/* ============ TAB 1: Calendar ============ */}
        <TabsContent value="calendar" className="space-y-4">
          <div className="card-base p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button onClick={() => navMonth(-1)} className="p-2 rounded-xl hover:bg-muted"><ChevronLeft className="w-4 h-4" /></button>
                <h3 className="text-lg font-bold font-display min-w-[180px] text-center">{monthLabel}</h3>
                <button onClick={() => navMonth(1)} className="p-2 rounded-xl hover:bg-muted"><ChevronRight className="w-4 h-4" /></button>
                <button onClick={() => { const t = new Date(); setYear(t.getFullYear()); setMonth(t.getMonth()); }}
                  className="ml-2 px-3 py-1.5 rounded-xl text-xs font-semibold border bg-muted/30 hover:bg-muted">วันนี้</button>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาชื่อ"
                    className="pl-8 pr-3 py-2 text-sm rounded-xl border outline-none bg-muted/30 w-44" />
                </div>
                <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
                  className="px-3 py-2 text-sm rounded-xl border outline-none bg-muted/30">
                  <option value="all">ทุกแผนก</option>
                  {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded" style={{background:"hsl(var(--muted))"}} />ทำงาน</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded" style={{background:"hsl(0 70% 90%)"}} />หยุดประจำ</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded" style={{background:"hsl(31 90% 88%)"}} />หยุดเพิ่ม</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded" style={{background:"hsl(220 80% 90%)"}} />วันหยุดบริษัท</span>
              {canEdit && <span className="text-muted-foreground">· คลิกเซลล์เพื่อสลับสถานะ</span>}
            </div>
          </div>

          <div className="card-base overflow-auto max-h-[calc(100vh-260px)]">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 px-3 py-2 text-left font-semibold border-b border-r min-w-[180px] z-30" style={{borderColor:"hsl(var(--border))", background:"hsl(var(--card))"}}>พนักงาน</th>
                  {monthDays.map((d) => {
                    const dow = d.getDay();
                    const isWeekend = dow === 0 || dow === 6;
                    const iso = isoDate(d);
                    const isHoliday = holidaySet.has(iso);
                    return (
                      <th key={iso} className="sticky top-0 z-20 px-1 py-1 text-center font-semibold border-b min-w-[28px]" style={{
                        borderColor: "hsl(var(--border))",
                        background: isHoliday ? "hsl(220 80% 95%)" : (isWeekend ? "hsl(0 0% 96%)" : "hsl(var(--muted) / 0.5)"),
                        color: isHoliday ? "hsl(220 80% 35%)" : undefined,
                      }}>
                        <div className="text-[9px] opacity-60">{WEEKDAY_LABELS[dow]}</div>
                        <div>{d.getDate()}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-muted/20">
                    <td className="sticky left-0 bg-card px-3 py-2 border-b border-r" style={{borderColor:"hsl(var(--border))"}}>
                      <div className="flex items-center gap-2">
                        <EmployeeAvatar photoUrl={emp.photoUrl} avatar={emp.avatar} avatarColor={emp.avatarColor} avatarTextColor={emp.avatarTextColor} firstName={emp.firstName} size="sm" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{emp.prefix}{emp.firstName} {emp.lastName}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{emp.dept}</p>
                        </div>
                      </div>
                    </td>
                    {monthDays.map((d) => {
                      const iso = isoDate(d);
                      const dow = d.getDay();
                      const status = computeDayoffStatus(emp.id, iso, dow, patterns, overrides, holidaySet);
                      const c = cellColor(status);
                      const hasOverride = overrides.some((o) => o.employee_id === emp.id && o.date === iso);
                      const ov = overrides.find((o) => o.employee_id === emp.id && o.date === iso);
                      const holidayName = holidays.find((h) => h.date === iso)?.name;
                      const statusLabel = status === "work" ? "ทำงาน" : status === "pattern" ? "หยุดประจำ" : status === "extra" ? "หยุดเพิ่ม" : "วันหยุดบริษัท";
                      const statusDot = status === "work" ? "hsl(var(--muted-foreground))" : status === "pattern" ? "hsl(0 70% 50%)" : status === "extra" ? "hsl(31 90% 50%)" : "hsl(220 80% 55%)";
                      return (
                        <td key={iso} className="p-0.5 text-center border-b" style={{borderColor:"hsl(var(--border))"}}>
                          <HoverCard openDelay={120} closeDelay={60}>
                            <HoverCardTrigger asChild>
                              <button
                                disabled={!canEdit}
                                onClick={() => toggleOverride(emp.id, iso, status)}
                                className={`w-full h-7 rounded text-[11px] font-bold transition-all ${canEdit ? "hover:scale-110 cursor-pointer" : "cursor-default"} ${hasOverride ? "ring-1 ring-offset-1 ring-orange-400" : ""}`}
                                style={{ background: c.bg, color: c.color }}
                              >
                                {c.label}
                              </button>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-64 p-3" align="center" side="top">
                              <div className="text-[11px] text-muted-foreground border-b pb-1.5 mb-2">
                                {d.getDate()}/{month + 1}/{year + 543} · {emp.prefix}{emp.firstName} {emp.lastName}
                              </div>
                              <div className="space-y-1.5 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: statusDot }} />
                                  <span className="font-semibold flex-1">{statusLabel}</span>
                                  <span className="text-muted-foreground">{WEEKDAY_FULL[dow]}</span>
                                </div>
                                {status === "company" && holidayName && (
                                  <div className="text-muted-foreground pl-4">{holidayName}</div>
                                )}
                                {ov?.reason && (
                                  <div className="text-muted-foreground pl-4">เหตุผล: {ov.reason}</div>
                                )}
                                {canEdit && (
                                  <div className="text-[10px] text-muted-foreground pt-1.5 border-t mt-2">
                                    คลิกเพื่อ{status === "work" ? "ตั้งเป็นวันหยุด" : "เปลี่ยนสถานะ"}
                                  </div>
                                )}
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {filteredEmployees.length === 0 && (
                  <tr><td colSpan={monthDays.length + 1} className="px-4 py-12 text-center text-muted-foreground">ไม่พบพนักงาน</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ============ TAB 2: Per-employee ============ */}
        <TabsContent value="employee" className="space-y-4">
          <EmployeeDetailView
            employees={employees}
            patterns={patterns}
            overrides={overrides}
            selectedEmpId={selectedEmpId}
            setSelectedEmpId={setSelectedEmpId}
            canEdit={canEdit}
            userId={user?.id}
            lockEmployee={isEmployeeRole}
            onChanged={fetchAll}
          />
        </TabsContent>

        {/* ============ TAB 3: Bulk ============ */}
        <TabsContent value="bulk" className="space-y-4">
          <BulkActionsView employees={employees} patterns={patterns} canEdit={canEdit} userId={user?.id} onChanged={fetchAll} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// =================== Employee Detail View ===================
const EmployeeDetailView = ({ employees, patterns, overrides, selectedEmpId, setSelectedEmpId, canEdit, userId, onChanged, lockEmployee }: any) => {
  const { toast } = useToast();
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [effFrom, setEffFrom] = useState("");
  const [effTo, setEffTo] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const empOptions = employees
    .filter((e: any) => e.status === "active")
    .map((e: any) => ({ value: e.id, label: `${e.prefix}${e.firstName} ${e.lastName}${e.nickname ? ` (${e.nickname})` : ""}`, subtitle: e.dept }));

  const empPatterns = patterns.filter((p: Pattern) => p.employee_id === selectedEmpId);
  const empOverrides = overrides.filter((o: Override) => o.employee_id === selectedEmpId).sort((a: Override, b: Override) => b.date.localeCompare(a.date));

  const togglePatternDay = (d: number) => {
    setWeekdays((cur) => cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort());
  };

  const savePattern = async () => {
    if (!selectedEmpId || weekdays.length === 0 || !effFrom) {
      toast({ title: "กรุณาเลือกวันในสัปดาห์และวันที่เริ่มมีผล", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("employee_dayoff_patterns").insert({
      employee_id: selectedEmpId,
      weekdays,
      effective_from: effFrom,
      effective_to: effTo || null,
      note,
      created_by: userId,
    });
    setSaving(false);
    if (error) toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
    else {
      toast({ title: "บันทึก pattern สำเร็จ" });
      setWeekdays([]); setEffFrom(""); setEffTo(""); setNote("");
      onChanged();
    }
  };

  const deletePattern = async (id: string) => {
    const { error } = await supabase.from("employee_dayoff_patterns").delete().eq("id", id);
    if (error) toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
    else { toast({ title: "ลบ pattern สำเร็จ" }); onChanged(); }
  };

  const deleteOverride = async (id: string) => {
    const { error } = await supabase.from("employee_dayoff_overrides").delete().eq("id", id);
    if (error) toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
    else { toast({ title: "ลบรายการสำเร็จ" }); onChanged(); }
  };

  const fmtDate = (iso: string) => {
    if (!iso) return "-";
    const [y,m,d] = iso.split("-");
    return `${parseInt(d)}/${parseInt(m)}/${parseInt(y)+543}`;
  };

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      {/* Left: select + form */}
      <div className="lg:col-span-1 space-y-4">
        <div className="card-base p-4 space-y-3">
          <label className="block text-sm font-semibold">เลือกพนักงาน</label>
          <SearchableSelect value={selectedEmpId} onChange={setSelectedEmpId} options={empOptions} placeholder="-- เลือก --" disabled={lockEmployee} />
        </div>

        {selectedEmpId && canEdit && (
          <div className="card-base p-4 space-y-3">
            <h4 className="font-bold text-sm flex items-center gap-2"><Plus className="w-4 h-4" />เพิ่ม Pattern ใหม่</h4>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">วันในสัปดาห์ที่หยุด</label>
              <div className="flex gap-1 flex-wrap">
                {WEEKDAY_LABELS.map((lbl, i) => (
                  <button key={i} onClick={() => togglePatternDay(i)}
                    className="w-9 h-9 rounded-lg text-xs font-bold transition-all"
                    style={{
                      background: weekdays.includes(i) ? "hsl(var(--primary))" : "hsl(var(--muted))",
                      color: weekdays.includes(i) ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
                    }}>{lbl}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">เริ่มมีผล</label>
              <ThaiDatePicker value={effFrom} onChange={setEffFrom} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">สิ้นสุด (ว่าง = ไม่มีกำหนด)</label>
              <ThaiDatePicker value={effTo} onChange={setEffTo} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">หมายเหตุ</label>
              <input value={note} onChange={(e)=>setNote(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border outline-none bg-muted/30" />
            </div>
            <button onClick={savePattern} disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-primary-foreground disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))" }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              บันทึก Pattern
            </button>
          </div>
        )}
      </div>

      {/* Right: lists */}
      <div className="lg:col-span-2 space-y-4">
        {!selectedEmpId ? (
          <div className="card-base p-12 text-center text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
            เลือกพนักงานเพื่อดูรายละเอียด
          </div>
        ) : (
          <>
            <div className="card-base p-4">
              <h4 className="font-bold text-sm mb-3">Pattern ปัจจุบัน ({empPatterns.length})</h4>
              {empPatterns.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">ยังไม่มี pattern · ใช้ตามวันทำงานปกติ</p>
              ) : (
                <div className="space-y-2">
                  {empPatterns.map((p: Pattern) => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border" style={{borderColor:"hsl(var(--border))"}}>
                      <div>
                        <div className="flex gap-1 mb-1">
                          {p.weekdays.map((w) => (
                            <span key={w} className="px-2 py-0.5 rounded-md text-[10px] font-bold" style={{background:"hsl(0 70% 90%)", color:"hsl(0 70% 35%)"}}>{WEEKDAY_LABELS[w]}</span>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">{fmtDate(p.effective_from)} → {p.effective_to ? fmtDate(p.effective_to) : "ไม่มีกำหนด"}{p.note && ` · ${p.note}`}</p>
                      </div>
                      {canEdit && (
                        <button onClick={() => deletePattern(p.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card-base p-4">
              <h4 className="font-bold text-sm mb-3">รายการปรับเฉพาะวัน ({empOverrides.length})</h4>
              {empOverrides.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">ยังไม่มีรายการ · เพิ่มได้จากปฏิทินรายเดือน</p>
              ) : (
                <div className="space-y-1.5 max-h-96 overflow-y-auto">
                  {empOverrides.map((o: Override) => (
                    <div key={o.id} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 text-sm">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">{fmtDate(o.date)}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-md font-bold`} style={{
                          background: o.is_dayoff ? "hsl(31 90% 88%)" : "hsl(var(--muted))",
                          color: o.is_dayoff ? "hsl(31 90% 35%)" : "hsl(var(--muted-foreground))",
                        }}>{o.is_dayoff ? "หยุด" : "ทำงาน"}</span>
                        {o.reason && <span className="text-xs text-muted-foreground truncate">{o.reason}</span>}
                      </div>
                      {canEdit && (
                        <button onClick={() => deleteOverride(o.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// =================== Bulk Actions View ===================
const BulkActionsView = ({ employees, patterns, canEdit, userId, onChanged }: any) => {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [bulkWeekdays, setBulkWeekdays] = useState<number[]>([]);
  const [bulkFrom, setBulkFrom] = useState("");
  const [bulkTo, setBulkTo] = useState("");
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayReason, setHolidayReason] = useState("");
  const [copyFromId, setCopyFromId] = useState("");
  const [busy, setBusy] = useState(false);

  const activeEmps = employees.filter((e: any) => e.status === "active");
  const filtered = activeEmps.filter((e: any) =>
    !search || `${e.firstName}${e.lastName}${e.nickname}`.toLowerCase().includes(search.toLowerCase())
  );

  const toggleId = (id: string) => {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(filtered.map((e: any) => e.id)));
  const clearAll = () => setSelectedIds(new Set());

  const toggleBulkDay = (d: number) => {
    setBulkWeekdays((cur) => cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort());
  };

  const applyPattern = async () => {
    if (selectedIds.size === 0 || bulkWeekdays.length === 0 || !bulkFrom) {
      toast({ title: "กรุณาเลือกพนักงาน, วันในสัปดาห์ และวันที่เริ่ม", variant: "destructive" });
      return;
    }
    setBusy(true);
    const rows = Array.from(selectedIds).map((empId) => ({
      employee_id: empId, weekdays: bulkWeekdays,
      effective_from: bulkFrom, effective_to: bulkTo || null,
      note: "ตั้งค่าแบบกลุ่ม", created_by: userId,
    }));
    const { error } = await supabase.from("employee_dayoff_patterns").insert(rows);
    setBusy(false);
    if (error) toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
    else {
      toast({ title: `ตั้ง pattern สำเร็จ ${rows.length} คน` });
      setBulkWeekdays([]); setBulkFrom(""); setBulkTo("");
      onChanged();
    }
  };

  const announceHoliday = async () => {
    if (selectedIds.size === 0 || !holidayDate) {
      toast({ title: "กรุณาเลือกพนักงานและวันที่", variant: "destructive" });
      return;
    }
    setBusy(true);
    const rows = Array.from(selectedIds).map((empId) => ({
      employee_id: empId, date: holidayDate, is_dayoff: true,
      reason: holidayReason || "ประกาศวันหยุดร่วม", created_by: userId,
    }));
    // upsert by unique(employee_id,date)
    const { error } = await supabase.from("employee_dayoff_overrides").upsert(rows, { onConflict: "employee_id,date" });
    setBusy(false);
    if (error) toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
    else {
      toast({ title: `ประกาศวันหยุดสำเร็จ ${rows.length} คน` });
      setHolidayDate(""); setHolidayReason("");
      onChanged();
    }
  };

  const copyPattern = async () => {
    if (!copyFromId || selectedIds.size === 0) {
      toast({ title: "กรุณาเลือกต้นแบบและพนักงานปลายทาง", variant: "destructive" });
      return;
    }
    const sourcePatterns = patterns.filter((p: Pattern) => p.employee_id === copyFromId);
    if (sourcePatterns.length === 0) {
      toast({ title: "ต้นแบบยังไม่มี pattern", variant: "destructive" });
      return;
    }
    setBusy(true);
    const rows: any[] = [];
    Array.from(selectedIds).forEach((empId) => {
      if (empId === copyFromId) return;
      sourcePatterns.forEach((p: Pattern) => {
        rows.push({
          employee_id: empId, weekdays: p.weekdays,
          effective_from: p.effective_from, effective_to: p.effective_to,
          note: `คัดลอกจาก pattern`, created_by: userId,
        });
      });
    });
    if (rows.length === 0) {
      setBusy(false); return;
    }
    const { error } = await supabase.from("employee_dayoff_patterns").insert(rows);
    setBusy(false);
    if (error) toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
    else {
      toast({ title: `คัดลอก pattern สำเร็จ ${rows.length} รายการ` });
      onChanged();
    }
  };

  if (!canEdit) {
    return <div className="card-base p-12 text-center text-muted-foreground">คุณไม่มีสิทธิ์ใช้งานเครื่องมือกลุ่ม</div>;
  }

  const empOptions = activeEmps.map((e: any) => ({ value: e.id, label: `${e.prefix}${e.firstName} ${e.lastName}`, subtitle: e.dept }));

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      {/* LEFT: Employee list */}
      <div className="card-base p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="font-bold text-sm">เลือกพนักงาน ({selectedIds.size})</h4>
          <div className="flex gap-1 text-xs">
            <button onClick={selectAll} className="px-2 py-1 rounded-md hover:bg-muted">เลือกหมด</button>
            <button onClick={clearAll} className="px-2 py-1 rounded-md hover:bg-muted">ล้าง</button>
          </div>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา"
            className="pl-8 pr-3 py-2 text-sm rounded-xl border outline-none bg-muted/30 w-full" />
        </div>
        <div className="max-h-96 overflow-y-auto space-y-1">
          {filtered.map((emp: any) => (
            <label key={emp.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted cursor-pointer">
              <input type="checkbox" checked={selectedIds.has(emp.id)} onChange={() => toggleId(emp.id)}
                className="w-4 h-4 rounded accent-[#FF870F]" />
              <EmployeeAvatar photoUrl={emp.photoUrl} avatar={emp.avatar} avatarColor={emp.avatarColor} avatarTextColor={emp.avatarTextColor} firstName={emp.firstName} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate">{emp.prefix}{emp.firstName} {emp.lastName}</p>
                <p className="text-[10px] text-muted-foreground truncate">{emp.dept}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* RIGHT: Actions */}
      <div className="lg:col-span-2 space-y-4">
        {/* Action 1: bulk pattern */}
        <div className="card-base p-4 space-y-3">
          <h4 className="font-bold text-sm">① ตั้ง Pattern เดียวกันให้หลายคน</h4>
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">วันในสัปดาห์ที่หยุด</label>
            <div className="flex gap-1 flex-wrap">
              {WEEKDAY_LABELS.map((lbl, i) => (
                <button key={i} onClick={() => toggleBulkDay(i)}
                  className="w-9 h-9 rounded-lg text-xs font-bold"
                  style={{
                    background: bulkWeekdays.includes(i) ? "hsl(var(--primary))" : "hsl(var(--muted))",
                    color: bulkWeekdays.includes(i) ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
                  }}>{lbl}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">เริ่ม</label>
              <ThaiDatePicker value={bulkFrom} onChange={setBulkFrom} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">สิ้นสุด (ว่างได้)</label>
              <ThaiDatePicker value={bulkTo} onChange={setBulkTo} />
            </div>
          </div>
          <button onClick={applyPattern} disabled={busy}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-bold text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))" }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            ตั้ง Pattern ให้ {selectedIds.size} คน
          </button>
        </div>

        {/* Action 2: announce holiday */}
        <div className="card-base p-4 space-y-3">
          <h4 className="font-bold text-sm">② ประกาศวันหยุดร่วม (รายวัน)</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">วันที่</label>
              <ThaiDatePicker value={holidayDate} onChange={setHolidayDate} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">เหตุผล</label>
              <input value={holidayReason} onChange={(e) => setHolidayReason(e.target.value)}
                placeholder="เช่น วันหยุดบริษัทพิเศษ"
                className="w-full px-3 py-2 text-sm rounded-xl border outline-none bg-muted/30" />
            </div>
          </div>
          <button onClick={announceHoliday} disabled={busy}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-bold text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))" }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />}
            ประกาศวันหยุดให้ {selectedIds.size} คน
          </button>
        </div>

        {/* Action 3: copy pattern */}
        <div className="card-base p-4 space-y-3">
          <h4 className="font-bold text-sm">③ คัดลอก Pattern จากต้นแบบ</h4>
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">เลือกต้นแบบ</label>
            <SearchableSelect value={copyFromId} onChange={setCopyFromId} options={empOptions} placeholder="-- เลือกพนักงานต้นแบบ --" />
          </div>
          <p className="text-xs text-muted-foreground">จะคัดลอก pattern ทั้งหมดของต้นแบบไปยังพนักงานที่เลือก ({selectedIds.size} คน)</p>
          <button onClick={copyPattern} disabled={busy}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-bold text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))" }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
            คัดลอก
          </button>
        </div>
      </div>
    </div>
  );
};

export default DayOff;
