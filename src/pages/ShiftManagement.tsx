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

interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  color: string;
}

interface ShiftAssignment {
  id: string;
  employee_id: string;
  shift_id: string;
  start_date: string;
  end_date: string;
  assignment_type: string;
}

interface Pattern { id: string; employee_id: string; weekdays: number[]; effective_from: string; effective_to: string | null; }
interface Override { id: string; employee_id: string; date: string; is_dayoff: boolean; }
interface CompanyHoliday { id: string; date: string; name: string; }

const WEEKDAY_LABELS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const WEEKDAY_FULL = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const MONTHS_FULL = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

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

// Returns true if date is a day-off for this employee (override > company > pattern)
const isDayoffOn = (empId: string, dateIso: string, dow: number, patterns: Pattern[], overrides: Override[], holidays: Set<string>): boolean => {
  const ov = overrides.find((o) => o.employee_id === empId && o.date === dateIso);
  if (ov) return ov.is_dayoff;
  if (holidays.has(dateIso)) return true;
  return patterns.some((p) => p.employee_id === empId && isPatternActive(p, dateIso) && p.weekdays.includes(dow));
};

// Returns the shift assigned to an employee on a date (day override > bulk)
const getShiftFor = (empId: string, dateIso: string, bulks: ShiftAssignment[], days: ShiftAssignment[]): string | null => {
  const day = days.find((d) => d.employee_id === empId && d.start_date === dateIso);
  if (day) return day.shift_id;
  const bulk = bulks.find((b) => b.employee_id === empId && b.start_date <= dateIso && b.end_date >= dateIso);
  return bulk ? bulk.shift_id : null;
};

