import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Users, Settings2, Loader2, Plus, Trash2, Save, Copy, Search, Clock, X } from "lucide-react";
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
import { cn } from "@/lib/utils";

interface OTEntry {
  id: string;
  employee_id: string;
  date: string;
  hours: number;
  ot_type: string;
  start_time: string;
  end_time: string;
  status: string;
}

interface Pattern { id: string; employee_id: string; weekdays: number[]; effective_from: string; effective_to: string | null; }
interface Override { id: string; employee_id: string; date: string; is_dayoff: boolean; }
interface CompanyHoliday { id: string; date: string; name: string; }
interface Shift { id: string; name: string; start_time: string; end_time: string; color: string; }
interface ShiftAssignment { id: string; employee_id: string; shift_id: string; start_date: string; end_date: string; assignment_type: string; }

const WEEKDAY_LABELS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const WEEKDAY_FULL = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const MONTHS_FULL = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

const OT_TYPES: { value: string; label: string; color: string }[] = [
  { value: "workday", label: "วันทำงาน", color: "#2563EB" },
  { value: "holiday", label: "วันหยุด", color: "#EA580C" },
  { value: "special", label: "นักขัตฤกษ์", color: "#7C3AED" },
];
const otTypeInfo = (t: string) => OT_TYPES.find((o) => o.value === t) || OT_TYPES[0];

const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const getMonthDays = (year: number, month: number): Date[] => {
  const out: Date[] = [];
  const days = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= days; i++) out.push(new Date(year, month, i));
  return out;
};

const isPatternActive = (p: Pattern, dateIso: string): boolean => {
  if (p.effective_from && dateIso < p.effective_from) return false;
  if (p.effective_to && dateIso > p.effective_to) return false;
  return true;
};

const isDayoffOn = (empId: string, dateIso: string, dow: number, patterns: Pattern[], overrides: Override[], holidays: Set<string>): boolean => {
  const ov = overrides.find((o) => o.employee_id === empId && o.date === dateIso);
  if (ov) return ov.is_dayoff;
  if (holidays.has(dateIso)) return true;
  return patterns.some((p) => p.employee_id === empId && isPatternActive(p, dateIso) && p.weekdays.includes(dow));
};

// Returns the shift assigned to an employee on a date (day override > bulk)
const getShiftIdFor = (empId: string, dateIso: string, assignments: ShiftAssignment[]): string | null => {
  const day = assignments.find((a) => a.assignment_type === "day" && a.employee_id === empId && a.start_date === dateIso);
  if (day) return day.shift_id;
  const bulk = assignments.find((a) => a.assignment_type !== "day" && a.employee_id === empId && a.start_date <= dateIso && a.end_date >= dateIso);
  return bulk ? bulk.shift_id : null;
};

