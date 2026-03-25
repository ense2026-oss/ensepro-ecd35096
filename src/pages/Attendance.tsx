import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { usePendingCounts } from "@/contexts/PendingCountsContext";
import { Search, Download, CheckCircle, XCircle, Clock, AlertCircle, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Save, X, FileText, Check, RotateCcw, CalendarDays } from "lucide-react";
import { ThaiDatePicker } from "@/components/ui/thai-date-picker";
import { format } from "date-fns";
import { useEmployees } from "@/contexts/EmployeeContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import TimeInput24 from "@/components/ui/time-input-24";
import { useTimeEditRequests, type TimeEditRequest } from "@/contexts/TimeEditContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";

interface AttendanceRecord {
  id: string;
  employeeId: string;
  name: string;
  dept: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: string;
  late: boolean;
  ot: number;
}

const statusConf: Record<string, { label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; bg: string }> = {
  present: { label: "มาทำงาน", icon: CheckCircle, color: "hsl(90 100% 30%)", bg: "hsl(90 100% 92%)" },
  late: { label: "มาสาย", icon: Clock, color: "#FF870F", bg: "hsl(31 100% 93%)" },
  absent: { label: "ขาดงาน", icon: XCircle, color: "hsl(0 84% 50%)", bg: "hsl(0 84% 95%)" },
  leave: { label: "ลางาน", icon: CalendarIcon, color: "hsl(220 90% 45%)", bg: "hsl(220 90% 93%)" },
};

const reqStatusConf: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "รออนุมัติ", color: "#FF870F", bg: "hsl(31 100% 93%)" },
  approved: { label: "อนุมัติแล้ว", color: "hsl(90 100% 30%)", bg: "hsl(90 100% 92%)" },
  rejected: { label: "ไม่อนุมัติ", color: "hsl(0 84% 50%)", bg: "hsl(0 84% 95%)" },
};