const fmtThaiDate = (iso: string) => {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${parseInt(d)}/${parseInt(m)}/${parseInt(y) + 543}`;
};

const ShiftManagement = () => {
  const { toast } = useToast();
  const { employees: allEmployees } = useEmployees();
  const employees = useMemo(() => allEmployees.filter((e: any) => (e.role || "").toLowerCase() !== "admin"), [allEmployees]);
  const { user, role, currentUser } = useAuth();
  const isEmployeeRole = role.toLowerCase() === "employee";
  const employeeId = currentUser?.employeeId || null;
  const { canAction } = usePermissions();

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [holidays, setHolidays] = useState<CompanyHoliday[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("calendar");
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");

  // Auto-select self for employee role
  useEffect(() => {
    if (isEmployeeRole && employeeId) {
      setSelectedEmpId(employeeId);
    }
  }, [isEmployeeRole, employeeId]);

  const canEdit = canAction(role, "shiftManagement", "edit");

  const fetchAll = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    const [sh, asn, pr, or, hol] = await Promise.all([
      supabase.from("shifts").select("*").order("sort_order"),
      supabase.from("shift_assignments").select("*").order("created_at", { ascending: false }),
      supabase.from("employee_dayoff_patterns").select("*"),
      supabase.from("employee_dayoff_overrides").select("*"),
      supabase.from("company_holidays").select("*"),
    ]);
    setShifts((sh.data as Shift[]) || []);
    setAssignments((asn.data as ShiftAssignment[]) || []);
    setPatterns((pr.data as Pattern[]) || []);
    setOverrides((or.data as Override[]) || []);
    setHolidays((hol.data as CompanyHoliday[]) || []);
    if (showLoading) setLoading(false);
  };

  useEffect(() => { fetchAll(true); }, []);

  // Realtime — silent updates (no loading flash)
  useEffect(() => {
    const refetch = () => { fetchAll(false); };
    const channel = supabase
      .channel("shift-mgmt-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "shift_assignments" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_dayoff_overrides" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_dayoff_patterns" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "company_holidays" }, refetch)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const holidaySet = useMemo(() => new Set(holidays.map((h) => h.date)), [holidays]);
  const monthDays = useMemo(() => getMonthDays(year, month), [year, month]);
  const bulkAssignments = useMemo(() => assignments.filter((a) => a.assignment_type === "bulk"), [assignments]);
  const dayAssignments = useMemo(() => assignments.filter((a) => a.assignment_type === "day"), [assignments]);

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

  const setShiftForDate = async (empId: string, dateIso: string, shiftId: string | null) => {
    if (!canEdit) return;
    try {
      // Always remove existing day assignment for this date first
      const existing = dayAssignments.find((d) => d.employee_id === empId && d.start_date === dateIso);
      if (existing) {
        await supabase.from("shift_assignments").delete().eq("id", existing.id);
      }
      if (shiftId) {
        const { error } = await supabase.from("shift_assignments").insert({
          employee_id: empId, shift_id: shiftId,
          start_date: dateIso, end_date: dateIso,
          assignment_type: "day",
        });
        if (error) throw error;
      }
    } catch (err: any) {
      toast({ title: "ไม่สามารถบันทึกได้", description: err.message, variant: "destructive" });
    }
  };

  // Stats
  const uniqueEmployees = new Set(bulkAssignments.map((a) => a.employee_id)).size;
  const totalAssigned = bulkAssignments.length;
  const shiftCounts = shifts.map((s) => ({ ...s, count: bulkAssignments.filter((a) => a.shift_id === s.id).length }));

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold font-display">จัดการกะทำงาน</h2>
        <p className="text-sm text-muted-foreground mt-0.5">กำหนดและจัดการกะการทำงานแบบยืดหยุ่น · คลิกเซลล์เพื่อเปลี่ยนกะรายวัน</p>
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
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded" style={{ background: "hsl(var(--muted))" }} />ไม่มีกะ</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded" style={{ background: "hsl(0 70% 88%)" }} />วันหยุด</span>
              {shifts.slice(0, 4).map((s) => (
                <span key={s.id} className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded" style={{ background: `${s.color}40` }} />{s.name}
                </span>
              ))}
              {canEdit && <span className="text-muted-foreground">· คลิกเซลล์เพื่อเปลี่ยนกะ</span>}
            </div>
          </div>

          <div className="overflow-auto max-h-[calc(100vh-200px)]">
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
                      <th key={iso} className="sticky top-0 z-20 px-1 py-1 text-center font-semibold border-b min-w-[40px]" style={{
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
                      const dayoff = isDayoffOn(emp.id, iso, dow, patterns, overrides, holidaySet);
                      const shiftId = getShiftFor(emp.id, iso, bulkAssignments, dayAssignments);
                      const shift = shiftId ? shifts.find((s) => s.id === shiftId) : null;
                      const hasDayOverride = dayAssignments.some((da) => da.employee_id === emp.id && da.start_date === iso);

                      // Cell content
                      let bg = "hsl(var(--muted))";
                      let color = "hsl(var(--muted-foreground))";
                      let label: string = "—";
                      let title = `${WEEKDAY_FULL[dow]} ${d.getDate()}`;
                      if (dayoff) {
                        bg = "hsl(0 70% 88%)";
                        color = "hsl(0 70% 35%)";
                        label = "หยุด";
                        title += " · วันหยุด";
                      } else if (shift) {
                        bg = `${shift.color}30`;
                        color = shift.color;
                        label = shift.name.slice(0, 2);
                        title += ` · ${shift.name} (${shift.start_time}-${shift.end_time})`;
                      }

                      return (
                        <td key={iso} className="p-0.5 text-center border-b" style={{ borderColor: "hsl(var(--border))" }}>
                          {canEdit && !dayoff ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  className={cn(
                                    "w-full h-8 rounded text-[10px] font-bold transition-all hover:scale-110 cursor-pointer",
                                    hasDayOverride && "ring-1 ring-offset-1 ring-orange-400"
                                  )}
                                  style={{ background: bg, color }}
                                  title={title}
                                >
                                  {label}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-56 p-1.5" align="center">
                                <div className="px-2 py-1.5 text-[10px] text-muted-foreground border-b mb-1">
                                  {fmtThaiDate(iso)} · {emp.firstName}
                                </div>
                                {shifts.map((s) => (
                                  <button key={s.id} onClick={() => setShiftForDate(emp.id, iso, s.id)}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-muted transition-colors text-left">
                                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: s.color }} />
                                    <span className="flex-1">{s.name}</span>
                                    <span className="text-muted-foreground">{s.start_time}</span>
                                  </button>
                                ))}
                                {hasDayOverride && (
                                  <button onClick={() => setShiftForDate(emp.id, iso, null)}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-destructive/10 text-destructive transition-colors text-left border-t mt-1">
                                    <X className="w-3 h-3" />ลบกะรายวัน (กลับไปใช้กะระยะยาว)
                                  </button>
                                )}
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <div className="w-full h-8 rounded text-[10px] font-bold flex items-center justify-center"
                              style={{ background: bg, color }}
                              title={title}>
                              {label}
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
          <EmployeeShiftDetailView
            employees={employees}
            shifts={shifts}
            bulkAssignments={bulkAssignments}
            dayAssignments={dayAssignments}
            patterns={patterns}
            overrides={overrides}
            holidaySet={holidaySet}
            selectedEmpId={selectedEmpId}
            setSelectedEmpId={setSelectedEmpId}
            canEdit={canEdit}
            onChanged={fetchAll}
            onSetShift={setShiftForDate}
            lockEmployee={isEmployeeRole}
          />
        </TabsContent>

        {/* ============ TAB 3: Bulk ============ */}
        <TabsContent value="bulk" className="space-y-4">
          <BulkShiftActionsView
            employees={employees}
            shifts={shifts}
            bulkAssignments={bulkAssignments}
            canEdit={canEdit}
            onChanged={fetchAll}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

/* =================== TAB 2: Employee Detail =================== */
const EmployeeShiftDetailView = ({
  employees, shifts, bulkAssignments, dayAssignments, patterns, overrides, holidaySet,
  selectedEmpId, setSelectedEmpId, canEdit, onChanged, onSetShift, lockEmployee,
}: any) => {
  const { toast } = useToast();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const [shiftId, setShiftId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  const empOptions = employees
    .filter((e: any) => e.status === "active")
    .map((e: any) => ({ value: e.id, label: `${e.prefix}${e.firstName} ${e.lastName}${e.nickname ? ` (${e.nickname})` : ""}`, subtitle: e.dept }));

  const empBulks = bulkAssignments.filter((b: ShiftAssignment) => b.employee_id === selectedEmpId);
  const empDays = dayAssignments.filter((d: ShiftAssignment) => d.employee_id === selectedEmpId);
  const monthDays = useMemo(() => getMonthDays(year, month), [year, month]);

  const navMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear()); setMonth(d.getMonth());
  };

  const addBulk = async () => {
    if (!selectedEmpId || !shiftId || !startDate || !endDate) {
      toast({ title: "กรุณาเลือกกะและช่วงวันที่", variant: "destructive" }); return;
    }
    setSaving(true);
    const { error } = await supabase.from("shift_assignments").insert({
      employee_id: selectedEmpId, shift_id: shiftId,
      start_date: startDate, end_date: endDate, assignment_type: "bulk",
    });
    setSaving(false);
    if (error) toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
    else { toast({ title: "เพิ่มกะระยะยาวสำเร็จ" }); setShiftId(""); setStartDate(""); setEndDate(""); onChanged(); }
  };

  const deleteBulk = async (id: string) => {
    const { error } = await supabase.from("shift_assignments").delete().eq("id", id);
    if (error) toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
    else { toast({ title: "ลบสำเร็จ" }); onChanged(); }
  };

  // Build empty cells offset for first week
  const monthLabel = `${MONTHS_FULL[month]} ${year + 543}`;
  const firstDow = new Date(year, month, 1).getDay();

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      {/* Left: select + add bulk form */}
      <div className="lg:col-span-1 space-y-4">
        <div className="card-base p-4 space-y-3">
          <label className="block text-sm font-semibold">เลือกพนักงาน</label>
          <SearchableSelect value={selectedEmpId} onChange={setSelectedEmpId} options={empOptions} placeholder="-- เลือก --" disabled={lockEmployee} />
        </div>

        {selectedEmpId && canEdit && (
          <div className="card-base p-4 space-y-3">
            <h4 className="font-bold text-sm flex items-center gap-2"><Plus className="w-4 h-4" />เพิ่มกะระยะยาว</h4>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">กะ</label>
              <select value={shiftId} onChange={(e) => setShiftId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border outline-none bg-muted/30 cursor-pointer">
                <option value="">-- เลือกกะ --</option>
                {shifts.map((s: Shift) => <option key={s.id} value={s.id}>{s.name} ({s.start_time}-{s.end_time})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">เริ่ม</label>
              <ThaiDatePicker value={startDate} onChange={setStartDate} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">สิ้นสุด</label>
              <ThaiDatePicker value={endDate} onChange={setEndDate} />
            </div>
            <button onClick={addBulk} disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-primary-foreground disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))" }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              บันทึกกะระยะยาว
            </button>
          </div>
        )}
      </div>

      {/* Right: calendar + lists */}
      <div className="lg:col-span-2 space-y-4">
        {!selectedEmpId ? (
          <div className="card-base p-12 text-center text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
            เลือกพนักงานเพื่อดูปฏิทินกะการทำงาน
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
                {Array.from({ length: firstDow }).map((_, i) => <div key={`emp-${i}`} className="bg-muted/20 min-h-[68px]" />)}
                {monthDays.map((d) => {
                  const iso = isoDate(d);
                  const dow = d.getDay();
                  const dayoff = isDayoffOn(selectedEmpId, iso, dow, patterns, overrides, holidaySet);
                  const sId = getShiftFor(selectedEmpId, iso, bulkAssignments, dayAssignments);
                  const shift = sId ? shifts.find((s: Shift) => s.id === sId) : null;
                  const hasDayOverride = empDays.some((da: ShiftAssignment) => da.start_date === iso);

                  return (
                    <div key={iso} className="bg-background min-h-[68px] p-1 flex flex-col items-center gap-1"
                      style={{ borderTop: "1px solid hsl(var(--border) / 0.5)" }}>
                      <span className="text-[10px] font-semibold text-muted-foreground">{d.getDate()}</span>
                      {dayoff ? (
                        <span className="px-2 py-1 rounded text-[10px] font-bold"
                          style={{ background: "hsl(0 70% 88%)", color: "hsl(0 70% 35%)" }}>หยุด</span>
                      ) : canEdit ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className={cn(
                                "px-2 py-1 rounded text-[10px] font-bold transition-all hover:opacity-80",
                                hasDayOverride && "ring-1 ring-offset-1 ring-orange-400"
                              )}
                              style={shift
                                ? { background: `${shift.color}30`, color: shift.color }
                                : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>
                              {shift ? shift.name.slice(0, 4) : "+ เพิ่ม"}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-52 p-1.5" align="center">
                            <div className="px-2 py-1.5 text-[10px] text-muted-foreground border-b mb-1">{fmtThaiDate(iso)}</div>
                            {shifts.map((s: Shift) => (
                              <button key={s.id} onClick={() => onSetShift(selectedEmpId, iso, s.id)}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-muted text-left">
                                <div className="w-3 h-3 rounded-full" style={{ background: s.color }} />
                                <span className="flex-1">{s.name}</span>
                                <span className="text-muted-foreground">{s.start_time}</span>
                              </button>
                            ))}
                            {hasDayOverride && (
                              <button onClick={() => onSetShift(selectedEmpId, iso, null)}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-destructive/10 text-destructive border-t mt-1">
                                <X className="w-3 h-3" />ลบกะรายวัน
                              </button>
                            )}
                          </PopoverContent>
                        </Popover>
                      ) : shift ? (
                        <span className="px-2 py-1 rounded text-[10px] font-bold"
                          style={{ background: `${shift.color}30`, color: shift.color }}>{shift.name.slice(0, 4)}</span>
                      ) : (
                        <span className="text-[9px] text-muted-foreground">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card-base p-4">
              <h4 className="font-bold text-sm mb-3">กะระยะยาวของพนักงาน ({empBulks.length})</h4>
              {empBulks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">ยังไม่มีกะระยะยาว</p>
              ) : (
                <div className="space-y-2">
                  {empBulks.map((b: ShiftAssignment) => {
                    const s = shifts.find((sh: Shift) => sh.id === b.shift_id);
                    return (
                      <div key={b.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border" style={{ borderColor: "hsl(var(--border))" }}>
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold flex-shrink-0"
                            style={{ background: `${s?.color || "#888"}20`, color: s?.color || "#888" }}>{s?.name || "-"}</span>
                          <p className="text-xs text-muted-foreground truncate">{fmtThaiDate(b.start_date)} → {fmtThaiDate(b.end_date)}</p>
                        </div>
                        {canEdit && (
                          <button onClick={() => deleteBulk(b.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive flex-shrink-0">
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
const BulkShiftActionsView = ({ employees, shifts, bulkAssignments, canEdit, onChanged }: any) => {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const [bulkShiftId, setBulkShiftId] = useState("");
  const [bulkFrom, setBulkFrom] = useState("");
  const [bulkTo, setBulkTo] = useState("");

  const [copyFromId, setCopyFromId] = useState("");
  const [copyFrom, setCopyFrom] = useState("");
  const [copyTo, setCopyTo] = useState("");

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

  const applyBulkShift = async () => {
    if (selectedIds.size === 0 || !bulkShiftId || !bulkFrom || !bulkTo) {
      toast({ title: "กรุณาเลือกพนักงาน, กะ และช่วงวันที่", variant: "destructive" }); return;
    }
    setBusy(true);
    const rows = Array.from(selectedIds).map((empId) => ({
      employee_id: empId, shift_id: bulkShiftId,
      start_date: bulkFrom, end_date: bulkTo, assignment_type: "bulk",
    }));
    const { error } = await supabase.from("shift_assignments").insert(rows);
    setBusy(false);
    if (error) toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
    else { toast({ title: `กำหนดกะสำเร็จ ${rows.length} คน` }); setBulkShiftId(""); setBulkFrom(""); setBulkTo(""); onChanged(); }
  };

  const copyShifts = async () => {
    if (!copyFromId || selectedIds.size === 0 || !copyFrom || !copyTo) {
      toast({ title: "กรุณาเลือกต้นแบบ, ปลายทาง และช่วงวันที่", variant: "destructive" }); return;
    }
    const sourceBulks = bulkAssignments.filter((b: ShiftAssignment) =>
      b.employee_id === copyFromId && b.start_date <= copyTo && b.end_date >= copyFrom
    );
    if (sourceBulks.length === 0) {
      toast({ title: "ต้นแบบไม่มีกะในช่วงนี้", variant: "destructive" }); return;
    }
    setBusy(true);
    const rows: any[] = [];
    Array.from(selectedIds).forEach((empId) => {
      if (empId === copyFromId) return;
      sourceBulks.forEach((b: ShiftAssignment) => {
        rows.push({
          employee_id: empId, shift_id: b.shift_id,
          start_date: b.start_date < copyFrom ? copyFrom : b.start_date,
          end_date: b.end_date > copyTo ? copyTo : b.end_date,
          assignment_type: "bulk",
        });
      });
    });
    if (rows.length === 0) { setBusy(false); return; }
    const { error } = await supabase.from("shift_assignments").insert(rows);
    setBusy(false);
    if (error) toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
    else { toast({ title: `คัดลอกกะสำเร็จ ${rows.length} รายการ` }); onChanged(); }
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
        {/* Action 1: bulk shift */}
        <div className="card-base p-4 space-y-3">
          <h4 className="font-bold text-sm">① กำหนดกะเดียวกันให้พนักงานหลายคน</h4>
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">เลือกกะ</label>
            <select value={bulkShiftId} onChange={(e) => setBulkShiftId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border outline-none bg-muted/30 cursor-pointer">
              <option value="">-- เลือกกะ --</option>
              {shifts.map((s: Shift) => <option key={s.id} value={s.id}>{s.name} ({s.start_time}-{s.end_time})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">เริ่ม</label>
              <ThaiDatePicker value={bulkFrom} onChange={setBulkFrom} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">สิ้นสุด</label>
              <ThaiDatePicker value={bulkTo} onChange={setBulkTo} />
            </div>
          </div>
          <button onClick={applyBulkShift} disabled={busy}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-bold text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))" }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            กำหนดกะให้ {selectedIds.size} คน
          </button>
        </div>

        {/* Action 2: copy shifts */}
        <div className="card-base p-4 space-y-3">
          <h4 className="font-bold text-sm">② คัดลอกกะจากต้นแบบ</h4>
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">เลือกพนักงานต้นแบบ</label>
            <SearchableSelect value={copyFromId} onChange={setCopyFromId} options={empOptions} placeholder="-- เลือกต้นแบบ --" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">ช่วงเริ่ม</label>
              <ThaiDatePicker value={copyFrom} onChange={setCopyFrom} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">ช่วงสิ้นสุด</label>
              <ThaiDatePicker value={copyTo} onChange={setCopyTo} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">จะคัดลอกกะระยะยาวของต้นแบบในช่วงที่เลือก ไปยังพนักงานปลายทาง ({selectedIds.size} คน)</p>
          <button onClick={copyShifts} disabled={busy}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-bold text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))" }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
            คัดลอกกะ
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShiftManagement;