const fmtThaiDate = (iso: string) => {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${parseInt(d)}/${parseInt(m)}/${parseInt(y) + 543}`;
};

const fmtHours = (h: number) => (Number.isInteger(h) ? `${h}` : h.toFixed(1));

const OvertimeManagement = () => {
  const { toast } = useToast();
  const { employees: allEmployees } = useEmployees();
  const employees = useMemo(() => allEmployees.filter((e: any) => (e.role || "").toLowerCase() !== "admin"), [allEmployees]);
  const { user, role, currentUser } = useAuth();
  const isEmployeeRole = role.toLowerCase() === "employee";
  const employeeId = currentUser?.employeeId || null;
  const { canAction } = usePermissions();

  const [entries, setEntries] = useState<OTEntry[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [holidays, setHolidays] = useState<CompanyHoliday[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("calendar");
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");

  useEffect(() => {
    if (isEmployeeRole && employeeId) setSelectedEmpId(employeeId);
  }, [isEmployeeRole, employeeId]);

  const canEdit = canAction(role, "ot_management", "edit");
  const managerName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "ผู้ดูแลระบบ";

  const fetchAll = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    const [ot, pr, or, hol, sh, asn] = await Promise.all([
      supabase.from("overtime_requests").select("id, employee_id, date, hours, ot_type, start_time, end_time, status").eq("status", "approved"),
      supabase.from("employee_dayoff_patterns").select("*"),
      supabase.from("employee_dayoff_overrides").select("*"),
      supabase.from("company_holidays").select("*"),
      supabase.from("shifts").select("*").order("sort_order"),
      supabase.from("shift_assignments").select("*"),
    ]);
    setEntries((ot.data as OTEntry[]) || []);
    setPatterns((pr.data as Pattern[]) || []);
    setOverrides((or.data as Override[]) || []);
    setHolidays((hol.data as CompanyHoliday[]) || []);
    setShifts((sh.data as Shift[]) || []);
    setAssignments((asn.data as ShiftAssignment[]) || []);
    if (showLoading) setLoading(false);
  };

  useEffect(() => { fetchAll(true); }, []);

  useEffect(() => {
    const refetch = () => { fetchAll(false); };
    const channel = supabase
      .channel("ot-mgmt-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "overtime_requests" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_dayoff_overrides" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_dayoff_patterns" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "company_holidays" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "shift_assignments" }, refetch)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const holidaySet = useMemo(() => new Set(holidays.map((h) => h.date)), [holidays]);
  const holidayNameMap = useMemo(() => {
    const m = new Map<string, string>();
    holidays.forEach((h) => m.set(h.date, h.name));
    return m;
  }, [holidays]);
  const shiftMap = useMemo(() => {
    const m = new Map<string, Shift>();
    shifts.forEach((s) => m.set(s.id, s));
    return m;
  }, [shifts]);
  const shiftFor = (empId: string, dateIso: string): Shift | null => {
    const id = getShiftIdFor(empId, dateIso, assignments);
    return id ? shiftMap.get(id) || null : null;
  };
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

  const monthLabel = `${MONTHS_FULL[month]} ${year + 543}`;
  const navMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  // Returns the OT entries for an employee on a date
  const otFor = (empId: string, dateIso: string): OTEntry[] =>
    entries.filter((e) => e.employee_id === empId && e.date === dateIso);

  // Save (replace) the OT for an employee+date with a single managed entry
  const saveOT = async (empId: string, dateIso: string, hours: number, otType: string, startTime: string, endTime: string) => {
    if (!canEdit) return;
    try {
      const existing = otFor(empId, dateIso);
      for (const ex of existing) {
        await supabase.from("overtime_requests").delete().eq("id", ex.id);
      }
      if (hours > 0) {
        const { error } = await supabase.from("overtime_requests").insert({
          employee_id: empId,
          date: dateIso,
          start_time: startTime || "",
          end_time: endTime || "",
          hours,
          ot_type: otType,
          reason: "กำหนดโดยผู้ดูแล",
          status: "approved",
          approved_by: managerName,
          current_tier: 1,
          approved_tiers: 1,
          total_tiers: 1,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      toast({ title: "ไม่สามารถบันทึกได้", description: err.message, variant: "destructive" });
    }
  };

  const removeOT = async (empId: string, dateIso: string) => {
    if (!canEdit) return;
    try {
      const existing = otFor(empId, dateIso);
      for (const ex of existing) {
        await supabase.from("overtime_requests").delete().eq("id", ex.id);
      }
    } catch (err: any) {
      toast({ title: "ไม่สามารถลบได้", description: err.message, variant: "destructive" });
    }
  };

  // Stats
  const monthIsoPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthEntries = entries.filter((e) => e.date.startsWith(monthIsoPrefix));
  const totalHoursMonth = monthEntries.reduce((s, e) => s + (e.hours || 0), 0);
  const uniqueEmps = new Set(monthEntries.map((e) => e.employee_id)).size;

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold font-display">จัดการโอที</h2>
        <p className="text-sm text-muted-foreground mt-0.5">กำหนดและจัดการชั่วโมงโอทีของพนักงาน · คลิกเซลล์เพื่อกำหนด OT รายวัน</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card-base p-4">
          <p className="text-xs text-muted-foreground">เดือนนี้</p>
          <p className="text-lg font-bold font-display">{monthLabel}</p>
        </div>
        <div className="card-base p-4">
          <p className="text-xs text-muted-foreground">รวมชั่วโมง OT</p>
          <p className="text-lg font-bold font-display">{fmtHours(totalHoursMonth)} ชม.</p>
        </div>
        <div className="card-base p-4">
          <p className="text-xs text-muted-foreground">พนักงานที่มี OT</p>
          <p className="text-lg font-bold font-display">{uniqueEmps} คน</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="calendar"><CalendarDays className="w-4 h-4 mr-1.5" />ปฏิทินรายเดือน</TabsTrigger>
          <TabsTrigger value="employee"><Users className="w-4 h-4 mr-1.5" />รายพนักงาน</TabsTrigger>
          <TabsTrigger value="bulk"><Settings2 className="w-4 h-4 mr-1.5" />จัดการแบบกลุ่ม</TabsTrigger>
        </TabsList>

        {/* ============ TAB 1: Calendar Grid ============ */}
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
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded" style={{ background: "hsl(var(--muted))" }} />ไม่มี OT</span>
              {OT_TYPES.map((t) => (
                <span key={t.value} className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded" style={{ background: `${t.color}30` }} />{t.label}
                </span>
              ))}
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded" style={{ background: "hsl(220 80% 90%)" }} />วันหยุดบริษัท</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-2 rounded-sm" style={{ background: "linear-gradient(90deg,#2563EB,#7C3AED)" }} />แถบสีล่าง = กะการทำงาน</span>
              {shifts.length > 0 && (
                <span className="flex items-center gap-2 pl-1 ml-1 border-l" style={{ borderColor: "hsl(var(--border))" }}>
                  {shifts.map((s) => (
                    <span key={s.id} className="flex items-center gap-1">
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                      <span className="text-[11px]">{s.name}</span>
                    </span>
                  ))}
                </span>
              )}
              {canEdit && <span className="text-muted-foreground">· คลิกเซลล์เพื่อกำหนด OT</span>}
            </div>
          </div>


          <div className="card-base overflow-auto max-h-[calc(100vh-260px)]">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 px-3 py-2 text-left font-semibold border-b border-r min-w-[180px] z-30" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}>พนักงาน</th>
                  {monthDays.map((d) => {
                    const dow = d.getDay();
                    const isWeekend = dow === 0 || dow === 6;
                    const iso = isoDate(d);
                    const isHoliday = holidaySet.has(iso);
                    return (
                      <th key={iso} title={isHoliday ? `วันหยุด: ${holidayNameMap.get(iso) || ""}` : `${WEEKDAY_FULL[dow]} ${d.getDate()}`}
                        className="sticky top-0 z-20 px-1 py-1 text-center font-semibold border-b min-w-[40px]" style={{
                        borderColor: "hsl(var(--border))",
                        background: isHoliday ? "hsl(220 80% 95%)" : (isWeekend ? "hsl(0 0% 96%)" : "hsl(var(--muted) / 0.5)"),
                        color: isHoliday ? "hsl(220 80% 35%)" : undefined,
                      }}>
                        <div className="text-[9px] opacity-60">{WEEKDAY_LABELS[dow]}</div>
                        <div>{d.getDate()}</div>
                        <div className="h-1 flex items-center justify-center">
                          {isHoliday && <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "hsl(220 80% 45%)" }} />}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-muted/20">
                    <td className="sticky left-0 bg-card px-3 py-2 border-b border-r z-10" style={{ borderColor: "hsl(var(--border))" }}>
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
                      const isHoliday = holidaySet.has(iso);
                      const dayoff = isDayoffOn(emp.id, iso, dow, patterns, overrides, holidaySet);
                      const dayEntries = otFor(emp.id, iso);
                      const totalH = dayEntries.reduce((s, e) => s + (e.hours || 0), 0);
                      const primary = dayEntries[0];
                      const tInfo = primary ? otTypeInfo(primary.ot_type) : null;
                      const shift = shiftFor(emp.id, iso);

                      let bg = "hsl(var(--muted))";
                      let color = "hsl(var(--muted-foreground))";
                      let label = dayoff ? "·" : "—";
                      let title = `${WEEKDAY_FULL[dow]} ${d.getDate()}`;
                      if (isHoliday) title += ` · วันหยุด${holidayNameMap.get(iso) ? `: ${holidayNameMap.get(iso)}` : ""}`;
                      else if (dayoff) title += " · วันหยุดพนักงาน";
                      if (shift) title += ` · กะ${shift.name} (${shift.start_time}-${shift.end_time})`;
                      if (totalH > 0 && tInfo) {
                        bg = `${tInfo.color}25`;
                        color = tInfo.color;
                        label = `${fmtHours(totalH)}`;
                        title += ` · OT ${fmtHours(totalH)} ชม. (${tInfo.label})`;
                      }

                      const cellInner = (
                        <span className="relative block w-full h-8 rounded overflow-hidden" style={{ background: bg }}>
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold" style={{ color }}>{label}</span>
                          {shift && (
                            <span className="absolute bottom-0 inset-x-0 h-[3px]" style={{ background: shift.color }} />
                          )}
                        </span>
                      );

                      return (
                        <td key={iso} className="p-0.5 text-center border-b" style={{ borderColor: "hsl(var(--border))", background: isHoliday ? "hsl(220 80% 97%)" : undefined }}>
                          {canEdit ? (
                            <OTCellPopover
                              dateLabel={`${fmtThaiDate(iso)} · ${emp.firstName}`}
                              dayoff={dayoff}
                              holidayName={isHoliday ? (holidayNameMap.get(iso) || "วันหยุด") : ""}
                              shiftLabel={shift ? `${shift.name} (${shift.start_time}-${shift.end_time})` : ""}
                              shiftColor={shift?.color}
                              entry={primary}
                              onSave={(h, t, st, et) => saveOT(emp.id, iso, h, t, st, et)}
                              onRemove={() => removeOT(emp.id, iso)}
                            >
                              <button
                                className={cn(
                                  "w-full transition-all hover:scale-110 cursor-pointer",
                                  dayoff && totalH === 0 && "opacity-60"
                                )}
                                title={title}
                              >
                                {cellInner}
                              </button>
                            </OTCellPopover>
                          ) : (
                            <div className={cn("w-full", dayoff && totalH === 0 && "opacity-60")} title={title}>
                              {cellInner}
                            </div>
                          )}
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
          <EmployeeOTDetailView
            employees={employees}
            entries={entries}
            patterns={patterns}
            overrides={overrides}
            holidaySet={holidaySet}
            holidayNameMap={holidayNameMap}
            shiftFor={shiftFor}
            shifts={shifts}
            selectedEmpId={selectedEmpId}
            setSelectedEmpId={setSelectedEmpId}
            canEdit={canEdit}
            onChanged={fetchAll}
            onSaveOT={saveOT}
            onRemoveOT={removeOT}
            lockEmployee={isEmployeeRole}
          />
        </TabsContent>

        {/* ============ TAB 3: Bulk ============ */}
        <TabsContent value="bulk" className="space-y-4">
          <BulkOTActionsView
            employees={employees}
            canEdit={canEdit}
            managerName={managerName}
            onChanged={fetchAll}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

/* =================== OT Cell editor popover =================== */
const OTCellPopover = ({ children, dateLabel, dayoff, holidayName, shiftLabel, shiftColor, entry, onSave, onRemove }: any) => {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState<string>(entry ? String(entry.hours) : "");
  const [otType, setOtType] = useState<string>(entry?.ot_type || (dayoff ? "holiday" : "workday"));
  const [startTime, setStartTime] = useState<string>(entry?.start_time || "");
  const [endTime, setEndTime] = useState<string>(entry?.end_time || "");

  useEffect(() => {
    if (open) {
      setHours(entry ? String(entry.hours) : "");
      setOtType(entry?.ot_type || (dayoff ? "holiday" : "workday"));
      setStartTime(entry?.start_time || "");
      setEndTime(entry?.end_time || "");
    }
  }, [open]);

  const handleSave = () => {
    const h = parseFloat(hours);
    if (isNaN(h) || h <= 0) return;
    onSave(h, otType, startTime, endTime);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-2.5" align="center">
        <div className="border-b pb-1.5 space-y-1">
          <div className="text-[11px] text-muted-foreground">{dateLabel}</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {holidayName && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "hsl(220 80% 92%)", color: "hsl(220 80% 35%)" }}>วันหยุด · {holidayName}</span>
            )}
            {!holidayName && dayoff && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">วันหยุดพนักงาน</span>
            )}
            {shiftLabel && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded inline-flex items-center gap-1" style={{ background: `${shiftColor || "#888"}20`, color: shiftColor || "inherit" }}>
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: shiftColor || "#888" }} />
                กะ {shiftLabel}
              </span>
            )}
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-semibold mb-1 text-muted-foreground">จำนวนชั่วโมง OT</label>
          <input type="number" min="0" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)}
            placeholder="เช่น 2" className="w-full px-3 py-2 text-sm rounded-lg border outline-none bg-muted/30" />
          <div className="flex gap-1 mt-1.5">
            {[1, 2, 3, 4].map((q) => (
              <button key={q} onClick={() => setHours(String(q))}
                className="flex-1 px-2 py-1 rounded-md text-[11px] font-semibold border bg-muted/30 hover:bg-muted">{q}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-semibold mb-1 text-muted-foreground">ประเภท OT</label>
          <select value={otType} onChange={(e) => setOtType(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border outline-none bg-muted/30 cursor-pointer">
            {OT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-semibold mb-1 text-muted-foreground">เริ่ม</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-2 py-2 text-sm rounded-lg border outline-none bg-muted/30" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold mb-1 text-muted-foreground">สิ้นสุด</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-2 py-2 text-sm rounded-lg border outline-none bg-muted/30" />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-primary-foreground"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))" }}>
            <Save className="w-3.5 h-3.5" />บันทึก
          </button>
          {entry && (
            <button onClick={() => { onRemove(); setOpen(false); }}
              className="px-3 py-2 rounded-lg text-xs font-bold text-destructive hover:bg-destructive/10 border border-destructive/30">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

/* =================== TAB 2: Employee Detail =================== */
const EmployeeOTDetailView = ({
  employees, entries, patterns, overrides, holidaySet,
  selectedEmpId, setSelectedEmpId, canEdit, onChanged, onSaveOT, onRemoveOT, lockEmployee,
}: any) => {
  const { toast } = useToast();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const [addDate, setAddDate] = useState("");
  const [addHours, setAddHours] = useState("");
  const [addType, setAddType] = useState("workday");
  const [addStart, setAddStart] = useState("");
  const [addEnd, setAddEnd] = useState("");
  const [saving, setSaving] = useState(false);

  const empOptions = employees
    .filter((e: any) => e.status === "active")
    .map((e: any) => ({ value: e.id, label: `${e.prefix}${e.firstName} ${e.lastName}${e.nickname ? ` (${e.nickname})` : ""}`, subtitle: e.dept }));

  const empEntries = entries.filter((e: OTEntry) => e.employee_id === selectedEmpId).sort((a: OTEntry, b: OTEntry) => b.date.localeCompare(a.date));
  const monthDays = useMemo(() => getMonthDays(year, month), [year, month]);

  const navMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear()); setMonth(d.getMonth());
  };

  const addOT = async () => {
    if (!selectedEmpId || !addDate || !addHours) {
      toast({ title: "กรุณาเลือกวันที่และจำนวนชั่วโมง", variant: "destructive" }); return;
    }
    const h = parseFloat(addHours);
    if (isNaN(h) || h <= 0) { toast({ title: "จำนวนชั่วโมงไม่ถูกต้อง", variant: "destructive" }); return; }
    setSaving(true);
    await onSaveOT(selectedEmpId, addDate, h, addType, addStart, addEnd);
    setSaving(false);
    toast({ title: "บันทึก OT สำเร็จ" });
    setAddDate(""); setAddHours(""); setAddStart(""); setAddEnd("");
    onChanged();
  };

  const removeEntry = async (e: OTEntry) => {
    await onRemoveOT(e.employee_id, e.date);
    toast({ title: "ลบสำเร็จ" });
    onChanged();
  };

  const monthLabel = `${MONTHS_FULL[month]} ${year + 543}`;
  const firstDow = new Date(year, month, 1).getDay();
  const totalEmpHours = empEntries.reduce((s: number, e: OTEntry) => s + (e.hours || 0), 0);

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-1 space-y-4">
        <div className="card-base p-4 space-y-3">
          <label className="block text-sm font-semibold">เลือกพนักงาน</label>
          <SearchableSelect value={selectedEmpId} onChange={setSelectedEmpId} options={empOptions} placeholder="-- เลือก --" disabled={lockEmployee} />
        </div>

        {selectedEmpId && canEdit && (
          <div className="card-base p-4 space-y-3">
            <h4 className="font-bold text-sm flex items-center gap-2"><Plus className="w-4 h-4" />เพิ่ม OT</h4>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">วันที่</label>
              <ThaiDatePicker value={addDate} onChange={setAddDate} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">จำนวนชั่วโมง</label>
              <input type="number" min="0" step="0.5" value={addHours} onChange={(e) => setAddHours(e.target.value)}
                placeholder="เช่น 2" className="w-full px-3 py-2 text-sm rounded-xl border outline-none bg-muted/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">ประเภท OT</label>
              <select value={addType} onChange={(e) => setAddType(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border outline-none bg-muted/30 cursor-pointer">
                {OT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">เริ่ม</label>
                <input type="time" value={addStart} onChange={(e) => setAddStart(e.target.value)}
                  className="w-full px-2 py-2 text-sm rounded-xl border outline-none bg-muted/30" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">สิ้นสุด</label>
                <input type="time" value={addEnd} onChange={(e) => setAddEnd(e.target.value)}
                  className="w-full px-2 py-2 text-sm rounded-xl border outline-none bg-muted/30" />
              </div>
            </div>
            <button onClick={addOT} disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-primary-foreground disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))" }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              บันทึก OT
            </button>
          </div>
        )}
      </div>

      <div className="lg:col-span-2 space-y-4">
        {!selectedEmpId ? (
          <div className="card-base p-12 text-center text-muted-foreground">
            <Clock className="w-10 h-10 mx-auto mb-2 opacity-40" />
            เลือกพนักงานเพื่อดูปฏิทิน OT
          </div>
        ) : (
          <>
            <div className="card-base p-4">
              <div className="flex items-center justify-between mb-3">
                <button onClick={() => navMonth(-1)} className="p-2 rounded-xl hover:bg-muted"><ChevronLeft className="w-4 h-4" /></button>
                <h4 className="text-base font-bold font-display">{monthLabel}</h4>
                <button onClick={() => navMonth(1)} className="p-2 rounded-xl hover:bg-muted"><ChevronRight className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-7 gap-px rounded-xl border overflow-hidden" style={{ borderColor: "hsl(var(--border))" }}>
                {WEEKDAY_LABELS.map((wd) => (
                  <div key={wd} className="bg-muted/50 px-2 py-2 text-center text-[11px] font-semibold text-muted-foreground">{wd}</div>
                ))}
                {Array.from({ length: firstDow }).map((_, i) => <div key={`ot-${i}`} className="bg-muted/20 min-h-[68px]" />)}
                {monthDays.map((d) => {
                  const iso = isoDate(d);
                  const dow = d.getDay();
                  const dayoff = isDayoffOn(selectedEmpId, iso, dow, patterns, overrides, holidaySet);
                  const dayEntries = entries.filter((e: OTEntry) => e.employee_id === selectedEmpId && e.date === iso);
                  const totalH = dayEntries.reduce((s: number, e: OTEntry) => s + (e.hours || 0), 0);
                  const primary = dayEntries[0];
                  const tInfo = primary ? otTypeInfo(primary.ot_type) : null;

                  return (
                    <div key={iso} className="bg-background min-h-[68px] p-1 flex flex-col items-center gap-1"
                      style={{ borderTop: "1px solid hsl(var(--border) / 0.5)" }}>
                      <span className="text-[10px] font-semibold text-muted-foreground">{d.getDate()}</span>
                      {canEdit ? (
                        <OTCellPopover
                          dateLabel={fmtThaiDate(iso)}
                          dayoff={dayoff}
                          entry={primary}
                          onSave={(h: number, t: string, st: string, et: string) => onSaveOT(selectedEmpId, iso, h, t, st, et)}
                          onRemove={() => onRemoveOT(selectedEmpId, iso)}
                        >
                          <button className="px-2 py-1 rounded text-[10px] font-bold transition-all hover:opacity-80"
                            style={totalH > 0 && tInfo
                              ? { background: `${tInfo.color}25`, color: tInfo.color }
                              : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>
                            {totalH > 0 ? `${fmtHours(totalH)} ชม.` : "+ เพิ่ม"}
                          </button>
                        </OTCellPopover>
                      ) : totalH > 0 && tInfo ? (
                        <span className="px-2 py-1 rounded text-[10px] font-bold"
                          style={{ background: `${tInfo.color}25`, color: tInfo.color }}>{fmtHours(totalH)} ชม.</span>
                      ) : (
                        <span className="text-[9px] text-muted-foreground">{dayoff ? "หยุด" : "—"}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card-base p-4">
              <h4 className="font-bold text-sm mb-3">รายการ OT ของพนักงาน ({empEntries.length}) · รวม {fmtHours(totalEmpHours)} ชม.</h4>
              {empEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">ยังไม่มีรายการ OT</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {empEntries.map((e: OTEntry) => {
                    const tInfo = otTypeInfo(e.ot_type);
                    return (
                      <div key={e.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border" style={{ borderColor: "hsl(var(--border))" }}>
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold flex-shrink-0"
                            style={{ background: `${tInfo.color}20`, color: tInfo.color }}>{fmtHours(e.hours)} ชม.</span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate">{fmtThaiDate(e.date)} · {tInfo.label}</p>
                            {(e.start_time || e.end_time) && (
                              <p className="text-[10px] text-muted-foreground truncate">{e.start_time || "-"} - {e.end_time || "-"}</p>
                            )}
                          </div>
                        </div>
                        {canEdit && (
                          <button onClick={() => removeEntry(e)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive flex-shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/* =================== TAB 3: Bulk Actions =================== */
const BulkOTActionsView = ({ employees, canEdit, managerName, onChanged }: any) => {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const [bulkHours, setBulkHours] = useState("");
  const [bulkType, setBulkType] = useState("workday");
  const [bulkFrom, setBulkFrom] = useState("");
  const [bulkTo, setBulkTo] = useState("");
  const [bulkStart, setBulkStart] = useState("");
  const [bulkEnd, setBulkEnd] = useState("");
  const [includeDates, setIncludeDates] = useState<"all" | "weekends" | "weekdays">("all");
  const [busy, setBusy] = useState(false);

  const activeEmps = employees.filter((e: any) => e.status === "active");
  const filtered = activeEmps.filter((e: any) =>
    !search || `${e.firstName}${e.lastName}${e.nickname}`.toLowerCase().includes(search.toLowerCase())
  );

  const toggleId = (id: string) => {
    setSelectedIds((cur) => { const next = new Set(cur); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const selectAll = () => setSelectedIds(new Set(filtered.map((e: any) => e.id)));
  const clearAll = () => setSelectedIds(new Set());

  const datesInRange = (from: string, to: string): string[] => {
    const out: string[] = [];
    const start = new Date(from + "T00:00:00");
    const end = new Date(to + "T00:00:00");
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return out;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      const isWeekend = dow === 0 || dow === 6;
      if (includeDates === "weekends" && !isWeekend) continue;
      if (includeDates === "weekdays" && isWeekend) continue;
      out.push(isoDate(d));
    }
    return out;
  };

  const applyBulkOT = async () => {
    const h = parseFloat(bulkHours);
    if (selectedIds.size === 0 || !bulkHours || !bulkFrom || !bulkTo) {
      toast({ title: "กรุณาเลือกพนักงาน, ชั่วโมง และช่วงวันที่", variant: "destructive" }); return;
    }
    if (isNaN(h) || h <= 0) { toast({ title: "จำนวนชั่วโมงไม่ถูกต้อง", variant: "destructive" }); return; }
    const dates = datesInRange(bulkFrom, bulkTo);
    if (dates.length === 0) { toast({ title: "ช่วงวันที่ไม่ถูกต้อง", variant: "destructive" }); return; }

    setBusy(true);
    const empIds = Array.from(selectedIds);
    // Remove existing approved OT in range for selected employees, then insert fresh
    try {
      await supabase.from("overtime_requests").delete()
        .in("employee_id", empIds)
        .gte("date", dates[0])
        .lte("date", dates[dates.length - 1])
        .eq("status", "approved");
    } catch { /* ignore */ }

    const rows: any[] = [];
    empIds.forEach((empId) => {
      dates.forEach((dt) => {
        rows.push({
          employee_id: empId, date: dt,
          start_time: bulkStart || "", end_time: bulkEnd || "",
          hours: h, ot_type: bulkType, reason: "กำหนดโดยผู้ดูแล (กลุ่ม)",
          status: "approved", approved_by: managerName,
          current_tier: 1, approved_tiers: 1, total_tiers: 1,
        });
      });
    });
    const { error } = await supabase.from("overtime_requests").insert(rows);
    setBusy(false);
    if (error) toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
    else {
      toast({ title: `กำหนด OT สำเร็จ ${empIds.length} คน × ${dates.length} วัน` });
      setBulkHours(""); setBulkFrom(""); setBulkTo(""); setBulkStart(""); setBulkEnd("");
      onChanged();
    }
  };

  const clearBulkOT = async () => {
    if (selectedIds.size === 0 || !bulkFrom || !bulkTo) {
      toast({ title: "กรุณาเลือกพนักงานและช่วงวันที่", variant: "destructive" }); return;
    }
    setBusy(true);
    const empIds = Array.from(selectedIds);
    const { error } = await supabase.from("overtime_requests").delete()
      .in("employee_id", empIds)
      .gte("date", bulkFrom)
      .lte("date", bulkTo)
      .eq("status", "approved");
    setBusy(false);
    if (error) toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
    else { toast({ title: `ล้าง OT ในช่วงที่เลือกสำเร็จ` }); onChanged(); }
  };

  if (!canEdit) {
    return <div className="card-base p-12 text-center text-muted-foreground">คุณไม่มีสิทธิ์ใช้งานเครื่องมือกลุ่ม</div>;
  }

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
        <div className="card-base p-4 space-y-3">
          <h4 className="font-bold text-sm">① กำหนด OT ให้พนักงานหลายคนในช่วงวันที่</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">จำนวนชั่วโมง / วัน</label>
              <input type="number" min="0" step="0.5" value={bulkHours} onChange={(e) => setBulkHours(e.target.value)}
                placeholder="เช่น 2" className="w-full px-3 py-2 text-sm rounded-xl border outline-none bg-muted/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">ประเภท OT</label>
              <select value={bulkType} onChange={(e) => setBulkType(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border outline-none bg-muted/30 cursor-pointer">
                {OT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">เริ่ม (วันที่)</label>
              <ThaiDatePicker value={bulkFrom} onChange={setBulkFrom} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">สิ้นสุด (วันที่)</label>
              <ThaiDatePicker value={bulkTo} onChange={setBulkTo} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">เวลาเริ่ม</label>
              <input type="time" value={bulkStart} onChange={(e) => setBulkStart(e.target.value)}
                className="w-full px-2 py-2 text-sm rounded-xl border outline-none bg-muted/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">เวลาสิ้นสุด</label>
              <input type="time" value={bulkEnd} onChange={(e) => setBulkEnd(e.target.value)}
                className="w-full px-2 py-2 text-sm rounded-xl border outline-none bg-muted/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">วันที่จะกำหนด</label>
            <select value={includeDates} onChange={(e) => setIncludeDates(e.target.value as any)}
              className="w-full px-3 py-2 text-sm rounded-xl border outline-none bg-muted/30 cursor-pointer">
              <option value="all">ทุกวันในช่วง</option>
              <option value="weekdays">เฉพาะวันธรรมดา (จ.-ศ.)</option>
              <option value="weekends">เฉพาะวันหยุดสุดสัปดาห์ (ส.-อา.)</option>
            </select>
          </div>
          <p className="text-xs text-muted-foreground">ระบบจะสร้างรายการ OT ให้แต่ละวันที่เลือกในช่วง · OT เดิมในช่วงนี้ของพนักงานที่เลือกจะถูกแทนที่</p>
          <button onClick={applyBulkOT} disabled={busy}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-bold text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))" }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            กำหนด OT ให้ {selectedIds.size} คน
          </button>
        </div>

        <div className="card-base p-4 space-y-3">
          <h4 className="font-bold text-sm">② ล้าง OT ในช่วงวันที่</h4>
          <p className="text-xs text-muted-foreground">ลบรายการ OT (ที่อนุมัติแล้ว) ของพนักงานที่เลือก ในช่วงวันที่ด้านบน (① เริ่ม–สิ้นสุด)</p>
          <button onClick={clearBulkOT} disabled={busy}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-bold text-destructive border border-destructive/30 hover:bg-destructive/10 disabled:opacity-50 flex items-center justify-center gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            ล้าง OT ของ {selectedIds.size} คน
          </button>
        </div>
      </div>
    </div>
  );
};

export default OvertimeManagement;
