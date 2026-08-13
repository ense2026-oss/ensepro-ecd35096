import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { usePendingCounts } from "@/contexts/PendingCountsContext";
import { Search, Download, CheckCircle, XCircle, Clock, AlertCircle, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Save, X, FileText, Check, RotateCcw, CalendarDays, Eye, Upload } from "lucide-react";
import { ThaiDatePicker } from "@/components/ui/thai-date-picker";
import { format } from "date-fns";
import { useEmployees } from "@/contexts/EmployeeContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import TimeInput24 from "@/components/ui/time-input-24";
import SearchableSelect from "@/components/ui/searchable-select";
import { useTimeEditRequests, type TimeEditRequest } from "@/contexts/TimeEditContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { notifyRequester, notifyTierApprover } from "@/utils/notifications";
import EmployeeAvatar from "@/components/ui/employee-avatar";
import FaceScanFileImportDialog from "@/components/attendance/FaceScanFileImportDialog";


interface AttendanceRecord {
  id: string;
  employeeId: string;
  name: string;
  photoUrl?: string;
  dept: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: string;
  late: boolean;
  ot: number;
  otIn?: string;
  otOut?: string;
  virtual?: boolean;
  note?: string;
}

const statusConf: Record<string, { label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; bg: string }> = {
  present: { label: "มาทำงาน", icon: CheckCircle, color: "hsl(90 100% 30%)", bg: "hsl(90 100% 92%)" },
  late: { label: "มาสาย", icon: Clock, color: "#FF870F", bg: "hsl(31 100% 93%)" },
  absent: { label: "ขาดงาน", icon: XCircle, color: "hsl(0 84% 50%)", bg: "hsl(0 84% 95%)" },
  leave: { label: "ลางาน", icon: CalendarIcon, color: "hsl(220 90% 45%)", bg: "hsl(220 90% 93%)" },
  dayoff: { label: "วันหยุด", icon: CalendarDays, color: "hsl(260 40% 45%)", bg: "hsl(260 40% 94%)" },
  holiday: { label: "วันหยุดบริษัท", icon: CalendarDays, color: "hsl(260 40% 45%)", bg: "hsl(260 40% 94%)" },
};

const reqStatusConf: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "รออนุมัติ", color: "#FF870F", bg: "hsl(31 100% 93%)" },
  approved: { label: "อนุมัติแล้ว", color: "hsl(90 100% 30%)", bg: "hsl(90 100% 92%)" },
  rejected: { label: "ไม่อนุมัติ", color: "hsl(0 84% 50%)", bg: "hsl(0 84% 95%)" },
};

