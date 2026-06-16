import { useState, useEffect, useCallback } from "react";
import {
  MapPin, Clock, CheckCircle, XCircle, Navigation, Loader2,
  LogIn, LogOut, AlertTriangle, Phone, Mail, Briefcase,
  Camera, FileEdit, X, ScanFace, Timer, Hourglass,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import TimeInput24 from "@/components/ui/time-input-24";
import { useTimeEditRequests } from "@/contexts/TimeEditContext";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { useGeolocation, findNearestLocation, type OfficeLocation, type NearestResult } from "@/utils/geo";
import { supabase } from "@/integrations/supabase/client";
import { notifyApprovers, getApprovalTiers } from "@/utils/notifications";

// Mock office locations
const officeLocations: OfficeLocation[] = [
  { id: 1, name: "สำนักงานใหญ่ กรุงเทพ", lat: "13.7563", lng: "100.5018", radius: 50000, active: true },
  { id: 2, name: "สาขาเชียงใหม่", lat: "18.7883", lng: "98.9853", radius: 50000, active: true },
  { id: 3, name: "สาขาภูเก็ต", lat: "7.8804", lng: "98.3923", radius: 50000, active: true },
];

const currentShift = { name: "กะเช้า", start: "08:00", end: "17:00" };

interface CheckInRecord {
  id: string;
  employeeId: string;
  date: string;
  checkIn: string;
  checkOut: string | null;
  location: string;
  withinRadius: boolean;
  source: "gps" | "face_scan";
  remark?: string;
}

interface OTRecord {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "pending" | "approved" | "rejected";
}

function computeRemark(record: CheckInRecord, shift: typeof currentShift): string | null {
  if (record.checkIn === "-") return record.remark || null;
  const toMinutes = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const shiftStart = toMinutes(shift.start);
  const checkInMin = toMinutes(record.checkIn);
  if (checkInMin > shiftStart) {
    const lateMin = checkInMin - shiftStart;
    return `สาย ${lateMin} นาที`;
  }
  if (record.checkOut && record.checkOut !== "-") {
    const shiftEnd = toMinutes(shift.end);
    const checkOutMin = toMinutes(record.checkOut);
    if (checkOutMin < shiftEnd) return record.remark?.includes("ลา") ? record.remark : "ออกก่อน";
  }
  return record.remark || null;
}

const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const formatThaiDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-");
  return `${parseInt(d, 10)} ${THAI_MONTHS_SHORT[parseInt(m, 10) - 1]} ${y}`;
};

const thaiDays = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const thaiMonths = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const DigitalClock = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const hours = String(time.getHours()).padStart(2, "0");
  const minutes = String(time.getMinutes()).padStart(2, "0");
  const seconds = String(time.getSeconds()).padStart(2, "0");
  const day = thaiDays[time.getDay()];
  const date = time.getDate();
  const month = thaiMonths[time.getMonth()];
  const year = time.getFullYear() + 543;

  return (
    <div className="flex flex-col items-center flex-shrink-0">
      <div className="flex items-baseline gap-0.5 font-mono">
        <span className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: "#FF870F" }}>{hours}</span>
        <span className="text-3xl sm:text-4xl font-bold animate-pulse" style={{ color: "#FF870F" }}>:</span>
        <span className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: "#FF870F" }}>{minutes}</span>
        <span className="text-lg sm:text-xl font-semibold text-muted-foreground ml-1">{seconds}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-1 text-center">วัน{day}ที่ {date} {month} พ.ศ. {year}</p>
    </div>
  );
};

