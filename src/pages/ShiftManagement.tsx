import { useState, useMemo, useEffect, useCallback } from "react";
import { Plus, Edit, Trash2, Search, CalendarDays, Clock, Users, X, Check, ChevronLeft, ChevronRight, List, LayoutGrid } from "lucide-react";
import ShiftCalendarView from "@/components/shifts/ShiftCalendarView";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ThaiDatePicker } from "@/components/ui/thai-date-picker";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

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

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const THAI_MONTHS_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const THAI_WEEKDAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสฯ", "ศุกร์", "เสาร์"];

const formatThaiDate = (dateStr: string): string => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
};

const toDateStr = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

const ShiftManagement = () => {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);

  // Dialog state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [deleteAssignId, setDeleteAssignId] = useState<string | null>(null);
  const [editAssignId, setEditAssignId] = useState<string | null>(null);
  const [assignForm, setAssignForm] = useState({
    selectedEmployees: [] as string[],
    shiftId: "",
    startDate: "",
    endDate: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");
  const [saving, setSaving] = useState(false);

  // Per-day calendar dialog state
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
  const [calendarEmployeeId, setCalendarEmployeeId] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [dayShiftPickerDate, setDayShiftPickerDate] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [shiftsRes, empRes, assignRes] = await Promise.all([
      supabase.from("shifts").select("*").order("sort_order"),
      supabase.from("employees").select("id, first_name, last_name, dept, position").eq("status", "active"),
      supabase.from("shift_assignments").select("*").order("created_at", { ascending: false }),
    ]);

    if (shiftsRes.data) setShifts(shiftsRes.data);
    if (empRes.data) {
      setEmployees(empRes.data.map(e => ({
        id: e.id,
        name: `${e.first_name} ${e.last_name}`,
        department: e.dept || "ไม่ระบุ",
        position: e.position || "",
      })));
    }
    if (assignRes.data) setAssignments(assignRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("shift-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "shift_assignments" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const departments = useMemo(() => {
    const deps = [...new Set(employees.map(e => e.department))];
    return deps.sort();
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      const matchSearch = !searchTerm || e.name.includes(searchTerm) || e.id.includes(searchTerm);
      const matchDept = filterDepartment === "all" || e.department === filterDepartment;
      return matchSearch && matchDept;
    });
  }, [employees, searchTerm, filterDepartment]);

  // Separate bulk and day assignments
  const bulkAssignments = useMemo(() => assignments.filter(a => a.assignment_type === "bulk"), [assignments]);
  const dayAssignments = useMemo(() => assignments.filter(a => a.assignment_type === "day"), [assignments]);

  const filteredAssignments = useMemo(() => {
    if (!assignmentFilter) return bulkAssignments;
    return bulkAssignments.filter(a => {
      const emp = employees.find(e => e.id === a.employee_id);
      return emp?.name.includes(assignmentFilter);
    });
  }, [bulkAssignments, assignmentFilter, employees]);

  const openAssignAdd = () => {
    setEditAssignId(null);
    setAssignForm({ selectedEmployees: [], shiftId: shifts[0]?.id || "", startDate: "", endDate: "" });
    setSearchTerm("");
    setFilterDepartment("all");
    setAssignDialogOpen(true);
  };

  const openAssignEdit = (a: ShiftAssignment) => {
    setEditAssignId(a.id);
    setAssignForm({ selectedEmployees: [a.employee_id], shiftId: a.shift_id, startDate: a.start_date, endDate: a.end_date });
    setSearchTerm("");
    setFilterDepartment("all");
    setAssignDialogOpen(true);
  };

  const toggleEmployee = (empId: string) => {
    setAssignForm(f => ({
      ...f,
      selectedEmployees: f.selectedEmployees.includes(empId)
        ? f.selectedEmployees.filter(id => id !== empId)
        : [...f.selectedEmployees, empId],
    }));
  };

  const handleAssignSave = async () => {
    if (assignForm.selectedEmployees.length === 0 || !assignForm.startDate || !assignForm.endDate || !assignForm.shiftId) return;
    setSaving(true);
    try {
      if (editAssignId) {
        const { error } = await supabase.from("shift_assignments").update({
          employee_id: assignForm.selectedEmployees[0],
          shift_id: assignForm.shiftId,
          start_date: assignForm.startDate,
          end_date: assignForm.endDate,
        }).eq("id", editAssignId);
        if (error) throw error;
        toast({ title: "แก้ไขสำเร็จ", description: "กำหนดกะพนักงานถูกอัปเดตแล้ว" });
      } else {
        const rows = assignForm.selectedEmployees.map(empId => ({
          employee_id: empId,
          shift_id: assignForm.shiftId,
          start_date: assignForm.startDate,
          end_date: assignForm.endDate,
          assignment_type: "bulk",
        }));
        const { error } = await supabase.from("shift_assignments").insert(rows);
        if (error) throw error;
        toast({ title: "กำหนดกะสำเร็จ", description: `เพิ่มกะให้พนักงาน ${rows.length} คนแล้ว` });
      }
      setAssignDialogOpen(false);
      fetchData();
    } catch (e: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAssignDelete = async () => {
    if (!deleteAssignId) return;
    const { error } = await supabase.from("shift_assignments").delete().eq("id", deleteAssignId);
    if (error) {
      toast({ title: "ลบไม่สำเร็จ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "ลบสำเร็จ", description: "ลบการกำหนดกะแล้ว", variant: "destructive" });
      fetchData();
    }
    setDeleteAssignId(null);
  };

  const getEmployeeName = (id: string) => employees.find(e => e.id === id)?.name || "ไม่ทราบชื่อ";
  const getShiftName = (id: string) => shifts.find(s => s.id === id)?.name || "-";
  const getShiftColor = (id: string) => shifts.find(s => s.id === id)?.color || "#888";

  // Calendar Dialog Logic
  const calendarEmployee = employees.find(e => e.id === calendarEmployeeId);
  const empDayAssigns = useMemo(() => {
    if (!calendarEmployeeId) return {};
    const map: Record<string, ShiftAssignment> = {};
    dayAssignments.filter(da => da.employee_id === calendarEmployeeId).forEach(da => { map[da.start_date] = da; });
    return map;
  }, [dayAssignments, calendarEmployeeId]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const lastDay = new Date(calendarYear, calendarMonth + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const cells: { day: number | null; dateStr: string }[] = [];
    for (let i = 0; i < startDayOfWeek; i++) cells.push({ day: null, dateStr: "" });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, dateStr: toDateStr(calendarYear, calendarMonth, d) });
    return cells;
  }, [calendarYear, calendarMonth]);

  const openCalendarDialog = (employeeId: string) => {
    setCalendarEmployeeId(employeeId);
    const now = new Date();
    setCalendarMonth(now.getMonth());
    setCalendarYear(now.getFullYear());
    setDayShiftPickerDate(null);
    setCalendarDialogOpen(true);
  };

  const handleAddDayShift = async (dateStr: string, shiftId: string) => {
    if (!calendarEmployeeId) return;
    // Remove existing day assignment for this date first
    const existing = dayAssignments.find(da => da.employee_id === calendarEmployeeId && da.start_date === dateStr && da.assignment_type === "day");
    if (existing) {
      await supabase.from("shift_assignments").delete().eq("id", existing.id);
    }
    const { error } = await supabase.from("shift_assignments").insert({
      employee_id: calendarEmployeeId, shift_id: shiftId,
      start_date: dateStr, end_date: dateStr, assignment_type: "day",
    });
    if (error) {
      toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "เพิ่มกะสำเร็จ", description: `กำหนดกะวันที่ ${formatThaiDate(dateStr)}` });
      fetchData();
    }
    setDayShiftPickerDate(null);
  };

  const handleRemoveDayShift = async (dateStr: string) => {
    if (!calendarEmployeeId) return;
    const existing = dayAssignments.find(da => da.employee_id === calendarEmployeeId && da.start_date === dateStr);
    if (existing) {
      await supabase.from("shift_assignments").delete().eq("id", existing.id);
      toast({ title: "ลบกะสำเร็จ", variant: "destructive" });
      fetchData();
    }
  };

  const prevMonth = () => {
    if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(y => y - 1); }
    else setCalendarMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(y => y + 1); }
    else setCalendarMonth(m => m + 1);
  };

  // Stats
  const totalAssigned = bulkAssignments.length;
  const uniqueEmployees = new Set(bulkAssignments.map(a => a.employee_id)).size;
  const shiftCounts = shifts.map(s => ({
    ...s,
    count: bulkAssignments.filter(a => a.shift_id === s.id).length,
  }));

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold font-display">จัดการกะทำงาน</h2>
        <p className="text-sm text-muted-foreground mt-0.5">กำหนดและจัดการกะการทำงานล่วงหน้าให้พนักงาน</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-base p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "hsl(var(--primary) / 0.15)" }}>
              <Users className="w-5 h-5" style={{ color: "hsl(var(--primary))" }} />
            </div>
            <div>
              <p className="text-2xl font-bold font-display">{uniqueEmployees}</p>
              <p className="text-xs text-muted-foreground">พนักงานที่มีกะ</p>
            </div>
          </div>
        </div>
        <div className="card-base p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "hsl(var(--primary) / 0.15)" }}>
              <CalendarDays className="w-5 h-5" style={{ color: "hsl(var(--primary))" }} />
            </div>
            <div>
              <p className="text-2xl font-bold font-display">{totalAssigned}</p>
              <p className="text-xs text-muted-foreground">การกำหนดกะทั้งหมด</p>
            </div>
          </div>
        </div>
        {shiftCounts.slice(0, 2).map(s => (
          <div key={s.id} className="card-base p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${s.color}20` }}>
                <Clock className="w-5 h-5" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-2xl font-bold font-display">{s.count}</p>
                <p className="text-xs text-muted-foreground">{s.name}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Shift Legend */}
      <div className="card-base p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          กะการทำงานที่ใช้งาน
        </h3>
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

      {/* View Toggle + Search + Add */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="flex items-center rounded-xl border p-1 gap-0.5" style={{ borderColor: "hsl(var(--border))" }}>
            <button onClick={() => setViewMode("table")} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all", viewMode === "table" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted")}>
              <List className="w-3.5 h-3.5" /> ตาราง
            </button>
            <button onClick={() => setViewMode("calendar")} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all", viewMode === "calendar" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted")}>
              <LayoutGrid className="w-3.5 h-3.5" /> ปฏิทิน
            </button>
          </div>
          {viewMode === "table" && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={assignmentFilter} onChange={(e) => setAssignmentFilter(e.target.value)} placeholder="ค้นหาพนักงาน..." className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border outline-none bg-muted/30 focus:ring-2 focus:ring-primary/20 transition-all" />
            </div>
          )}
        </div>
        <button onClick={openAssignAdd} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-primary-foreground flex-shrink-0 transition-all hover:opacity-90" style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}>
          <Plus className="w-4 h-4" /> กำหนดกะพนักงาน
        </button>
      </div>

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <ShiftCalendarView
          shifts={shifts}
          bulkAssignments={bulkAssignments}
          dayAssignments={dayAssignments}
          employees={employees}
          onAddDayShift={async (dateStr, employeeId, shiftId) => {
            const existing = dayAssignments.find(da => da.employee_id === employeeId && da.start_date === dateStr);
            if (existing) await supabase.from("shift_assignments").delete().eq("id", existing.id);
            await supabase.from("shift_assignments").insert({
              employee_id: employeeId, shift_id: shiftId,
              start_date: dateStr, end_date: dateStr, assignment_type: "day",
            });
            fetchData();
          }}
          onRemoveDayShift={async (dateStr, employeeId) => {
            const existing = dayAssignments.find(da => da.employee_id === employeeId && da.start_date === dateStr);
            if (existing) {
              await supabase.from("shift_assignments").delete().eq("id", existing.id);
              fetchData();
            }
          }}
        />
      )}

      {/* Table View */}
      {viewMode === "table" && (
        <div className="card-base overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: "hsl(var(--border))" }}>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">พนักงาน</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">กะ</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">วันที่เริ่ม</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">วันที่สิ้นสุด</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">กะรายวัน</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <CalendarDays className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground font-medium">
                      {assignmentFilter ? "ไม่พบข้อมูลที่ค้นหา" : "ยังไม่มีการกำหนดกะล่วงหน้า"}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">กดปุ่ม "กำหนดกะพนักงาน" เพื่อเริ่มต้น</p>
                  </td>
                </tr>
              ) : (
                filteredAssignments.map(a => {
                  const shiftColor = getShiftColor(a.shift_id);
                  const emp = employees.find(e => e.id === a.employee_id);
                  const empDayAssigns = dayAssignments.filter(da => da.employee_id === a.employee_id);
                  const dayShiftSummary = empDayAssigns.reduce<Record<string, number>>((acc, da) => {
                    acc[da.shift_id] = (acc[da.shift_id] || 0) + 1;
                    return acc;
                  }, {});
                  return (
                    <tr key={a.id} className="border-b hover:bg-muted/30 transition-colors" style={{ borderColor: "hsl(var(--border))" }}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: `${shiftColor}15`, color: shiftColor }}>
                            {emp?.name?.charAt(0) || "?"}
                          </div>
                          <div>
                            <div className="text-sm font-semibold">{getEmployeeName(a.employee_id)}</div>
                            <div className="text-xs text-muted-foreground">{emp?.department}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: `${shiftColor}20`, color: shiftColor }}>
                          {getShiftName(a.shift_id)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm">{formatThaiDate(a.start_date)}</td>
                      <td className="px-5 py-4 text-sm">{formatThaiDate(a.end_date)}</td>
                      <td className="px-5 py-4">
                        {empDayAssigns.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(dayShiftSummary).map(([sId, count]) => {
                              const s = shifts.find(sh => sh.id === sId);
                              return (
                                <span key={sId} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-white" style={{ background: s?.color || "#888" }}>
                                  {s?.name} ×{count}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => openCalendarDialog(a.employee_id)} className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-colors" title="จัดการกะรายวัน">
                            <CalendarDays className="w-4 h-4" />
                          </button>
                          <button onClick={() => openAssignEdit(a)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => setDeleteAssignId(a.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Assignment Dialog (Bulk) */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editAssignId ? "แก้ไขการกำหนดกะ" : "กำหนดกะการทำงานล่วงหน้า"}</DialogTitle>
            <DialogDescription className="sr-only">กำหนดกะการทำงานให้พนักงาน</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1.5">กะ</label>
                <select value={assignForm.shiftId} onChange={e => setAssignForm(f => ({ ...f, shiftId: e.target.value }))} className="w-full px-3 py-2.5 text-sm rounded-xl border outline-none bg-muted/30 cursor-pointer">
                  {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">วันที่เริ่ม</label>
                <ThaiDatePicker value={assignForm.startDate} onChange={v => setAssignForm(f => ({ ...f, startDate: v }))} placeholder="เลือกวันที่เริ่ม" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">วันที่สิ้นสุด</label>
                <ThaiDatePicker value={assignForm.endDate} onChange={v => setAssignForm(f => ({ ...f, endDate: v }))} placeholder="เลือกวันที่สิ้นสุด" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5">
                เลือกพนักงาน
                {assignForm.selectedEmployees.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-primary">เลือกแล้ว {assignForm.selectedEmployees.length} คน</span>
                )}
              </label>
              <div className="flex gap-2 mb-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="ค้นหาชื่อพนักงาน..." className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border outline-none bg-muted/30" />
                </div>
                <select value={filterDepartment} onChange={e => setFilterDepartment(e.target.value)} className="px-3 py-2 text-sm rounded-xl border outline-none bg-muted/30 cursor-pointer">
                  <option value="all">ทุกแผนก</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="border rounded-xl max-h-48 overflow-y-auto" style={{ borderColor: "hsl(var(--border))" }}>
                {filteredEmployees.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">ไม่พบพนักงาน</div>
                ) : (
                  filteredEmployees.map(emp => {
                    const isSelected = assignForm.selectedEmployees.includes(emp.id);
                    return (
                      <button key={emp.id} type="button" onClick={() => !editAssignId && toggleEmployee(emp.id)} disabled={!!editAssignId && !isSelected}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors border-b last:border-b-0 ${isSelected ? "bg-primary/10" : "hover:bg-muted/40"} disabled:opacity-50`}
                        style={{ borderColor: "hsl(var(--border))" }}>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">{emp.name}</div>
                          <div className="text-xs text-muted-foreground">{emp.department} · {emp.position}</div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {assignForm.selectedEmployees.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {assignForm.selectedEmployees.map(empId => (
                  <span key={empId} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-primary/15 text-primary">
                    {getEmployeeName(empId)}
                    {!editAssignId && <button onClick={() => toggleEmployee(empId)} className="hover:opacity-70"><X className="w-3 h-3" /></button>}
                  </span>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <button onClick={() => setAssignDialogOpen(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted">ยกเลิก</button>
            <button onClick={handleAssignSave} disabled={assignForm.selectedEmployees.length === 0 || !assignForm.startDate || !assignForm.endDate || saving}
              className="px-6 py-2 rounded-xl text-sm font-bold text-primary-foreground disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))" }}>
              {saving ? "กำลังบันทึก..." : editAssignId ? "บันทึก" : "กำหนดกะ"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Calendar Dialog (Individual) */}
      <Dialog open={calendarDialogOpen} onOpenChange={setCalendarDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center space-y-1">
              <div className="text-sm font-normal text-muted-foreground">จัดการพนักงานชื่อ : {calendarEmployee?.name}</div>
              <div className="text-lg font-bold font-display">{THAI_MONTHS_FULL[calendarMonth]} {calendarYear + 543}</div>
            </DialogTitle>
            <DialogDescription className="sr-only">ปฏิทินกะการทำงานรายบุคคล</DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="flex items-center gap-1 px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">
              <ChevronLeft className="w-4 h-4" /> เดือนที่แล้ว
            </button>
            <button onClick={nextMonth} className="flex items-center gap-1 px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">
              เดือนต่อไป <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-px rounded-xl border overflow-visible" style={{ borderColor: "hsl(var(--border))" }}>
            {THAI_WEEKDAYS.map(wd => (
              <div key={wd} className="bg-muted/50 px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground">{wd}</div>
            ))}
            {calendarDays.map((cell, idx) => {
              if (cell.day === null) return <div key={`empty-${idx}`} className="bg-muted/20 min-h-[80px]" />;
              const assigned = empDayAssigns[cell.dateStr];
              const assignedShift = assigned ? shifts.find(s => s.id === assigned.shift_id) : null;
              const isPickerOpen = dayShiftPickerDate === cell.dateStr;
              const isLastTwoRows = idx >= calendarDays.length - 14;
              return (
                <div key={cell.dateStr} className={cn("bg-background min-h-[80px] p-1.5 flex flex-col items-center gap-1 border-t", isPickerOpen ? "relative z-[100]" : "relative")} style={{ borderColor: "hsl(var(--border) / 0.5)" }}>
                  <span className="text-xs font-semibold text-muted-foreground">{cell.day}</span>
                  {assigned && assignedShift ? (
                    <button onClick={() => handleRemoveDayShift(cell.dateStr)} className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:opacity-80 cursor-pointer" style={{ background: assignedShift.color }} title={`${assignedShift.name} — คลิกเพื่อลบ`}>
                      {assignedShift.start_time.replace(":", ".")}
                    </button>
                  ) : (
                    <>
                      <button onClick={() => setDayShiftPickerDate(isPickerOpen ? null : cell.dateStr)} className="flex items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-bold text-white transition-all hover:opacity-80" style={{ background: "#22c55e" }}>
                        <Plus className="w-3 h-3" /> เพิ่ม
                      </button>
                      {isPickerOpen && (
                        <div className={cn("absolute left-1/2 -translate-x-1/2 z-50 bg-popover border rounded-xl shadow-lg p-1.5 min-w-[120px]", isLastTwoRows ? "bottom-full mb-1" : "top-full mt-1")} style={{ borderColor: "hsl(var(--border))" }}>
                          {shifts.map(s => (
                            <button key={s.id} onClick={() => handleAddDayShift(cell.dateStr, s.id)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-muted transition-colors text-left">
                              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: s.color }} />
                              {s.name}
                              <span className="text-muted-foreground ml-auto">{s.start_time}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            {shifts.map(s => (
              <div key={s.id} className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded-full" style={{ background: s.color }} />
                <span className="font-semibold">{s.name}</span>
                <span className="text-muted-foreground">({s.start_time} - {s.end_time})</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Assignment Confirmation */}
      <AlertDialog open={deleteAssignId !== null} onOpenChange={open => !open && setDeleteAssignId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
            <AlertDialogDescription>คุณต้องการลบการกำหนดกะนี้ใช่หรือไม่?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleAssignDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">ลบ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ShiftManagement;