const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// Normalize a stored request date (ISO "yyyy-MM-dd" or Thai "D MMM YYYY") to ISO Gregorian.
const toISODate = (dateStr: string): string | null => {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const parts = dateStr.trim().split(/\s+/);
  if (parts.length === 3) {
    const d = parseInt(parts[0], 10);
    const mi = THAI_MONTHS_SHORT.indexOf(parts[1]);
    let y = parseInt(parts[2], 10);
    if (y > 2400) y -= 543; // tolerate Buddhist era years
    if (!isNaN(d) && mi >= 0 && !isNaN(y)) {
      return `${y}-${String(mi + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  return null;
};

// "yyyy-MM-dd" (or Thai short) → "1 ก.ค. 2569"
const formatThaiShort = (dateStr: string): string => {
  const iso = toISODate(dateStr);
  if (!iso) return dateStr || "-";
  const [y, m, d] = iso.split("-");
  return `${parseInt(d, 10)} ${THAI_MONTHS_SHORT[parseInt(m, 10) - 1]} ${parseInt(y, 10) + 543}`;
};

const todayLocal = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const addDaysLocal = (dateStr: string, days: number): string => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const lastDayOfMonthLocal = (year: number, month: number): string => {
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
};

const currentMonthLocal = (): string => String(new Date().getMonth() + 1).padStart(2, "0");

const Attendance = () => {
  const { employees } = useEmployees();
  const { role, user, currentUser } = useAuth();
  const { canAction, getScope } = usePermissions();
  const canApproveTime = canAction(role, 'attendance', 'approve');
  const canEditTime = canAction(role, 'attendance', 'edit');
  // ทุกคนสามารถ "ขอแก้ไขเวลา" ของตัวเองได้ แม้ไม่มีสิทธิ์แก้ไขของผู้อื่น
  const canRequestOwnEdit = true;
  const attendanceScope = getScope(role, 'attendance');
  const canExport = attendanceScope !== 'self';
  const { setAttendancePending } = usePendingCounts();
  const { editRequests, addEditRequest, updateRequestStatus } = useTimeEditRequests();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [otMap, setOtMap] = useState<Record<string, number>>({});
  const [otTimeMap, setOtTimeMap] = useState<Record<string, { start: string; end: string }>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const employeeDropdownRef = useRef<HTMLDivElement>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterMonth, setFilterMonth] = useState(currentMonthLocal);
  const [activeView, setActiveView] = useState<"attendance" | "requests">("attendance");
  const [importOpen, setImportOpen] = useState(false);


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
      .select("*, employees(first_name, last_name, dept, photo_url)")
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
      photoUrl: r.employees?.photo_url || undefined,
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

  // Fetch OT hours from overtime_requests (all statuses) and aggregate by employee + date
  const fetchOvertime = useCallback(async () => {
    const { data, error } = await supabase
      .from("overtime_requests")
      .select("employee_id, date, hours, status, start_time, end_time");
    if (error) return;
    const map: Record<string, number> = {};
    const timeMap: Record<string, { start: string; end: string }> = {};
    (data ?? []).forEach((r: any) => {
      const key = `${r.employee_id}|${r.date}`;
      map[key] = (map[key] || 0) + (Number(r.hours) || 0);
      const prev = timeMap[key];
      timeMap[key] = {
        start: prev?.start || r.start_time || "",
        end: r.end_time || prev?.end || "",
      };
    });
    setOtMap(map);
    setOtTimeMap(timeMap);
  }, []);

  // Leave days / company holidays / personal day-off patterns — used to label days with no record.
  const [leaveMap, setLeaveMap] = useState<Record<string, string>>({});
  const [holidayMap, setHolidayMap] = useState<Record<string, string>>({});
  const [dayoffPatterns, setDayoffPatterns] = useState<any[]>([]);
  const [dayoffOverrides, setDayoffOverrides] = useState<Record<string, boolean>>({});

  const fetchCalendarContext = useCallback(async () => {
    const [leaveRes, holidayRes, patternRes, overrideRes] = await Promise.all([
      supabase.from("leave_requests").select("employee_id, leave_type_name, date_from, date_to, status").neq("status", "rejected"),
      supabase.from("company_holidays").select("date, name"),
      supabase.from("employee_dayoff_patterns").select("employee_id, weekdays, effective_from, effective_to"),
      supabase.from("employee_dayoff_overrides").select("employee_id, date, is_dayoff"),
    ]);

    const lm: Record<string, string> = {};
    (leaveRes.data ?? []).forEach((r: any) => {
      const from = toISODate(r.date_from);
      const to = toISODate(r.date_to) || from;
      if (!from || !to) return;
      let cur = from;
      while (cur <= to) {
        lm[`${r.employee_id}|${cur}`] = r.leave_type_name || "ลางาน";
        cur = addDaysLocal(cur, 1);
      }
    });
    setLeaveMap(lm);

    const hm: Record<string, string> = {};
    (holidayRes.data ?? []).forEach((h: any) => { hm[h.date] = h.name; });
    setHolidayMap(hm);

    setDayoffPatterns(patternRes.data ?? []);
    const om: Record<string, boolean> = {};
    (overrideRes.data ?? []).forEach((o: any) => { om[`${o.employee_id}|${o.date}`] = o.is_dayoff; });
    setDayoffOverrides(om);
  }, []);

  useEffect(() => { fetchCalendarContext(); }, [fetchCalendarContext]);


  const debouncedFetchAttendance = useCallback(() => {
    if (attendanceRealtimeRef.current) clearTimeout(attendanceRealtimeRef.current);
    attendanceRealtimeRef.current = setTimeout(() => {
      fetchAttendance();
      fetchOvertime();
    }, 300);
  }, [fetchAttendance, fetchOvertime]);

  useEffect(() => {
    fetchAttendance();
    fetchOvertime();
  }, [fetchAttendance, fetchOvertime]);

  useEffect(() => {
    const channel = supabase
      .channel("attendance-page-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_records" }, debouncedFetchAttendance)
      .on("postgres_changes", { event: "*", schema: "public", table: "overtime_requests" }, debouncedFetchAttendance)
      .subscribe();

    return () => {
      if (attendanceRealtimeRef.current) clearTimeout(attendanceRealtimeRef.current);
      supabase.removeChannel(channel);
    };
  }, [debouncedFetchAttendance]);

  // Merge OT hours (from overtime_requests, all statuses) into each attendance row by employee + date.
  const attendanceWithOt = useMemo(
    () =>
      attendance.map((a) => {
        const key = `${a.employeeId}|${a.date}`;
        const otFromRequests = otMap[key] || 0;
        const t = otTimeMap[key];
        return { ...a, ot: otFromRequests || a.ot, otIn: t?.start || "", otOut: t?.end || "" };
      }),
    [attendance, otMap, otTimeMap]
  );

  // Enforce the configured permission scope on the client (defense-in-depth + correct counts).
  const scopedAttendance = useMemo(() => {
    if (attendanceScope === "all") return attendanceWithOt;
    if (attendanceScope === "department") {
      const myDept = currentUser?.dept || "";
      return attendanceWithOt.filter((a) => a.dept === myDept);
    }
    // self
    return attendanceWithOt.filter((a) => a.employeeId === currentUser?.employeeId);
  }, [attendanceWithOt, attendanceScope, currentUser?.dept, currentUser?.employeeId]);

  const allNames = useMemo(() => {
    const names = new Set(scopedAttendance.map((a) => a.name));
    return Array.from(names).sort();
  }, [scopedAttendance]);

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

  // Default the employee filter to the signed-in user (admin/hr/manager/executive included).
  const selfFilterInit = useRef(false);
  useEffect(() => {
    if (selfFilterInit.current) return;
    const myName = `${currentUser?.firstName ?? ""} ${currentUser?.lastName ?? ""}`.trim();
    if (!myName || allNames.length === 0) return;
    selfFilterInit.current = true;
    if (allNames.includes(myName)) {
      setFilterEmployee(myName);
      setEmployeeSearch(myName);
    }
  }, [allNames, currentUser?.firstName, currentUser?.lastName]);

  const filtered = useMemo(() => scopedAttendance.filter((a) => {
    const matchSearch = a.name.includes(search) || a.dept.includes(search);
    const matchStatus = filterStatus === "all" || a.status === filterStatus;
    const matchEmployee = filterEmployee === "all" || a.name === filterEmployee;
    const matchDate = (!dateFrom || a.date >= dateFrom) && (!dateTo || a.date <= dateTo);
    const matchMonth = !filterMonth || a.date.slice(5, 7) === filterMonth;
    // date range takes precedence over month; only one is active at a time.
    if (dateFrom || dateTo) return matchSearch && matchStatus && matchEmployee && matchDate;
    return matchSearch && matchStatus && matchEmployee && matchMonth;
  }).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.name.localeCompare(b.name))),
  [scopedAttendance, search, filterStatus, filterEmployee, dateFrom, dateTo, filterMonth]);

  // Selected employee (one person) → fill every day of the selected period, even without a record.
  const selectedEmployee = useMemo(() => {
    if (filterEmployee === "all") return null;
    const fromAttendance = scopedAttendance.find((a) => a.name === filterEmployee);
    if (fromAttendance) return { id: fromAttendance.employeeId, name: fromAttendance.name, dept: fromAttendance.dept, photoUrl: fromAttendance.photoUrl };
    const emp = employees.find((e: any) => `${e.firstName ?? e.first_name} ${e.lastName ?? e.last_name}` === filterEmployee);
    return emp ? { id: (emp as any).id, name: filterEmployee, dept: (emp as any).dept || "", photoUrl: (emp as any).photoUrl || (emp as any).photo_url } : null;
  }, [filterEmployee, scopedAttendance, employees]);

  const isDayoffFor = useCallback((empId: string, iso: string) => {
    const override = dayoffOverrides[`${empId}|${iso}`];
    if (override !== undefined) return override;
    const dow = new Date(iso + "T00:00:00").getDay();
    return dayoffPatterns.some((p: any) =>
      p.employee_id === empId &&
      (p.weekdays || []).includes(dow) &&
      p.effective_from <= iso &&
      (!p.effective_to || p.effective_to >= iso)
    );
  }, [dayoffOverrides, dayoffPatterns]);

  // Full-period rows: real records + generated rows for days with no record.
  const displayRows = useMemo(() => {
    if (!selectedEmployee) return filtered;

    const today = todayLocal();
    let start: string, end: string;
    if (dateFrom || dateTo) {
      start = dateFrom || dateTo;
      end = dateTo || dateFrom;
    } else if (filterMonth) {
      const year = new Date().getFullYear();
      const m = parseInt(filterMonth, 10);
      start = `${year}-${filterMonth}-01`;
      end = lastDayOfMonthLocal(year, m);
    } else {
      return filtered;
    }
    if (end > today) end = today;
    if (start > end) return filtered;

    const byDate = new Map(filtered.map((r) => [r.date, r]));
    const rows: AttendanceRecord[] = [];
    let cur = start;
    while (cur <= end) {
      const iso = cur;
      const existing = byDate.get(iso);
      if (existing) {
        rows.push(existing);
      } else {
        const leaveName = leaveMap[`${selectedEmployee.id}|${iso}`];
        const holidayName = holidayMap[iso];
        const status = leaveName ? "leave" : holidayName ? "holiday" : isDayoffFor(selectedEmployee.id, iso) ? "dayoff" : "absent";
        rows.push({
          id: `virtual-${iso}`,
          employeeId: selectedEmployee.id,
          name: selectedEmployee.name,
          photoUrl: selectedEmployee.photoUrl,
          dept: selectedEmployee.dept,
          date: iso,
          checkIn: "-",
          checkOut: "-",
          status,
          late: false,
          ot: otMap[`${selectedEmployee.id}|${iso}`] || 0,
          otIn: otTimeMap[`${selectedEmployee.id}|${iso}`]?.start || "",
          otOut: otTimeMap[`${selectedEmployee.id}|${iso}`]?.end || "",
          virtual: true,
          note: leaveName || holidayName || undefined,
        });
      }
      cur = addDaysLocal(cur, 1);
    }

    // Respect the status filter on generated rows too.
    const result = filterStatus === "all" ? rows : rows.filter((r) => r.status === filterStatus);
    return result;
  }, [selectedEmployee, filtered, dateFrom, dateTo, filterMonth, leaveMap, holidayMap, isDayoffFor, otMap, otTimeMap, filterStatus]);


  // Time-edit requests: show every request (no employee/month/date filtering).
  // Pending requests appear first, then sorted newest → oldest by createdAt.
  const filteredRequests = useMemo(() => {
    return editRequests
      .filter((r) => !search || r.employeeName.includes(search))
      .sort((a, b) => {
        const pendingA = a.status === "pending" ? 1 : 0;
        const pendingB = b.status === "pending" ? 1 : 0;
        if (pendingA !== pendingB) return pendingB - pendingA;
        return (b.createdAt || "") > (a.createdAt || "") ? 1 : -1;
      });
  }, [editRequests, search]);


  const summary = useMemo(() => ({
    present: scopedAttendance.filter((a) => a.status === "present").length,
    late: scopedAttendance.filter((a) => a.status === "late").length,
    absent: scopedAttendance.filter((a) => a.status === "absent").length,
    leave: scopedAttendance.filter((a) => a.status === "leave").length,
  }), [scopedAttendance]);

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
      attendanceId: editingRow.virtual ? undefined : editingRow.id,
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

  const applyAttendanceChange = async (req: TimeEditRequest) => {
    const newCheckIn = req.newCheckIn || "-";
    const newCheckOut = req.newCheckOut || "-";
    const isLate = newCheckIn !== "-" && newCheckIn > "08:30";
    const status = newCheckIn === "-" ? "absent" : isLate ? "late" : "present";

    // 1) If the request is tied to a specific attendance row, update it directly.
    if (req.attendanceId) {
      await supabase.from("attendance_records").update({
        check_in: newCheckIn,
        check_out: newCheckOut,
        late: isLate,
        status,
      }).eq("id", req.attendanceId);
    }

    // 2) Apply the change to the underlying check-in records + attendance by date,
    //    so requests created from the Check-in system (no attendanceId) also take effect.
    const isoDate = toISODate(req.date);
    if (isoDate) {
      // Update raw check-in records (this also re-syncs attendance via DB trigger).
      await supabase.from("check_in_records")
        .update({ check_in: newCheckIn, check_out: newCheckOut })
        .eq("employee_id", req.employeeId)
        .eq("date", isoDate);

      // Ensure the attendance row reflects exactly the approved values.
      await supabase.from("attendance_records")
        .upsert(
          {
            employee_id: req.employeeId,
            date: isoDate,
            check_in: newCheckIn,
            check_out: newCheckOut,
            late: isLate,
            status,
          },
          { onConflict: "employee_id,date" }
        );
    }

    fetchAttendance();
  };

  const handleApprove = async (reqId: string) => {
    const req = editRequests.find((r) => r.id === reqId);
    if (!req || !user?.id) return;

    // Prevent the same approver from acting twice
    const { data: existingLog } = await supabase
      .from("approval_logs")
      .select("id")
      .eq("request_id", reqId)
      .eq("request_type", "time_edit")
      .eq("approver_user_id", user.id)
      .maybeSingle();

    if (existingLog) {
      toast.error("คุณได้อนุมัติคำขอนี้ไปแล้ว");
      return;
    }

    const nextTier = (req.approvedTiers || 0) + 1;
    const totalTiers = req.totalTiers || 1;

    await supabase.from("approval_logs").insert({
      request_id: reqId,
      request_type: "time_edit",
      tier: nextTier,
      action: "approve",
      approver_user_id: user.id,
    });

    if (nextTier >= totalTiers) {
      // Final approval: apply the attendance change and mark approved
      await applyAttendanceChange(req);
      await supabase.from("time_edit_requests").update({
        status: "approved",
        approved_tiers: nextTier,
        current_tier: nextTier,
      }).eq("id", reqId);
      updateRequestStatus(reqId, "approved");
      toast.success("อนุมัติคำขอแก้ไขเวลาเรียบร้อย (ครบทุกระดับ)");
      setDetailOpen(false);
      notifyRequester(req.employeeId, {
        type: "approval",
        title: "คำขอแก้ไขเวลาได้รับการอนุมัติ",
        description: `คำขอแก้ไขเวลา ${req.date} (เข้า ${req.newCheckIn} / ออก ${req.newCheckOut}) ได้รับการอนุมัติแล้ว`,
        targetEmployee: req.employeeName,
      });
    } else {
      // Intermediate tier: advance to the next approver
      await supabase.from("time_edit_requests").update({
        approved_tiers: nextTier,
        current_tier: nextTier + 1,
      }).eq("id", reqId);
      toast.success(`อนุมัติระดับ ${nextTier}/${totalTiers} — รอระดับถัดไป`);
      setDetailOpen(false);
      notifyTierApprover("time_edit", nextTier, {
        type: "attendance",
        title: `คำขอแก้ไขเวลารอการอนุมัติ (ระดับ ${nextTier + 1}/${totalTiers})`,
        description: `${req.employeeName} ขอแก้ไขเวลา ${req.date} — ผ่านระดับ ${nextTier} แล้ว`,
        targetEmployee: req.employeeName,
      });
    }
  };

  const handleReject = async (reqId: string) => {
    const req = editRequests.find((r) => r.id === reqId);
    if (!req || !user?.id) return;

    const { data: existingLog } = await supabase
      .from("approval_logs")
      .select("id")
      .eq("request_id", reqId)
      .eq("request_type", "time_edit")
      .eq("approver_user_id", user.id)
      .maybeSingle();

    if (existingLog) {
      toast.error("คุณได้ดำเนินการกับคำขอนี้ไปแล้ว");
      return;
    }

    await supabase.from("approval_logs").insert({
      request_id: reqId,
      request_type: "time_edit",
      tier: (req.approvedTiers || 0) + 1,
      action: "reject",
      approver_user_id: user.id,
    });

    await supabase.from("time_edit_requests").update({ status: "rejected" }).eq("id", reqId);
    updateRequestStatus(reqId, "rejected");
    toast.success("ปฏิเสธคำขอแก้ไขเวลาเรียบร้อย");
    setDetailOpen(false);
    notifyRequester(req.employeeId, {
      type: "approval",
      title: "คำขอแก้ไขเวลาไม่ได้รับการอนุมัติ",
      description: `คำขอแก้ไขเวลา ${req.date} (เข้า ${req.newCheckIn} / ออก ${req.newCheckOut}) ไม่ได้รับการอนุมัติ`,
      targetEmployee: req.employeeName,
    });
  };

  const openDetail = (req: TimeEditRequest) => {
    setDetailReq(req);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display">บันทึกเวลาเข้าออกงาน</h2>
          <p className="text-sm text-muted-foreground mt-0.5">ข้อมูลจากฐานข้อมูล</p>
        </div>
        {(canExport || canEditTime || canRequestOwnEdit) && (
          <div className="flex items-center gap-2">
            {canEditTime && (
              <button
                onClick={() => setImportOpen(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors"
              >
                <Upload className="w-4 h-4" />
                นำเข้าจากเครื่องสแกน
              </button>
            )}
            {canExport && (
              <button className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">
                <Download className="w-4 h-4" />
                Export Excel
              </button>
            )}
            {(canEditTime || canRequestOwnEdit) && (
              <button
                onClick={openNewRequest}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
                style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", color: "hsl(var(--primary-foreground))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}
              >
                <AlertCircle className="w-4 h-4" />
                ขอแก้ไขเวลา
              </button>
            )}
          </div>
        )}
      </div>


      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Object.entries(summary).map(([key, val]) => {
          const conf = statusConf[key];
          const Icon = conf.icon;
          return (
            <div
              key={key}
              className="card-base p-2.5 cursor-pointer transition-all duration-200"
              style={{ borderLeft: `4px solid ${conf.color}` }}
              onClick={() => setFilterStatus(filterStatus === key ? "all" : key)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium">{conf.label}</p>
                  <p className="text-xl font-bold font-display mt-0.5" style={{ color: conf.color }}>{val}</p>
                </div>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: conf.bg }}>
                  <Icon className="w-4 h-4" style={{ color: conf.color }} />
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

      {/* Filters — attendance view only; the requests tab always shows every request */}
      {activeView === "attendance" && (
      <div className="card-base p-3">
        <div className="flex flex-wrap items-center gap-2">

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
                  className="w-full pl-9 pr-7 py-1.5 text-sm rounded-xl border bg-muted/30 outline-none"
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
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors text-muted-foreground"
                    >
                      พนักงานทั้งหมด
                    </button>
                    {filteredEmployeeOptions.map((name) => (
                      <button
                        key={name}
                        onClick={() => { setFilterEmployee(name); setEmployeeSearch(""); setShowEmployeeDropdown(false); }}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors font-medium"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {activeView === "attendance" && (
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-fit min-w-fit flex-shrink-0 px-2.5 py-1.5 text-sm rounded-xl border bg-muted/30 outline-none cursor-pointer"
                >
                  <option value="all">ทุกสถานะ</option>
                  <option value="present">มาทำงาน</option>
                  <option value="late">มาสาย</option>
                  <option value="absent">ขาดงาน</option>
                  <option value="leave">ลางาน</option>
                </select>
              )}

              <select
                value={filterMonth}
                onChange={(e) => {
                  const month = e.target.value;
                  setFilterMonth(month);
                  if (month) {
                    setDateFrom("");
                    setDateTo("");
                  }
                }}
                disabled={Boolean(dateFrom || dateTo)}
                className="px-2.5 py-1.5 text-sm rounded-xl border bg-muted/30 outline-none cursor-pointer w-[140px] flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">ทุกเดือน</option>
                <option value="01">มกราคม</option>
                <option value="02">กุมภาพันธ์</option>
                <option value="03">มีนาคม</option>
                <option value="04">เมษายน</option>
                <option value="05">พฤษภาคม</option>
                <option value="06">มิถุนายน</option>
                <option value="07">กรกฎาคม</option>
                <option value="08">สิงหาคม</option>
                <option value="09">กันยายน</option>
                <option value="10">ตุลาคม</option>
                <option value="11">พฤศจิกายน</option>
                <option value="12">ธันวาคม</option>
              </select>

              <div className="flex items-center gap-1.5 flex-1 min-w-[280px]">
                <ThaiDatePicker
                  value={dateFrom}
                  onChange={(v) => { setDateFrom(v); if (v) setFilterMonth(""); }}
                  placeholder="เริ่มต้น"
                  className="flex-1"
                  displayFormat="short"
                />
                <span className="text-xs text-muted-foreground">ถึง</span>
                <ThaiDatePicker
                  value={dateTo}
                  onChange={(v) => { setDateTo(v); if (v) setFilterMonth(""); }}
                  placeholder="สิ้นสุด"
                  className="flex-1"
                  displayFormat="short"
                />
                {(dateFrom || dateTo) && (
                  <button
                    onClick={() => { setDateFrom(""); setDateTo(""); setFilterMonth(currentMonthLocal()); }}
                    className="p-2 rounded-lg border hover:bg-muted transition-colors flex-shrink-0"
                    title="ล้างวันที่"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
          </div>
        </div>
      </div>
      )}


      {activeView === "attendance" ? (
        <>
          {/* Table */}
          <div className="card-base overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ borderColor: "hsl(var(--border))" }}>
                    {["วันที่", "พนักงาน", "แผนก", "เวลาเข้า", "เวลาออก", "เข้าโอที", "ออกโอที", "OT (ชม.)", "สถานะ", ""].map((h, i) => (
                      <th key={`${h}-${i}`} className="text-left px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={10} className="text-center py-6 text-sm text-muted-foreground">กำลังโหลด...</td></tr>
                  ) : displayRows.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-6 text-sm text-muted-foreground">ไม่พบข้อมูล</td></tr>
                  ) : displayRows.map((row) => {
                    const conf = statusConf[row.status] || statusConf.present;
                    const Icon = conf.icon;
                    return (
                      <tr key={row.id} className="border-b hover:bg-muted/30 transition-colors" style={{ borderColor: "hsl(var(--border))" }}>
                        <td className="px-3 py-1.5 text-sm font-medium whitespace-nowrap">{formatThaiShort(row.date)}</td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center justify-center">
                            <EmployeeAvatar photoUrl={row.photoUrl} firstName={row.name} size="sm" rounded="lg" />
                          </div>
                        </td>

                        <td className="px-3 py-1.5 text-sm text-muted-foreground">{row.dept}</td>
                        <td className="px-3 py-1.5">
                          <span className={`text-sm font-medium ${row.late ? "text-orange-500" : "text-foreground"}`}>
                            {row.checkIn}
                            {row.late && <span className="ml-1 text-[10px] text-orange-500">(สาย)</span>}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-sm">{row.checkOut}</td>
                        <td className="px-3 py-1.5 text-sm font-mono" style={{ color: row.otIn ? "hsl(270 70% 45%)" : undefined }}>{row.otIn || "-"}</td>
                        <td className="px-3 py-1.5 text-sm font-mono" style={{ color: row.otOut ? "hsl(330 70% 45%)" : undefined }}>{row.otOut || "-"}</td>
                        <td className="px-3 py-1.5">
                          {row.ot > 0 ? (
                            <span className="text-sm font-semibold" style={{ color: "hsl(90 100% 30%)" }}>+{row.ot} ชม.</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit" style={{ background: conf.bg, color: conf.color }}>
                            <Icon className="w-3 h-3" style={{ color: conf.color }} />
                            {row.note || conf.label}
                          </div>
                        </td>
                        <td className="px-3 py-1.5">
                          {(canEditTime || row.employeeId === currentUser?.employeeId) && row.status !== "holiday" && row.status !== "dayoff" ? (
                            <button onClick={() => openEdit(row)} className="text-[11px] font-medium px-2 py-1 rounded-lg border hover:bg-muted transition-colors flex items-center gap-1">
                              <RotateCcw className="w-3 h-3" />
                              แก้ไขเวลา
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
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
          <div className="p-3 border-b" style={{ borderColor: "hsl(var(--border))" }}>
            <h3 className="text-sm font-bold">รายการคำขอแก้ไขเวลา ({filteredRequests.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ borderColor: "hsl(var(--border))" }}>
                    {["วันที่", "พนักงาน", "เวลาเดิม", "เวลาใหม่", "เหตุผล", "สถานะ", ""].map((h, i) => (
                      <th key={`${h}-${i}`} className="text-left px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
              <tbody>
                {filteredRequests.map((req) => {
                  const rs = reqStatusConf[req.status];
                  const reqEmployee = employees.find((e) => e.id === req.employeeId);
                  return (
                    <tr key={req.id} className="border-b hover:bg-muted/30 transition-colors" style={{ borderColor: "hsl(var(--border))" }}>
                      <td className="px-3 py-1.5 text-sm font-medium whitespace-nowrap">{formatThaiShort(req.date)}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center justify-center">
                          <EmployeeAvatar photoUrl={reqEmployee?.photoUrl} firstName={req.employeeName} size="sm" rounded="lg" />
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-sm text-muted-foreground">{req.originalCheckIn} - {req.originalCheckOut}</td>
                      <td className="px-3 py-1.5 text-sm font-medium" style={{ color: "#FF870F" }}>{req.newCheckIn} - {req.newCheckOut}</td>
                      <td className="px-3 py-1.5 text-sm text-muted-foreground max-w-[200px] truncate">{req.reason}</td>
                      <td className="px-3 py-1.5">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: rs.bg, color: rs.color }}>{rs.label}</span>
                      </td>
                      <td className="px-3 py-1.5">
                        <button onClick={() => openDetail(req)} className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground" title="ดูรายละเอียด">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                  {filteredRequests.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-6 text-sm text-muted-foreground">ไม่มีคำขอแก้ไขเวลา</td></tr>
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
            <DialogDescription className="sr-only">ฟอร์มขอแก้ไขเวลาเข้า-ออกงาน</DialogDescription>
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
            <DialogDescription className="sr-only">ฟอร์มขอแก้ไขเวลาใหม่</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">พนักงาน <span className="text-destructive">*</span></label>
              <SearchableSelect
                value={requestForm.employeeId}
                onChange={(val) => {
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
                }}
                options={employees.map((emp) => ({
                  value: emp.id,
                  label: `${emp.prefix || ""}${emp.firstName} ${emp.lastName}`,
                  subtitle: emp.position,
                }))}
                placeholder="เลือกพนักงาน"
              />
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
            <DialogDescription className="sr-only">รายละเอียดคำขอแก้ไขเวลา</DialogDescription>
          </DialogHeader>
          {detailReq && (
            <div className="space-y-4 py-2 mx-[24px]">
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