const CheckIn = () => {
  const geo = useGeolocation();
  const { addEditRequest } = useTimeEditRequests();
  const { currentUser } = useAuth();

  const currentEmployee = {
    name: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "",
    position: currentUser?.position || "",
    department: currentUser?.dept || "",
    phone: "",
    email: currentUser?.email || "",
    initials: currentUser?.firstName?.charAt(0) || "",
  };

  const [history, setHistory] = useState<CheckInRecord[]>([]);
  const [otRecords, setOtRecords] = useState<OTRecord[]>([]);
  const [mode, setMode] = useState<"normal" | "ot">("normal");
  const [filterMonth, setFilterMonth] = useState<number>(new Date().getMonth());
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear() + 543);
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  // Find employee id for current user
  useEffect(() => {
    if (!currentUser) return;
    const findEmpId = async () => {
      const { data } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", currentUser.id)
        .maybeSingle();
      if (data) setEmployeeId(data.id);
    };
    findEmpId();
  }, [currentUser]);

  // Fetch check-in history
  const fetchHistory = useCallback(async () => {
    if (!employeeId) return;
    const { data } = await supabase
      .from("check_in_records")
      .select("*")
      .eq("employee_id", employeeId)
      .order("date", { ascending: false });
    if (data) {
      setHistory(data.map((r: any) => ({
        id: r.id,
        employeeId: r.employee_id,
        date: r.date,
        checkIn: r.check_in,
        checkOut: r.check_out,
        location: r.location,
        withinRadius: r.within_radius,
        source: r.source as "gps" | "face_scan",
        remark: r.remark,
      })));
    }
  }, [employeeId]);

  // Fetch OT records (overtime_requests) for this employee
  const fetchOtRecords = useCallback(async () => {
    if (!employeeId) return;
    const { data } = await supabase
      .from("overtime_requests")
      .select("id, date, start_time, end_time, status")
      .eq("employee_id", employeeId)
      .order("date", { ascending: false });
    if (data) {
      setOtRecords(data.map((r: any) => ({
        id: r.id,
        date: r.date,
        startTime: r.start_time,
        endTime: r.end_time,
        status: r.status as "pending" | "approved" | "rejected",
      })));
    }
  }, [employeeId]);

  useEffect(() => {
    fetchHistory();
    fetchOtRecords();
  }, [fetchHistory, fetchOtRecords]);

  // Realtime: refresh OT records when overtime_requests change
  useEffect(() => {
    if (!employeeId) return;
    const channel = supabase
      .channel("checkin-ot-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "overtime_requests" }, () => {
        fetchOtRecords();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [employeeId, fetchOtRecords]);

  const nearest: NearestResult | null =
    geo.lat !== null && geo.lng !== null
      ? findNearestLocation(geo.lat, geo.lng, officeLocations)
      : null;

  const canCheckIn = nearest?.withinRadius === true;

  const todayStr = (() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  })();

  const todayRecord = history.find((r) => r.date === todayStr);
  const todayCheckIn = todayRecord?.checkIn && todayRecord.checkIn !== "-" ? todayRecord.checkIn : null;
  const todayCheckOut = todayRecord?.checkOut && todayRecord.checkOut !== "-" ? todayRecord.checkOut : null;

  // OT map by date + today's OT record (latest open / latest of the day)
  const otByDate = otRecords.reduce<Record<string, OTRecord>>((acc, r) => {
    if (!acc[r.date]) acc[r.date] = r;
    return acc;
  }, {});
  const todayOt = otByDate[todayStr] || null;
  const todayOtIn = todayOt?.startTime && todayOt.startTime !== "" ? todayOt.startTime : null;
  const todayOtOut = todayOt?.endTime && todayOt.endTime !== "" ? todayOt.endTime : null;
  const otStatus = todayOtOut ? "ot-out" : todayOtIn ? "ot-in" : "ot-none";

  // Time edit request
  const [editOpen, setEditOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CheckInRecord | null>(null);
  const [editForm, setEditForm] = useState({ newCheckIn: "", newCheckOut: "", reason: "" });

  const openEditRequest = (record: CheckInRecord) => {
    setEditingRecord(record);
    setEditForm({
      newCheckIn: record.checkIn === "-" ? "" : record.checkIn,
      newCheckOut: record.checkOut === "-" || !record.checkOut ? "" : record.checkOut,
      reason: "",
    });
    setEditOpen(true);
  };

  const handleEditSubmit = () => {
    if (!editingRecord || !employeeId) return;
    if (!editForm.newCheckIn || !editForm.newCheckOut) {
      toast({ title: "กรุณาระบุเวลาเข้า-ออกใหม่", variant: "destructive" });
      return;
    }
    if (!editForm.reason.trim()) {
      toast({ title: "กรุณาระบุเหตุผล", variant: "destructive" });
      return;
    }
    addEditRequest({
      employeeId,
      employeeName: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "",
      date: formatThaiDate(editingRecord.date),
      originalCheckIn: editingRecord.checkIn,
      originalCheckOut: editingRecord.checkOut ?? "-",
      newCheckIn: editForm.newCheckIn,
      newCheckOut: editForm.newCheckOut,
      reason: editForm.reason,
    });
    toast({ title: "ส่งคำขอแก้ไขเวลาเรียบร้อย", description: `วันที่ ${formatThaiDate(editingRecord.date)} → เข้า ${editForm.newCheckIn} / ออก ${editForm.newCheckOut}` });
    setEditOpen(false);
  };

  const filteredHistory = history.filter((r) => {
    const parts = r.date.split("-");
    if (parts.length < 2) return false;
    const ceYear = parseInt(parts[0], 10);
    const buddhistYear = ceYear + 543;
    const m = parseInt(parts[1], 10) - 1;
    return buddhistYear === filterYear && m === filterMonth;
  });

  const currentBuddhistYear = new Date().getFullYear() + 543;
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentBuddhistYear - 2 + i);

  const nowTime = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const handleCheckIn = async () => {
    if (!canCheckIn || !nearest || !employeeId) return;
    const time = nowTime();
    // Save to check_in_records — DB trigger auto-syncs to attendance_records
    const { error: checkInError } = await supabase.from("check_in_records").insert({
      employee_id: employeeId,
      date: todayStr,
      check_in: time,
      location: nearest.location.name,
      within_radius: true,
      source: "gps",
    });
    if (checkInError) {
      toast({ title: "เกิดข้อผิดพลาด", description: checkInError.message, variant: "destructive" });
      return;
    }
    fetchHistory();
    toast({ title: "ลงเวลาเข้างานสำเร็จ", description: `เวลา ${time} ณ ${nearest.location.name}` });
  };

  const handleCheckOut = async () => {
    if (!canCheckIn || !nearest || !todayRecord || !employeeId) return;
    const time = nowTime();
    // Update check_in_records — DB trigger auto-syncs to attendance_records
    const { error: checkOutError } = await supabase.from("check_in_records").update({ check_out: time }).eq("id", todayRecord.id);
    if (checkOutError) {
      toast({ title: "เกิดข้อผิดพลาด", description: checkOutError.message, variant: "destructive" });
      return;
    }
    fetchHistory();
    toast({ title: "ลงเวลาออกงานสำเร็จ", description: `เวลา ${time} ณ ${nearest.location.name}` });
  };

  const calcOtHours = (start: string, end: string) => {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const diff = (eh * 60 + em - (sh * 60 + sm)) / 60;
    return Math.max(0, Math.round(diff * 10) / 10);
  };

  const handleOtCheckIn = async () => {
    if (!employeeId) return;
    const time = nowTime();
    const totalTiers = await getApprovalTiers("ot");
    const { error } = await supabase.from("overtime_requests").insert({
      employee_id: employeeId,
      date: todayStr,
      start_time: time,
      end_time: "",
      hours: 0,
      ot_type: "workday",
      reason: "บันทึก OT จากหน้าเช็คอิน",
      status: "pending",
      current_tier: 1,
      approved_tiers: 0,
      total_tiers: totalTiers,
    });
    if (error) {
      toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
      return;
    }
    fetchOtRecords();
    toast({ title: "บันทึกเวลาเข้า OT สำเร็จ", description: `เวลา ${time}` });
  };

  const handleOtCheckOut = async () => {
    if (!employeeId || !todayOt) return;
    const time = nowTime();
    const hours = calcOtHours(todayOt.startTime, time);
    const { error } = await supabase
      .from("overtime_requests")
      .update({ end_time: time, hours })
      .eq("id", todayOt.id);
    if (error) {
      toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
      return;
    }
    fetchOtRecords();
    toast({ title: "บันทึกเวลาออก OT สำเร็จ", description: `เวลา ${time} (${hours} ชม.) — ส่งคำขอรออนุมัติ` });
    notifyApprovers({
      type: "ot",
      title: "คำขอ OT ใหม่",
      description: `${currentEmployee.name} บันทึก OT ${todayOt.startTime}-${time} (${hours} ชม.) จากหน้าเช็คอิน`,
      targetEmployee: currentEmployee.name,
    });
  };

  const status = todayCheckOut ? "checked-out" : todayCheckIn ? "checked-in" : "not-checked";

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">

        {/* Widget 1: Check-in Button + Clock + Status */}
        <div
          className="card-base p-5 sm:p-6 flex flex-col items-center justify-center space-y-4 relative overflow-hidden"
          style={{
            background: canCheckIn
              ? "linear-gradient(135deg, hsl(var(--card)), hsl(90 100% 97%))"
              : status === "checked-out"
              ? "linear-gradient(135deg, hsl(var(--card)), hsl(220 90% 97%))"
              : "linear-gradient(135deg, hsl(var(--card)), hsl(31 100% 97%))",
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-full border-2 opacity-5" style={{ borderColor: canCheckIn ? "hsl(90 100% 40%)" : "hsl(var(--muted-foreground))" }} />
          </div>

          {/* Mode tabs: normal time vs OT */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/60 relative z-10">
            <button
              onClick={() => setMode("normal")}
              className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: mode === "normal" ? "hsl(var(--card))" : "transparent",
                color: mode === "normal" ? "hsl(90 100% 30%)" : "hsl(var(--muted-foreground))",
                boxShadow: mode === "normal" ? "0 1px 3px hsl(0 0% 0% / 0.1)" : "none",
              }}
            >
              <Clock className="w-3.5 h-3.5 inline mr-1" />เวลาปกติ
            </button>
            <button
              onClick={() => setMode("ot")}
              className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: mode === "ot" ? "hsl(var(--card))" : "transparent",
                color: mode === "ot" ? "hsl(270 70% 50%)" : "hsl(var(--muted-foreground))",
                boxShadow: mode === "ot" ? "0 1px 3px hsl(0 0% 0% / 0.1)" : "none",
              }}
            >
              <Timer className="w-3.5 h-3.5 inline mr-1" />โอที
            </button>
          </div>


          <div className="flex items-center gap-2 relative z-10">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: status === "checked-out" ? "hsl(220 90% 93%)" : status === "checked-in" ? "hsl(90 100% 92%)" : "hsl(31 100% 93%)" }}>
              {status === "checked-out" ? <CheckCircle className="w-4 h-4" style={{ color: "hsl(220 90% 50%)" }} /> : status === "checked-in" ? <Clock className="w-4 h-4" style={{ color: "hsl(90 100% 35%)" }} /> : <AlertTriangle className="w-4 h-4" style={{ color: "#FF870F" }} />}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold">{status === "checked-out" ? "ออกงานแล้ววันนี้" : status === "checked-in" ? "เข้างานแล้ววันนี้" : "ยังไม่ได้ลงเวลาวันนี้"}</span>
              {todayRecord?.source === "face_scan" && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1"><ScanFace className="w-3 h-3" /> บันทึกจากเครื่องสแกนหน้า</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/50 text-[11px] text-muted-foreground relative z-10">
            <Briefcase className="w-3 h-3" />
            <span>{currentShift.name} ({currentShift.start} - {currentShift.end})</span>
          </div>

          {(todayCheckIn || todayCheckOut) && (
            <div className="flex flex-wrap items-center justify-center gap-2 relative z-10">
              {todayCheckIn && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs" style={{ background: "hsl(90 100% 95%)" }}>
                  <LogIn className="w-3 h-3" style={{ color: "hsl(90 100% 35%)" }} />
                  <span style={{ color: "hsl(90 100% 30%)" }}>เข้างาน: {todayCheckIn}</span>
                </span>
              )}
              {todayCheckOut && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs" style={{ background: "hsl(31 100% 95%)" }}>
                  <LogOut className="w-3 h-3" style={{ color: "#FF870F" }} />
                  <span style={{ color: "hsl(31 100% 35%)" }}>ออกงาน: {todayCheckOut}</span>
                </span>
              )}
            </div>
          )}

          {(todayOtIn || todayOtOut) && (
            <div className="flex flex-wrap items-center justify-center gap-2 relative z-10">
              {todayOtIn && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs" style={{ background: "hsl(270 70% 95%)" }}>
                  <LogIn className="w-3 h-3" style={{ color: "hsl(270 70% 50%)" }} />
                  <span style={{ color: "hsl(270 70% 40%)" }}>เข้า OT: {todayOtIn}</span>
                </span>
              )}
              {todayOtOut && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs" style={{ background: "hsl(330 70% 95%)" }}>
                  <LogOut className="w-3 h-3" style={{ color: "hsl(330 70% 50%)" }} />
                  <span style={{ color: "hsl(330 70% 40%)" }}>ออก OT: {todayOtOut}</span>
                </span>
              )}
            </div>
          )}


          {mode === "normal" && (
            <>
          {status === "not-checked" && (
            <div className="relative flex items-center justify-center">
              {canCheckIn && <div className="checkin-wave-ring" style={{ "--wave-color": "hsl(90 100% 40%)" } as React.CSSProperties} />}
              <button
                onClick={handleCheckIn}
                disabled={!canCheckIn || geo.loading || !employeeId}
                className="w-28 h-28 sm:w-32 sm:h-32 rounded-full flex flex-col items-center justify-center gap-1.5 text-primary-foreground font-bold text-sm sm:text-base transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed relative z-10 hover:scale-105"
                style={{
                  background: canCheckIn ? "linear-gradient(135deg, hsl(90 100% 45%), hsl(90 100% 30%))" : "hsl(var(--muted))",
                  boxShadow: canCheckIn ? "0 8px 32px hsl(90 100% 30% / 0.4), 0 0 0 6px hsl(90 100% 40% / 0.15)" : "none",
                  color: canCheckIn ? "#fff" : "hsl(var(--muted-foreground))",
                }}
              >
                <LogIn className="w-6 h-6" />
                เข้างาน
              </button>
            </div>
          )}

          {status === "checked-in" && (
            <div className="relative flex items-center justify-center">
              {canCheckIn && <div className="checkin-wave-ring" style={{ "--wave-color": "#FF870F" } as React.CSSProperties} />}
              <button
                onClick={handleCheckOut}
                disabled={!canCheckIn || geo.loading}
                className="w-28 h-28 sm:w-32 sm:h-32 rounded-full flex flex-col items-center justify-center gap-1.5 font-bold text-sm sm:text-base transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed relative z-10 hover:scale-105"
                style={{
                  background: canCheckIn ? "linear-gradient(135deg, #FF870F, hsl(31 100% 55%))" : "hsl(var(--muted))",
                  boxShadow: canCheckIn ? "0 8px 32px hsl(31 100% 50% / 0.4), 0 0 0 6px hsl(31 100% 50% / 0.15)" : "none",
                  color: canCheckIn ? "#fff" : "hsl(var(--muted-foreground))",
                }}
              >
                <LogOut className="w-6 h-6" />
                ออกงาน
              </button>
            </div>
          )}

          {status === "checked-out" && (
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full flex flex-col items-center justify-center gap-1.5 relative z-10" style={{ background: "linear-gradient(135deg, hsl(220 90% 93%), hsl(220 90% 88%))", color: "hsl(220 90% 45%)", boxShadow: "0 0 0 6px hsl(220 90% 50% / 0.1)" }}>
              <CheckCircle className="w-6 h-6" />
              <span className="font-bold text-sm">เสร็จสิ้น</span>
            </div>
          )}
            </>
          )}

          {mode === "ot" && (
            <>
          {otStatus === "ot-none" && (
            <button
              onClick={handleOtCheckIn}
              disabled={geo.loading || !employeeId}
              className="w-28 h-28 sm:w-32 sm:h-32 rounded-full flex flex-col items-center justify-center gap-1.5 font-bold text-sm sm:text-base transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed relative z-10 hover:scale-105"
              style={{
                background: "linear-gradient(135deg, hsl(270 70% 60%), hsl(270 70% 45%))",
                boxShadow: "0 8px 32px hsl(270 70% 45% / 0.4), 0 0 0 6px hsl(270 70% 50% / 0.15)",
                color: "#fff",
              }}
            >
              <Timer className="w-6 h-6" />
              เข้า OT
            </button>
          )}

          {otStatus === "ot-in" && (
            <button
              onClick={handleOtCheckOut}
              disabled={geo.loading || !employeeId}
              className="w-28 h-28 sm:w-32 sm:h-32 rounded-full flex flex-col items-center justify-center gap-1.5 font-bold text-sm sm:text-base transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed relative z-10 hover:scale-105"
              style={{
                background: "linear-gradient(135deg, hsl(330 70% 60%), hsl(330 70% 45%))",
                boxShadow: "0 8px 32px hsl(330 70% 45% / 0.4), 0 0 0 6px hsl(330 70% 50% / 0.15)",
                color: "#fff",
              }}
            >
              <LogOut className="w-6 h-6" />
              ออก OT
            </button>
          )}

          {otStatus === "ot-out" && (
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full flex flex-col items-center justify-center gap-1.5 relative z-10" style={{ background: "linear-gradient(135deg, hsl(270 70% 92%), hsl(330 70% 90%))", color: "hsl(270 70% 45%)", boxShadow: "0 0 0 6px hsl(270 70% 50% / 0.1)" }}>
              <Hourglass className="w-6 h-6" />
              <span className="font-bold text-sm">รออนุมัติ</span>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground text-center max-w-[220px] relative z-10">
            บันทึก OT ได้ทุกเวลา (ก่อน/หลังงานปกติ) ระบบจะส่งคำขอให้ผู้อนุมัติอัตโนมัติ
          </p>
            </>
          )}

          {!canCheckIn && !geo.loading && !geo.error && (
            <p className="text-xs text-destructive text-center max-w-[200px] relative z-10">คุณอยู่นอกพื้นที่ที่กำหนด</p>
          )}

          <DigitalClock />
        </div>

        {/* Widget 2: Employee Info + Location */}
        <div className="card-base p-5 sm:p-6 relative overflow-hidden space-y-4" style={{ background: "linear-gradient(135deg, hsl(var(--card)), hsl(31 100% 98%))" }}>
          <div className="absolute top-0 right-0 w-32 h-32 rounded-bl-[100%] opacity-10" style={{ background: "linear-gradient(135deg, #FF870F, #FFFF0F)" }} />

          <div className="flex items-start gap-3 relative z-10">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-2xl font-bold flex-shrink-0" style={{ background: "linear-gradient(135deg, hsl(31 100% 90%), hsl(31 100% 80%))", color: "#FF870F" }}>
              {currentEmployee.initials}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm sm:text-base font-bold font-display">{currentEmployee.name}</h2>
              <p className="text-xs font-semibold" style={{ color: "#FF870F" }}>{currentEmployee.position}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><Mail className="w-3 h-3" style={{ color: "#FF870F" }} />{currentEmployee.email}</span>
              </div>
            </div>
          </div>

          <div className="h-px bg-border" />

          <div className="space-y-3 relative z-10">
            <h3 className="font-bold font-display text-sm flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "hsl(90 100% 92%)" }}>
                <Navigation className="w-3 h-3" style={{ color: "hsl(90 100% 30%)" }} />
              </div>
              ตำแหน่งปัจจุบัน
            </h3>

            {geo.loading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-4 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#FF870F" }} />
                <span className="text-xs">กำลังดึงตำแหน่ง GPS...</span>
              </div>
            ) : geo.error ? (
              <div className="flex items-center gap-2 text-destructive py-4 justify-center">
                <XCircle className="w-4 h-4" />
                <span className="text-xs">{geo.error}</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Lat", value: geo.lat?.toFixed(6) },
                    { label: "Lng", value: geo.lng?.toFixed(6) },
                    ...(geo.accuracy ? [{ label: "ความแม่นยำ", value: `±${Math.round(geo.accuracy)} ม.` }] : []),
                  ].map((item) => (
                    <div key={item.label} className="text-center px-2 py-1.5 rounded-lg bg-muted/40">
                      <p className="text-[10px] text-muted-foreground">{item.label}</p>
                      <p className="text-xs font-mono font-semibold">{item.value}</p>
                    </div>
                  ))}
                </div>

                {nearest && (
                  <div className="p-3 rounded-xl border" style={{ background: nearest.withinRadius ? "hsl(90 100% 96%)" : "hsl(0 84% 96%)", borderColor: nearest.withinRadius ? "hsl(90 100% 85%)" : "hsl(0 84% 85%)" }}>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5" style={{ color: nearest.withinRadius ? "hsl(90 100% 30%)" : "hsl(0 84% 50%)" }} />
                      <span className="text-xs font-bold" style={{ color: nearest.withinRadius ? "hsl(90 100% 30%)" : "hsl(0 84% 50%)" }}>{nearest.location.name}</span>
                      <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${nearest.withinRadius ? "badge-present" : "badge-absent"}`}>
                        {nearest.withinRadius ? "✓ อยู่ในพื้นที่" : "✗ นอกพื้นที่"}
                      </span>
                    </div>
                    <p className="text-[10px] mt-1" style={{ color: nearest.withinRadius ? "hsl(90 100% 25%)" : "hsl(0 84% 40%)" }}>
                      ระยะห่าง: {Math.round(nearest.distance)} ม. / รัศมี: {nearest.location.radius} ม.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* History */}
      <div className="card-base p-4 sm:p-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 rounded-t-xl" style={{ background: "linear-gradient(90deg, #FF870F, #FFFF0F, #87FF0F)" }} />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="font-bold font-display text-sm sm:text-base flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "hsl(31 100% 93%)" }}>
              <Clock className="w-3.5 h-3.5" style={{ color: "#FF870F" }} />
            </div>
            ประวัติการลงเวลา
          </h3>
          <div className="flex items-center gap-2">
            <select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))} className="text-xs border rounded-lg px-2.5 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary" style={{ borderColor: "hsl(var(--border))" }}>
              {thaiMonths.map((m, i) => (<option key={i} value={i}>{m}</option>))}
            </select>
            <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} className="text-xs border rounded-lg px-2.5 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary" style={{ borderColor: "hsl(var(--border))" }}>
              {yearOptions.map((y) => (<option key={y} value={y}>พ.ศ. {y}</option>))}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <table className="w-full text-xs sm:text-sm min-w-[700px]">
            <thead>
              <tr className="text-muted-foreground text-left" style={{ borderBottom: "2px solid hsl(var(--border))" }}>
                <th className="pb-3 pl-2 font-semibold">วันที่</th>
                <th className="pb-3 font-semibold">เข้างาน</th>
                <th className="pb-3 font-semibold">ออกงาน</th>
                <th className="pb-3 font-semibold" style={{ color: "hsl(270 70% 50%)" }}>เข้า OT</th>
                <th className="pb-3 font-semibold" style={{ color: "hsl(330 70% 50%)" }}>ออก OT</th>
                <th className="pb-3 font-semibold">สถานที่</th>
                <th className="pb-3 font-semibold">สถานะ</th>
                <th className="pb-3 font-semibold">หมายเหตุ</th>
                <th className="pb-3 font-semibold text-center">แก้ไขเวลา</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">ไม่พบข้อมูลในเดือนที่เลือก</td></tr>
              ) : filteredHistory.map((r) => {
                const autoRemark = computeRemark(r, currentShift);
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 pl-2">{formatThaiDate(r.date)}</td>
                    <td className="py-3 font-mono">{r.checkIn}</td>
                    <td className="py-3 font-mono">{r.checkOut ?? "-"}</td>
                    <td className="py-3">
                      {r.location === "-" || !r.location ? (
                        <span className="text-muted-foreground">-</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {r.source === "face_scan" ? <ScanFace className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "hsl(var(--primary))" }} /> : <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "hsl(90 100% 35%)" }} />}
                          <span>{r.location}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0" style={{ background: r.source === "face_scan" ? "hsl(var(--primary) / 0.12)" : "hsl(90 100% 92%)", color: r.source === "face_scan" ? "hsl(var(--primary))" : "hsl(90 100% 30%)" }}>
                            {r.source === "face_scan" ? "สแกนหน้า" : "GPS"}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${r.withinRadius ? "badge-present" : "badge-absent"}`}>
                        {r.withinRadius ? "✓ ในรัศมี" : "✗ นอกรัศมี"}
                      </span>
                    </td>
                    <td className="py-3">
                      {autoRemark ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
                          background: autoRemark.includes("สาย") ? "hsl(0 84% 95%)" : autoRemark.includes("ลา") ? "hsl(220 90% 95%)" : autoRemark.includes("ออกก่อน") ? "hsl(31 100% 93%)" : "hsl(var(--muted))",
                          color: autoRemark.includes("สาย") ? "hsl(0 84% 45%)" : autoRemark.includes("ลา") ? "hsl(220 90% 45%)" : autoRemark.includes("ออกก่อน") ? "#FF870F" : "hsl(var(--muted-foreground))",
                        }}>
                          {autoRemark}
                        </span>
                      ) : <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="py-3 text-center">
                      <button
                        onClick={() => openEditRequest(r)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors hover:opacity-80"
                        style={{ background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}
                      >
                        <FileEdit className="w-3 h-3" />
                        ขอแก้ไข
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Time Edit Request Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">ขอแก้ไขเวลา</DialogTitle>
            <DialogDescription className="sr-only">ฟอร์มขอแก้ไขเวลาเข้า-ออกงาน</DialogDescription>
          </DialogHeader>
          {editingRecord && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-muted/50 space-y-1.5">
                <p className="text-xs text-muted-foreground">วันที่</p>
                <p className="text-sm font-semibold">{formatThaiDate(editingRecord.date)}</p>
                <div className="flex gap-4 mt-1">
                  <div><p className="text-[10px] text-muted-foreground">เวลาเข้าเดิม</p><p className="text-sm font-mono font-semibold">{editingRecord.checkIn}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">เวลาออกเดิม</p><p className="text-sm font-mono font-semibold">{editingRecord.checkOut ?? "-"}</p></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-muted-foreground mb-1 block">เวลาเข้าใหม่</label><TimeInput24 value={editForm.newCheckIn} onChange={(v) => setEditForm((f) => ({ ...f, newCheckIn: v }))} /></div>
                <div><label className="text-xs font-medium text-muted-foreground mb-1 block">เวลาออกใหม่</label><TimeInput24 value={editForm.newCheckOut} onChange={(v) => setEditForm((f) => ({ ...f, newCheckOut: v }))} /></div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">เหตุผลในการแก้ไข</label>
                <textarea value={editForm.reason} onChange={(e) => setEditForm((f) => ({ ...f, reason: e.target.value }))} placeholder="เช่น ลืมสแกนนิ้ว, เครื่องสแกนเสีย..." rows={3} className="w-full px-3 py-2 text-sm rounded-xl border bg-background outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <button onClick={() => setEditOpen(false)} className="px-4 py-2 rounded-xl text-sm font-medium border hover:bg-muted transition-colors">ยกเลิก</button>
            <button onClick={handleEditSubmit} className="px-4 py-2 rounded-xl text-sm font-bold transition-colors" style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", color: "hsl(var(--primary-foreground))" }}>ส่งคำขอ</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CheckIn;