const Attendance = () => {
  const { employees } = useEmployees();
  const { role } = useAuth();
  const { canAction } = usePermissions();
  const canApproveTime = canAction(role, 'attendance', 'approve');
  const { setAttendancePending } = usePendingCounts();
  const { editRequests, addEditRequest, updateRequestStatus } = useTimeEditRequests();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const employeeDropdownRef = useRef<HTMLDivElement>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeView, setActiveView] = useState<"attendance" | "requests">("attendance");

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<AttendanceRecord | null>(null);
  const [editForm, setEditForm] = useState({ newCheckIn: "", newCheckOut: "", reason: "" });

  // New request dialog
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({ employeeName: "", employeeId: "", date: "", originalCheckIn: "", originalCheckOut: "", newCheckIn: "", newCheckOut: "", reason: "" });

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailReq, setDetailReq] = useState<TimeEditRequest | null>(null);

  const attendanceRealtimeRef = useRef<ReturnType<typeof setTimeout>>();

  // Fetch attendance from DB
  const fetchAttendance = useCallback(async () => {
    const { data, error } = await supabase
      .from("attendance_records")
      .select("*, employees(first_name, last_name, dept)")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("โหลดข้อมูลบันทึกเวลาไม่สำเร็จ");
      setLoading(false);
      return;
    }

    setAttendance((data ?? []).map((r: any) => ({
      id: r.id,
      employeeId: r.employee_id,
      name: r.employees ? `${r.employees.first_name} ${r.employees.last_name}` : "",
      dept: r.employees?.dept || "",
      date: r.date,
      checkIn: r.check_in,
      checkOut: r.check_out,
      status: r.status,
      late: r.late,
      ot: Number(r.ot_hours) || 0,
    })));
    setLoading(false);
  }, []);

  const debouncedFetchAttendance = useCallback(() => {
    if (attendanceRealtimeRef.current) clearTimeout(attendanceRealtimeRef.current);
    attendanceRealtimeRef.current = setTimeout(() => fetchAttendance(), 300);
  }, [fetchAttendance]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  useEffect(() => {
    const channel = supabase
      .channel("attendance-page-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_records" }, debouncedFetchAttendance)
      .subscribe();

    return () => {
      if (attendanceRealtimeRef.current) clearTimeout(attendanceRealtimeRef.current);
      supabase.removeChannel(channel);
    };
  }, [debouncedFetchAttendance]);

  const allNames = useMemo(() => {
    const names = new Set(attendance.map((a) => a.name));
    return Array.from(names).sort();
  }, [attendance]);

  const filteredEmployeeOptions = useMemo(() => {
    if (!employeeSearch) return allNames;
    return allNames.filter((n) => n.includes(employeeSearch));
  }, [allNames, employeeSearch]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(e.target as Node)) {
        setShowEmployeeDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    setAttendancePending(editRequests.filter((r) => r.status === "pending").length);
  }, [editRequests, setAttendancePending]);

  const filtered = useMemo(() => attendance.filter((a) => {
    const matchSearch = a.name.includes(search) || a.dept.includes(search);
    const matchStatus = filterStatus === "all" || a.status === filterStatus;
    const matchEmployee = filterEmployee === "all" || a.name === filterEmployee;
    return matchSearch && matchStatus && matchEmployee;
  }), [attendance, search, filterStatus, filterEmployee]);

  const summary = useMemo(() => ({
    present: attendance.filter((a) => a.status === "present").length,
    late: attendance.filter((a) => a.status === "late").length,
    absent: attendance.filter((a) => a.status === "absent").length,
    leave: attendance.filter((a) => a.status === "leave").length,
  }), [attendance]);

  const openEdit = (row: AttendanceRecord) => {
    setEditingRow(row);
    setEditForm({ newCheckIn: row.checkIn === "-" ? "" : row.checkIn, newCheckOut: row.checkOut === "-" ? "" : row.checkOut, reason: "" });
    setEditOpen(true);
  };

  const handleEditSave = () => {
    if (!editingRow || !editForm.reason.trim()) {
      toast.error("กรุณาระบุเหตุผลในการแก้ไข");
      return;
    }
    if (!editForm.newCheckIn || !editForm.newCheckOut) {
      toast.error("กรุณาระบุเวลาเข้า-ออกใหม่");
      return;
    }
    addEditRequest({
      attendanceId: editingRow.id,
      employeeId: editingRow.employeeId,
      employeeName: editingRow.name,
      date: editingRow.date,
      originalCheckIn: editingRow.checkIn,
      originalCheckOut: editingRow.checkOut,
      newCheckIn: editForm.newCheckIn,
      newCheckOut: editForm.newCheckOut,
      reason: editForm.reason,
    });
    setEditOpen(false);
    toast.success("ส่งคำขอแก้ไขเวลาเรียบร้อย");
  };

  const openNewRequest = () => {
    setRequestForm({ employeeName: "", employeeId: "", date: "", originalCheckIn: "", originalCheckOut: "", newCheckIn: "", newCheckOut: "", reason: "" });
    setRequestOpen(true);
  };

  const handleRequestSave = () => {
    if (!requestForm.employeeId || !requestForm.newCheckIn || !requestForm.newCheckOut || !requestForm.reason.trim()) {
      toast.error("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    addEditRequest({
      employeeId: requestForm.employeeId,
      employeeName: requestForm.employeeName,
      date: requestForm.date || new Date().toISOString().slice(0, 10),
      originalCheckIn: requestForm.originalCheckIn || "-",
      originalCheckOut: requestForm.originalCheckOut || "-",
      newCheckIn: requestForm.newCheckIn,
      newCheckOut: requestForm.newCheckOut,
      reason: requestForm.reason,
    });
    setRequestOpen(false);
    toast.success("ส่งคำขอแก้ไขเวลาเรียบร้อย");
  };

  const handleApprove = async (reqId: string) => {
    const req = editRequests.find((r) => r.id === reqId);
    if (req && req.attendanceId) {
      const newCheckIn = req.newCheckIn;
      const isLate = newCheckIn > "08:30";
      await supabase.from("attendance_records").update({
        check_in: req.newCheckIn,
        check_out: req.newCheckOut,
        late: isLate,
        status: newCheckIn === "-" ? "absent" : isLate ? "late" : "present",
      }).eq("id", req.attendanceId);
      fetchAttendance();
    }
    updateRequestStatus(reqId, "approved");
    toast.success("อนุมัติคำขอแก้ไขเวลาเรียบร้อย");
    setDetailOpen(false);
  };

  const handleReject = (reqId: string) => {
    updateRequestStatus(reqId, "rejected");
    toast.success("ปฏิเสธคำขอแก้ไขเวลาเรียบร้อย");
    setDetailOpen(false);
  };

  const openDetail = (req: TimeEditRequest) => {
    setDetailReq(req);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display">บันทึกเวลาเข้าออกงาน</h2>
          <p className="text-sm text-muted-foreground mt-0.5">ข้อมูลจากฐานข้อมูล</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">
            <Download className="w-4 h-4" />
            Export Excel
          </button>
          <button
            onClick={openNewRequest}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", color: "hsl(var(--primary-foreground))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}
          >
            <AlertCircle className="w-4 h-4" />
            ขอแก้ไขเวลา
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(summary).map(([key, val]) => {
          const conf = statusConf[key];
          const Icon = conf.icon;
          return (
            <div
              key={key}
              className="card-base p-4 cursor-pointer transition-all duration-200"
              style={{ borderLeft: `4px solid ${conf.color}` }}
              onClick={() => setFilterStatus(filterStatus === key ? "all" : key)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{conf.label}</p>
                  <p className="text-2xl font-bold font-display mt-1" style={{ color: conf.color }}>{val}</p>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: conf.bg }}>
                  <Icon className="w-5 h-5" style={{ color: conf.color }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveView("attendance")}
          className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: activeView === "attendance" ? "hsl(var(--primary))" : "transparent",
            color: activeView === "attendance" ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
            border: activeView === "attendance" ? "none" : "1px solid hsl(var(--border))",
          }}
        >
          <Clock className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          บันทึกเวลา
        </button>
        <button
          onClick={() => setActiveView("requests")}
          className="px-4 py-2 rounded-xl text-sm font-semibold transition-all relative"
          style={{
            background: activeView === "requests" ? "hsl(var(--primary))" : "transparent",
            color: activeView === "requests" ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
            border: activeView === "requests" ? "none" : "1px solid hsl(var(--border))",
          }}
        >
          <FileText className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          คำขอแก้ไขเวลา
          {editRequests.filter((r) => r.status === "pending").length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white" style={{ background: "hsl(0 84% 50%)" }}>
              {editRequests.filter((r) => r.status === "pending").length}
            </span>
          )}
        </button>
      </div>

      {activeView === "attendance" ? (
        <>
          {/* Filters */}
          <div className="card-base p-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative flex-1 min-w-[140px]" ref={employeeDropdownRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
                <input
                  type="text"
                  placeholder="กรองพนักงาน..."
                  value={filterEmployee === "all" ? employeeSearch : filterEmployee}
                  onChange={(e) => {
                    setEmployeeSearch(e.target.value);
                    setFilterEmployee("all");
                    setShowEmployeeDropdown(true);
                  }}
                  onFocus={() => setShowEmployeeDropdown(true)}
                  className="w-full pl-9 pr-7 py-2 text-sm rounded-xl border bg-muted/30 outline-none"
                />
                {filterEmployee !== "all" && (
                  <button
                    onClick={() => { setFilterEmployee("all"); setEmployeeSearch(""); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
                {showEmployeeDropdown && filteredEmployeeOptions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-xl shadow-lg z-50 max-h-52 overflow-y-auto">
                    <button
                      onClick={() => { setFilterEmployee("all"); setEmployeeSearch(""); setShowEmployeeDropdown(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors text-muted-foreground"
                    >
                      พนักงานทั้งหมด
                    </button>
                    {filteredEmployeeOptions.map((name) => (
                      <button
                        key={name}
                        onClick={() => { setFilterEmployee(name); setEmployeeSearch(""); setShowEmployeeDropdown(false); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors font-medium"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="flex-1 min-w-[120px] px-3 py-2 text-sm rounded-xl border bg-muted/30 outline-none cursor-pointer"
              >
                <option value="all">ทุกสถานะ</option>
                <option value="present">มาทำงาน</option>
                <option value="late">มาสาย</option>
                <option value="absent">ขาดงาน</option>
                <option value="leave">ลางาน</option>
              </select>

              <div className="flex items-center gap-1.5 flex-1 min-w-[280px]">
                <ThaiDatePicker value={dateFrom} onChange={setDateFrom} placeholder="เริ่มต้น" className="flex-1" />
                <span className="text-xs text-muted-foreground">ถึง</span>
                <ThaiDatePicker value={dateTo} onChange={setDateTo} placeholder="สิ้นสุด" className="flex-1" />
                {(dateFrom || dateTo) && (
                  <button
                    onClick={() => { setDateFrom(""); setDateTo(""); }}
                    className="p-2 rounded-lg border hover:bg-muted transition-colors flex-shrink-0"
                    title="ล้างวันที่"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="card-base overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ borderColor: "hsl(var(--border))" }}>
                    {["พนักงาน", "แผนก", "เวลาเข้า", "เวลาออก", "OT (ชม.)", "สถานะ", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="text-center py-10 text-sm text-muted-foreground">กำลังโหลด...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-sm text-muted-foreground">ไม่พบข้อมูล</td></tr>
                  ) : filtered.map((row) => {
                    const conf = statusConf[row.status] || statusConf.present;
                    const Icon = conf.icon;
                    return (
                      <tr key={row.id} className="border-b hover:bg-muted/30 transition-colors" style={{ borderColor: "hsl(var(--border))" }}>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: "hsl(31 100% 93%)", color: "#FF870F" }}>
                              {row.name.charAt(0)}
                            </div>
                            <p className="text-sm font-semibold">{row.name}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-muted-foreground">{row.dept}</td>
                        <td className="px-4 py-3.5">
                          <span className={`text-sm font-medium ${row.late ? "text-orange-500" : "text-foreground"}`}>
                            {row.checkIn}
                            {row.late && <span className="ml-1 text-xs text-orange-500">(สาย)</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-sm">{row.checkOut}</td>
                        <td className="px-4 py-3.5">
                          {row.ot > 0 ? (
                            <span className="text-sm font-semibold" style={{ color: "hsl(90 100% 30%)" }}>+{row.ot} ชม.</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full w-fit" style={{ background: conf.bg, color: conf.color }}>
                            <Icon className="w-3.5 h-3.5" style={{ color: conf.color }} />
                            {conf.label}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <button onClick={() => openEdit(row)} className="text-xs font-medium px-2.5 py-1.5 rounded-lg border hover:bg-muted transition-colors flex items-center gap-1">
                            <RotateCcw className="w-3 h-3" />
                            แก้ไขเวลา
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* ═══ Requests View ═══ */
        <div className="card-base overflow-hidden">
          <div className="p-4 border-b" style={{ borderColor: "hsl(var(--border))" }}>
            <h3 className="text-sm font-bold">รายการคำขอแก้ไขเวลา ({editRequests.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: "hsl(var(--border))" }}>
                  {["พนักงาน", "วันที่", "เวลาเดิม", "เวลาใหม่", "เหตุผล", "สถานะ", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {editRequests.map((req) => {
                  const rs = reqStatusConf[req.status];
                  return (
                    <tr key={req.id} className="border-b hover:bg-muted/30 transition-colors" style={{ borderColor: "hsl(var(--border))" }}>
                      <td className="px-4 py-3 text-sm font-semibold">{req.employeeName}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{req.date}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{req.originalCheckIn} - {req.originalCheckOut}</td>
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: "#FF870F" }}>{req.newCheckIn} - {req.newCheckOut}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">{req.reason}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: rs.bg, color: rs.color }}>{rs.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => openDetail(req)} className="text-xs font-medium px-2.5 py-1.5 rounded-lg border hover:bg-muted transition-colors">
                          ดูรายละเอียด
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {editRequests.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-10 text-sm text-muted-foreground">ไม่มีคำขอแก้ไขเวลา</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ Edit Time Dialog ═══ */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <RotateCcw className="w-5 h-5 text-primary" />
              ขอแก้ไขเวลา — {editingRow?.name}
            </DialogTitle>
          </DialogHeader>
          {editingRow && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-muted/40">
                <div><p className="text-xs text-muted-foreground mb-1">เวลาเข้าเดิม</p><p className="text-sm font-semibold">{editingRow.checkIn}</p></div>
                <div><p className="text-xs text-muted-foreground mb-1">เวลาออกเดิม</p><p className="text-sm font-semibold">{editingRow.checkOut}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">เวลาเข้าใหม่ <span className="text-destructive">*</span></label>
                  <TimeInput24 value={editForm.newCheckIn} onChange={(v) => setEditForm((f) => ({ ...f, newCheckIn: v }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">เวลาออกใหม่ <span className="text-destructive">*</span></label>
                  <TimeInput24 value={editForm.newCheckOut} onChange={(v) => setEditForm((f) => ({ ...f, newCheckOut: v }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">เหตุผลในการแก้ไข <span className="text-destructive">*</span></label>
                <textarea value={editForm.reason} onChange={(e) => setEditForm((f) => ({ ...f, reason: e.target.value }))} rows={3} placeholder="ระบุเหตุผล เช่น ลืมสแกนนิ้ว, ระบบขัดข้อง..." className="w-full px-3 py-2.5 text-sm rounded-xl border bg-muted/30 outline-none resize-none" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <button onClick={() => setEditOpen(false)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">
              <X className="w-4 h-4" /> ยกเลิก
            </button>
            <button onClick={handleEditSave} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-primary-foreground" style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))" }}>
              <Save className="w-4 h-4" /> ส่งคำขอ
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ New Request Dialog ═══ */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <AlertCircle className="w-5 h-5 text-primary" />
              ขอแก้ไขเวลา (คำขอใหม่)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">พนักงาน <span className="text-destructive">*</span></label>
              <Select value={requestForm.employeeId} onValueChange={(val) => {
                const emp = employees.find(e => e.id === val);
                if (emp) {
                  const match = attendance.find((a) => a.employeeId === val);
                  setRequestForm((f) => ({
                    ...f,
                    employeeId: val,
                    employeeName: `${emp.firstName} ${emp.lastName}`,
                    originalCheckIn: match?.checkIn || "",
                    originalCheckOut: match?.checkOut || "",
                  }));
                }
              }}>
                <SelectTrigger className="rounded-xl border bg-muted/30">
                  <SelectValue placeholder="เลือกพนักงาน" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.prefix || ""}{emp.firstName} {emp.lastName} — {emp.position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {requestForm.originalCheckIn && (
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-muted/40">
                <div><p className="text-xs text-muted-foreground mb-1">เวลาเข้าเดิม</p><p className="text-sm font-semibold">{requestForm.originalCheckIn}</p></div>
                <div><p className="text-xs text-muted-foreground mb-1">เวลาออกเดิม</p><p className="text-sm font-semibold">{requestForm.originalCheckOut}</p></div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">เวลาเข้าใหม่ <span className="text-destructive">*</span></label>
                <TimeInput24 value={requestForm.newCheckIn} onChange={(v) => setRequestForm((f) => ({ ...f, newCheckIn: v }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">เวลาออกใหม่ <span className="text-destructive">*</span></label>
                <TimeInput24 value={requestForm.newCheckOut} onChange={(v) => setRequestForm((f) => ({ ...f, newCheckOut: v }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">เหตุผล <span className="text-destructive">*</span></label>
              <textarea value={requestForm.reason} onChange={(e) => setRequestForm((f) => ({ ...f, reason: e.target.value }))} rows={3} placeholder="ระบุเหตุผลในการขอแก้ไขเวลา..." className="w-full px-3 py-2.5 text-sm rounded-xl border bg-muted/30 outline-none resize-none" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button onClick={() => setRequestOpen(false)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">
              <X className="w-4 h-4" /> ยกเลิก
            </button>
            <button onClick={handleRequestSave} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-primary-foreground" style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))" }}>
              <Save className="w-4 h-4" /> ส่งคำขอ
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Detail / Approve Dialog ═══ */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <FileText className="w-5 h-5 text-primary" />
              รายละเอียดคำขอแก้ไขเวลา
            </DialogTitle>
          </DialogHeader>
          {detailReq && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">พนักงาน</p><p className="text-sm font-semibold mt-0.5">{detailReq.employeeName}</p></div>
                <div><p className="text-xs text-muted-foreground">วันที่</p><p className="text-sm font-semibold mt-0.5">{detailReq.date}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-muted/40">
                <div><p className="text-xs text-muted-foreground mb-1">เวลาเข้าเดิม</p><p className="text-sm font-semibold">{detailReq.originalCheckIn}</p></div>
                <div><p className="text-xs text-muted-foreground mb-1">เวลาออกเดิม</p><p className="text-sm font-semibold">{detailReq.originalCheckOut}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl" style={{ background: "hsl(31 100% 96%)" }}>
                <div><p className="text-xs text-muted-foreground mb-1">เวลาเข้าใหม่</p><p className="text-sm font-bold text-primary">{detailReq.newCheckIn}</p></div>
                <div><p className="text-xs text-muted-foreground mb-1">เวลาออกใหม่</p><p className="text-sm font-bold text-primary">{detailReq.newCheckOut}</p></div>
              </div>
              <div><p className="text-xs text-muted-foreground mb-1">เหตุผล</p><p className="text-sm p-3 rounded-xl bg-muted/40">{detailReq.reason}</p></div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">สถานะ:</p>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: reqStatusConf[detailReq.status].bg, color: reqStatusConf[detailReq.status].color }}>
                  {reqStatusConf[detailReq.status].label}
                </span>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            {detailReq?.status === "pending" && canApproveTime ? (
              <>
                <button onClick={() => detailReq && handleReject(detailReq.id)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background: "hsl(0 84% 50%)" }}>
                  <X className="w-4 h-4" /> ไม่อนุมัติ
                </button>
                <button onClick={() => detailReq && handleApprove(detailReq.id)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background: "hsl(90 100% 30%)" }}>
                  <Check className="w-4 h-4" /> อนุมัติ
                </button>
              </>
            ) : (
              <button onClick={() => setDetailOpen(false)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">
                ปิด
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Attendance;
