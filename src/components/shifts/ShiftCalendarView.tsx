import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Clock, X, Users, Plus, Search, Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  color: string;
}

interface Employee {
  id: string;
  name: string;
  department: string;
  position: string;
}

interface ShiftAssignment {
  id: string;
  employee_id: string;
  shift_id: string;
  start_date: string;
  end_date: string;
  assignment_type: string;
}

interface ShiftCalendarViewProps {
  shifts: Shift[];
  bulkAssignments: ShiftAssignment[];
  dayAssignments: ShiftAssignment[];
  employees: Employee[];
  onAddDayShift?: (dateStr: string, employeeId: string, shiftId: string) => void;
  onRemoveDayShift?: (dateStr: string, employeeId: string) => void;
}

const THAI_MONTHS_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const THAI_WEEKDAYS_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const toDateStr = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

interface DaySelection {
  dateStr: string;
  day: number;
}

const ShiftCalendarView = ({ shifts, bulkAssignments, dayAssignments, employees, onAddDayShift, onRemoveDayShift }: ShiftCalendarViewProps) => {
  const { toast } = useToast();
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState<DaySelection | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addShiftId, setAddShiftId] = useState<string>(shifts[0]?.id || "");
  const [addSearch, setAddSearch] = useState("");
  const [addSelectedEmps, setAddSelectedEmps] = useState<string[]>([]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const calendarCells = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const cells: { day: number | null; dateStr: string }[] = [];
    for (let i = 0; i < startDow; i++) cells.push({ day: null, dateStr: "" });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, dateStr: toDateStr(year, month, d) });
    return cells;
  }, [year, month]);

  const dayEntries = useMemo(() => {
    const map: Record<string, { employee: Employee; shift: Shift; source: "bulk" | "day" }[]> = {};

    bulkAssignments.forEach(a => {
      const emp = employees.find(e => e.id === a.employee_id);
      const shift = shifts.find(s => s.id === a.shift_id);
      if (!emp || !shift) return;
      const start = new Date(a.start_date);
      const end = new Date(a.end_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getMonth() === month && d.getFullYear() === year) {
          const ds = toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
          if (!map[ds]) map[ds] = [];
          if (!dayAssignments.some(da => da.employee_id === a.employee_id && da.start_date === ds)) {
            map[ds].push({ employee: emp, shift, source: "bulk" });
          }
        }
      }
    });

    dayAssignments.forEach(da => {
      const emp = employees.find(e => e.id === da.employee_id);
      const shift = shifts.find(s => s.id === da.shift_id);
      if (!emp || !shift) return;
      const d = new Date(da.start_date);
      if (d.getMonth() === month && d.getFullYear() === year) {
        if (!map[da.start_date]) map[da.start_date] = [];
        map[da.start_date].push({ employee: emp, shift, source: "day" });
      }
    });

    return map;
  }, [bulkAssignments, dayAssignments, employees, shifts, month, year]);

  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const selectedDayEntries = useMemo(() => {
    if (!selectedDay) return [];
    return dayEntries[selectedDay.dateStr] || [];
  }, [selectedDay, dayEntries]);

  const handleDayClick = (cell: { day: number | null; dateStr: string }) => {
    if (!cell.day) return;
    setSelectedDay({ dateStr: cell.dateStr, day: cell.day });
    setShowAddForm(false);
    setAddSelectedEmps([]);
    setAddSearch("");
  };

  const handleAddShifts = () => {
    if (!selectedDay || addSelectedEmps.length === 0 || !onAddDayShift) return;
    addSelectedEmps.forEach(empId => {
      onAddDayShift(selectedDay.dateStr, empId, addShiftId);
    });
    toast({ title: "เพิ่มกะสำเร็จ", description: `เพิ่มกะให้พนักงาน ${addSelectedEmps.length} คน` });
    setAddSelectedEmps([]);
    setShowAddForm(false);
  };

  const handleRemove = (dateStr: string, empId: string) => {
    if (!onRemoveDayShift) return;
    onRemoveDayShift(dateStr, empId);
    toast({ title: "ลบกะสำเร็จ", variant: "destructive" });
  };

  const availableEmployees = useMemo(() => {
    if (!selectedDay) return [];
    const assignedIds = new Set(selectedDayEntries.map(e => e.employee.id));
    return employees.filter(e => {
      const matchSearch = !addSearch || e.name.includes(addSearch);
      return matchSearch && !assignedIds.has(e.id);
    });
  }, [selectedDay, selectedDayEntries, employees, addSearch]);

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="card-base p-4">
        <div className="flex items-center justify-between">
          <button onClick={prevMonth} className="flex items-center gap-1 px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">
            <ChevronLeft className="w-4 h-4" /> ก่อนหน้า
          </button>
          <h3 className="text-lg font-bold font-display">{THAI_MONTHS_FULL[month]} {year + 543}</h3>
          <button onClick={nextMonth} className="flex items-center gap-1 px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">
            ถัดไป <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="card-base overflow-hidden">
        <div className="grid grid-cols-7">
          {THAI_WEEKDAYS_SHORT.map((wd, i) => (
            <div key={wd} className={cn("py-3 text-center text-xs font-bold uppercase tracking-wider border-b", i === 0 ? "text-destructive/70" : "text-muted-foreground")} style={{ borderColor: "hsl(var(--border))" }}>
              {wd}
            </div>
          ))}
          {calendarCells.map((cell, idx) => {
            if (cell.day === null) return <div key={`empty-${idx}`} className="min-h-[110px] bg-muted/10 border-b border-r" style={{ borderColor: "hsl(var(--border) / 0.4)" }} />;
            const entries = dayEntries[cell.dateStr] || [];
            const isToday = cell.dateStr === todayStr;
            const isSunday = idx % 7 === 0;
            const shiftGroups: Record<string, { shift: Shift; employees: Employee[] }> = {};
            entries.forEach(e => {
              if (!shiftGroups[e.shift.id]) shiftGroups[e.shift.id] = { shift: e.shift, employees: [] };
              shiftGroups[e.shift.id].employees.push(e.employee);
            });
            return (
              <div key={cell.dateStr} onClick={() => handleDayClick(cell)}
                className={cn("min-h-[110px] p-1.5 border-b border-r cursor-pointer transition-all hover:bg-primary/5 group", isToday && "bg-primary/5 ring-1 ring-inset ring-primary/30")}
                style={{ borderColor: "hsl(var(--border) / 0.4)" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className={cn("text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full", isToday && "bg-primary text-primary-foreground", isSunday && !isToday && "text-destructive/70")}>
                    {cell.day}
                  </span>
                  {entries.length > 0 && (
                    <span className="text-[10px] font-semibold text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">{entries.length} คน</span>
                  )}
                </div>
                <div className="space-y-0.5">
                  {Object.values(shiftGroups).slice(0, 3).map(({ shift, employees: emps }) => (
                    <div key={shift.id} className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold text-white truncate" style={{ background: shift.color }}>
                      <span className="truncate">{shift.name}</span>
                      <span className="ml-auto opacity-80 flex-shrink-0">{emps.length}</span>
                    </div>
                  ))}
                  {Object.values(shiftGroups).length > 3 && (
                    <div className="text-[10px] text-muted-foreground text-center font-medium">+{Object.values(shiftGroups).length - 3} กะ</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Shift Legend */}
      <div className="card-base p-4">
        <div className="flex flex-wrap gap-3">
          {shifts.map(s => (
            <div key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border" style={{ borderColor: `${s.color}40`, background: `${s.color}08` }}>
              <div className="w-3 h-3 rounded-full" style={{ background: s.color }} />
              <span className="text-sm font-semibold">{s.name}</span>
              <span className="text-xs text-muted-foreground">({s.start_time} - {s.end_time})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Day Detail Popup */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setSelectedDay(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-background rounded-2xl border shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-hidden animate-in zoom-in-95 fade-in duration-200"
            style={{ borderColor: "hsl(var(--border))" }} onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--muted) / 0.3)" }}>
              <div>
                <p className="text-xs text-muted-foreground">รายละเอียดประจำวัน</p>
                <h3 className="text-lg font-bold font-display">{selectedDay.day} {THAI_MONTHS_FULL[month]} {year + 543}</h3>
              </div>
              <button onClick={() => setSelectedDay(null)} className="p-2 rounded-xl hover:bg-muted transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto max-h-[65vh]">
              {selectedDayEntries.length === 0 && !showAddForm ? (
                <div className="text-center py-8">
                  <Clock className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground font-medium">ไม่มีพนักงานในกะ</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {shifts.map(shift => {
                    const entriesForShift = selectedDayEntries.filter(e => e.shift.id === shift.id);
                    if (entriesForShift.length === 0) return null;
                    return (
                      <div key={shift.id}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: shift.color }} />
                          <span className="text-sm font-bold" style={{ color: shift.color }}>{shift.name}</span>
                          <span className="text-xs text-muted-foreground">({shift.start_time} - {shift.end_time})</span>
                          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground"><Users className="w-3 h-3" />{entriesForShift.length}</span>
                        </div>
                        <div className="space-y-1.5">
                          {entriesForShift.map((entry, i) => (
                            <div key={`${entry.employee.id}-${i}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors hover:bg-muted/40" style={{ borderColor: `${shift.color}25` }}>
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: shift.color }}>
                                {entry.employee.name.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold truncate">{entry.employee.name}</div>
                                <div className="text-xs text-muted-foreground">{entry.employee.department}</div>
                              </div>
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${shift.color}15`, color: shift.color }}>
                                {entry.source === "day" ? "รายวัน" : "ประจำ"}
                              </span>
                              {onRemoveDayShift && entry.source === "day" && (
                                <button onClick={() => handleRemove(selectedDay.dateStr, entry.employee.id)} className="p-1 rounded-lg hover:bg-destructive/10 text-destructive/60 hover:text-destructive transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {selectedDayEntries.length > 0 && (
                    <div className="border-t pt-3 mt-3 flex items-center justify-between text-sm" style={{ borderColor: "hsl(var(--border))" }}>
                      <span className="text-muted-foreground">รวมพนักงานทั้งหมด</span>
                      <span className="font-bold">{selectedDayEntries.length} คน</span>
                    </div>
                  )}
                </div>
              )}

              {/* Add Shift Form */}
              {showAddForm && (
                <div className="mt-4 border rounded-xl p-4 space-y-3" style={{ borderColor: "hsl(var(--primary) / 0.3)", background: "hsl(var(--primary) / 0.03)" }}>
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <Plus className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} /> เพิ่มกะพนักงาน
                  </h4>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">เลือกกะ</label>
                    <div className="flex flex-wrap gap-2">
                      {shifts.map(s => (
                        <button key={s.id} type="button" onClick={() => setAddShiftId(s.id)}
                          className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all border", addShiftId === s.id ? "text-white shadow-md scale-105" : "hover:opacity-80")}
                          style={{ background: addShiftId === s.id ? s.color : `${s.color}15`, color: addShiftId === s.id ? "white" : s.color, borderColor: addShiftId === s.id ? s.color : `${s.color}40` }}>
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: addShiftId === s.id ? "white" : s.color }} />
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">เลือกพนักงาน</label>
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <input value={addSearch} onChange={e => setAddSearch(e.target.value)} placeholder="ค้นหาพนักงาน..." className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border outline-none bg-muted/30" />
                    </div>
                    <div className="max-h-36 overflow-y-auto border rounded-lg" style={{ borderColor: "hsl(var(--border))" }}>
                      {availableEmployees.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs text-muted-foreground">ไม่มีพนักงานที่เพิ่มได้</div>
                      ) : availableEmployees.map(emp => {
                        const sel = addSelectedEmps.includes(emp.id);
                        return (
                          <button key={emp.id} type="button" onClick={() => setAddSelectedEmps(prev => sel ? prev.filter(id => id !== emp.id) : [...prev, emp.id])}
                            className={cn("w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors border-b last:border-b-0", sel ? "bg-primary/10" : "hover:bg-muted/30")}
                            style={{ borderColor: "hsl(var(--border) / 0.5)" }}>
                            <div className={cn("w-4 h-4 rounded border flex items-center justify-center flex-shrink-0", sel ? "bg-primary border-primary" : "border-muted-foreground/30")}>
                              {sel && <Check className="w-2.5 h-2.5 text-white" />}
                            </div>
                            <span className="font-medium truncate">{emp.name}</span>
                            <span className="text-muted-foreground ml-auto">{emp.department}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-1">
                    <button onClick={() => { setShowAddForm(false); setAddSelectedEmps([]); }} className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted">ยกเลิก</button>
                    <button onClick={handleAddShifts} disabled={addSelectedEmps.length === 0}
                      className="px-4 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50" style={{ background: "hsl(var(--primary))" }}>
                      เพิ่ม {addSelectedEmps.length > 0 ? `(${addSelectedEmps.length} คน)` : ""}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t flex justify-between" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--muted) / 0.2)" }}>
              {!showAddForm ? (
                <button onClick={() => { setShowAddForm(true); setAddShiftId(shifts[0]?.id || ""); setAddSelectedEmps([]); setAddSearch(""); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90" style={{ background: "hsl(var(--primary))" }}>
                  <Plus className="w-3.5 h-3.5" /> เพิ่มกะ
                </button>
              ) : <div />}
              <button onClick={() => setSelectedDay(null)} className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">ปิด</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftCalendarView;
