import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Clock, Plus, Search, Download, CheckCircle, CheckCircle2, XCircle,
  Hourglass, TrendingUp, FileText, ChevronDown, X, AlertCircle, Eye
} from "lucide-react";
import { useEmployees } from "@/contexts/EmployeeContext";
import { usePendingCounts } from "@/contexts/PendingCountsContext";
import { ThaiDatePicker } from "@/components/ui/thai-date-picker";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import TimeInput24 from "@/components/ui/time-input-24";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { notifyApprovers, notifyRequester, getApprovalTiers, notifyTierApprover } from "@/utils/notifications";
import SearchableSelect from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/components/ui/dialog";
import EmployeeAvatar from "@/components/ui/employee-avatar";

type OTStatus = "pending" | "approved" | "rejected";
type OTType = "workday" | "holiday" | "special";

interface OTRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  photoUrl?: string;
  department: string;
  date: string;
  startTime: string;
  endTime: string;
  actualIn?: string | null;
  actualOut?: string | null;

  hours: number;
  type: OTType;
  reason: string;
  status: OTStatus;
  createdAt: string;
  approvedBy?: string;
  currentTier?: number;
  approvedTiers?: number;
  totalTiers?: number;
}

const otTypeLabels: Record<OTType, { label: string; className: string }> = {
  workday: { label: "วันทำงาน", className: "bg-blue-100 text-blue-700" },
  holiday: { label: "วันหยุด", className: "bg-orange-100 text-orange-700" },
  special: { label: "กรณีพิเศษ", className: "bg-purple-100 text-purple-700" },
};

const statusConfig: Record<OTStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  pending: { label: "รออนุมัติ", icon: Hourglass, className: "badge-late" },
  approved: { label: "อนุมัติแล้ว", icon: CheckCircle2, className: "badge-present" },
  rejected: { label: "ไม่อนุมัติ", icon: XCircle, className: "badge-absent" },
};

const currentMonthLocal = (): string => String(new Date().getMonth() + 1).padStart(2, "0");

// คำนวณชั่วโมง OT ที่ทำจริงจากเวลาเข้า-ออกจริง
const calcActualHours = (inTime?: string | null, outTime?: string | null): number | null => {
  if (!inTime || !outTime || inTime === "-" || outTime === "-") return null;
  const [ih, im] = inTime.split(":").map(Number);
  const [oh, om] = outTime.split(":").map(Number);
  if ([ih, im, oh, om].some((n) => Number.isNaN(n))) return null;
  let mins = oh * 60 + om - (ih * 60 + im);
  if (mins < 0) mins += 24 * 60;
  return Math.round((mins / 60) * 100) / 100;
};

// --- OT Request Form Dialog ---
const OTRequestDialog = ({ open, onClose, onSubmit }: {
  open: boolean;
  onClose: () => void;
  onSubmit: (req: Omit<OTRequest, "id" | "createdAt" | "status">) => void;
}) => {
  const { employees } = useEmployees();
  const { currentUser, role } = useAuth();
  const { canAction, getScope } = usePermissions();
  const canAdd = canAction(role, 'ot', 'add');
  const hasAdminAccess = canAdd || canAction(role, 'ot', 'approve');
  // Can create OT for other people only when the OT scope is wider than "self"
  const isAdmin = canAdd && getScope(role, 'ot') !== 'self';
  const shouldLockEmployee = !isAdmin;
  const [form, setForm] = useState({
    employeeId: shouldLockEmployee && currentUser ? (currentUser.employeeId || currentUser.id) : "",
    dateFrom: "",
    dateTo: "",
    startTime: "18:00",
    endTime: "21:00",
    type: "workday" as OTType,
    reason: "",
  });

  const selectedEmp = employees.find((e) => e.id === form.employeeId);
  const empDept = selectedEmp?.dept || "";

  const calcHours = () => {
    if (!form.startTime || !form.endTime) return 0;
    const [sh, sm] = form.startTime.split(":").map(Number);
    const [eh, em] = form.endTime.split(":").map(Number);
    const diff = (eh * 60 + em - (sh * 60 + sm)) / 60;
    return Math.max(0, Math.round(diff * 10) / 10);
  };

  const handleSubmit = () => {
    if (!form.employeeId || !form.dateFrom || !form.reason) return;
    const calcDays = () => {
      if (!form.dateTo || form.dateTo <= form.dateFrom) return 1;
      const from = new Date(form.dateFrom);
      const to = new Date(form.dateTo);
      return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    };
    const days = calcDays();
    const dateLabel = form.dateTo && form.dateTo !== form.dateFrom ? `${form.dateFrom} ~ ${form.dateTo}` : form.dateFrom;
    onSubmit({
      employeeId: form.employeeId,
      employeeName: selectedEmp ? `${selectedEmp.firstName} ${selectedEmp.lastName}` : "",
      department: empDept,
      date: dateLabel,
      startTime: form.startTime,
      endTime: form.endTime,
      hours: calcHours() * days,
      type: form.type,
      reason: form.reason,
    });
    onClose();
  };

  const resetForm = () => {
    setForm({
      employeeId: shouldLockEmployee && currentUser ? (currentUser.employeeId || currentUser.id) : "",
      dateFrom: "",
      dateTo: "",
      startTime: "18:00",
      endTime: "21:00",
      type: "workday" as OTType,
      reason: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { resetForm(); onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Clock className="w-5 h-5 text-primary" /> ยื่นขอทำงานโอที
          </DialogTitle>
          <DialogDescription className="sr-only">กรอกข้อมูลคำขอทำงานล่วงเวลา</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {isAdmin && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">พนักงาน *</label>
              <SearchableSelect
                value={form.employeeId}
                onChange={(val) => setForm({ ...form, employeeId: val })}
                options={employees.map((emp) => ({
                  value: emp.id,
                  label: `${emp.firstName} ${emp.lastName}`,
                  subtitle: emp.dept,
                }))}
                placeholder="-- เลือกพนักงาน --"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">วันที่เริ่ม OT *</label>
              <ThaiDatePicker value={form.dateFrom} onChange={(v) => setForm({ ...form, dateFrom: v })} placeholder="เลือกวันที่เริ่ม" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">วันที่สิ้นสุด</label>
              <ThaiDatePicker value={form.dateTo} onChange={(v) => setForm({ ...form, dateTo: v })} placeholder="เลือกวันที่สิ้นสุด" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">เวลาเริ่ม</label>
              <TimeInput24 value={form.startTime} onChange={(v) => setForm({ ...form, startTime: v })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">เวลาสิ้นสุด</label>
              <TimeInput24 value={form.endTime} onChange={(v) => setForm({ ...form, endTime: v })} />
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/60">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">ชั่วโมง OT:</span>
            <span className="text-sm font-bold text-primary">{calcHours()} ชั่วโมง</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">ประเภท OT</label>
            <div className="flex gap-2">
              {(Object.keys(otTypeLabels) as OTType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setForm({ ...form, type: t })}
                  className="flex-1 py-2 rounded-xl border-2 text-xs font-medium transition-all"
                  style={{
                    borderColor: form.type === t ? "hsl(var(--primary))" : "hsl(var(--border))",
                    background: form.type === t ? "hsl(var(--primary) / 0.08)" : "transparent",
                  }}
                >
                  {otTypeLabels[t].label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">เหตุผลในการขอ OT *</label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              rows={3}
              placeholder="ระบุเหตุผลหรือรายละเอียดงานที่ต้องทำ..."
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <button onClick={() => { resetForm(); onClose(); }} className="flex-1 h-10 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">ยกเลิก</button>
          <button
            onClick={handleSubmit}
            disabled={!form.employeeId || !form.dateFrom || !form.reason}
            className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ยื่นคำขอ
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Main OT Page
const OvertimeRequest = () => {
  const [requests, setRequests] = useState<OTRequest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [detailReq, setDetailReq] = useState<OTRequest | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OTStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<OTType | "all">("all");
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const employeeDropdownRef = useRef<HTMLDivElement>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterMonth, setFilterMonth] = useState(currentMonthLocal);
  const { setOvertimePending } = usePendingCounts();
  const { currentUser, role, user } = useAuth();
  const { canAction, getScope } = usePermissions();
  const canApprove = canAction(role, 'ot', 'approve');
  const canAdd = canAction(role, 'ot', 'add');
  const otScope = getScope(role, 'ot');
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    const [{ data }, { data: actuals }] = await Promise.all([
      supabase
        .from("overtime_requests")
        .select("*, employees(first_name, last_name, dept, photo_url)")
        .order("created_at", { ascending: false }),
      supabase
        .from("check_in_records")
        .select("employee_id, date, ot_actual_in, ot_actual_out"),
    ]);
    const actualMap = new Map<string, { in: string | null; out: string | null }>();
    (actuals || []).forEach((a: any) => {
      if (!a.ot_actual_in && !a.ot_actual_out) return;
      actualMap.set(`${a.employee_id}|${a.date}`, { in: a.ot_actual_in, out: a.ot_actual_out });
    });
    if (data) {
      setRequests(data.map((r: any) => {
        const baseDate = String(r.date || "").split("~")[0].trim();
        const actual = actualMap.get(`${r.employee_id}|${baseDate}`);
        return {
          id: r.id,
          employeeId: r.employee_id,
          employeeName: r.employees ? `${r.employees.first_name} ${r.employees.last_name}` : "",
          photoUrl: r.employees?.photo_url || undefined,
          department: r.employees?.dept || "",
          date: r.date,
          startTime: r.start_time,
          endTime: r.end_time,
          actualIn: actual?.in || null,
          actualOut: actual?.out || null,
          hours: Number(r.hours) || 0,
          type: r.ot_type as OTType,
          reason: r.reason,
          status: r.status as OTStatus,
          createdAt: r.created_at,
          approvedBy: r.approved_by,
          currentTier: r.current_tier || 1,
          approvedTiers: r.approved_tiers || 0,
          totalTiers: r.total_tiers || 1,
        };
      }));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Reset month/date filters when entering the pending tab so all months show by default
  useEffect(() => {
    if (statusFilter === "pending") {
      setFilterMonth("");
      setDateFrom("");
      setDateTo("");
    }
  }, [statusFilter]);

  // Realtime subscription for overtime_requests

  useEffect(() => {
    const channel = supabase
      .channel("ot-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "overtime_requests" }, () => {
        fetchRequests();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchRequests]);

  // Filter based on scope
  const userRequests = otScope === "all"
    ? requests
    : otScope === "department"
      ? requests.filter((r) => {
          const myDept = currentUser?.dept || "";
          return r.department === myDept;
        })
      : requests.filter((r) => currentUser && r.employeeId === (currentUser.employeeId || currentUser.id));
  const pendingCount = userRequests.filter((r) => r.status === "pending").length;
  const approvedCount = userRequests.filter((r) => r.status === "approved").length;

  useEffect(() => {
    setOvertimePending(pendingCount);
  }, [pendingCount, setOvertimePending]);

  const allNames = useMemo(
    () => Array.from(new Set(userRequests.map((r) => r.employeeName).filter(Boolean))).sort(),
    [userRequests]
  );
  const filteredEmployeeOptions = useMemo(
    () => (employeeSearch ? allNames.filter((n) => n.includes(employeeSearch)) : allNames),
    [allNames, employeeSearch]
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(e.target as Node)) {
        setShowEmployeeDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = userRequests.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (typeFilter !== "all" && r.type !== typeFilter) return false;
    if (filterEmployee !== "all" && r.employeeName !== filterEmployee) return false;
    const baseDate = String(r.date || "").split("~")[0].trim();
    if (dateFrom || dateTo) {
      if (dateFrom && baseDate < dateFrom) return false;
      if (dateTo && baseDate > dateTo) return false;
    } else if (filterMonth && baseDate.slice(5, 7) !== filterMonth) {
      return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return r.employeeName.toLowerCase().includes(q) || r.department.toLowerCase().includes(q);
    }
    return true;
  });

  // Stats widgets always show current user's own data
  const myOwnRequests = requests.filter((r) => currentUser && r.employeeId === (currentUser.employeeId || currentUser.id));
  const stats = {
    total: myOwnRequests.length,
    pending: myOwnRequests.filter((r) => r.status === "pending").length,
    approved: myOwnRequests.filter((r) => r.status === "approved").length,
    totalHours: myOwnRequests.filter((r) => r.status === "approved").reduce((sum, r) => sum + r.hours, 0),
  };

  const handleAdd = async (req: Omit<OTRequest, "id" | "createdAt" | "status">) => {
    // Resolve employee_id: if not a valid employees.id, look it up by auth user_id
    let employeeId = req.employeeId;
    const { data: empCheck } = await supabase
      .from("employees")
      .select("id")
      .eq("id", employeeId)
      .maybeSingle();
    if (!empCheck && user?.id) {
      const { data: empByUser } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (empByUser?.id) employeeId = empByUser.id;
    }
    if (!employeeId) {
      toast.error("ไม่พบข้อมูลพนักงานของคุณ กรุณาติดต่อผู้ดูแลระบบ");
      return;
    }

    const totalTiers = await getApprovalTiers("ot");
    const { error } = await supabase.from("overtime_requests").insert({
      employee_id: employeeId,
      date: req.date,
      start_time: req.startTime,
      end_time: req.endTime,
      hours: req.hours,
      ot_type: req.type,
      reason: req.reason,
      current_tier: 1,
      approved_tiers: 0,
      total_tiers: totalTiers,
    });
    if (error) {
      console.error("OT insert error:", error);
      toast.error(`ยื่นคำขอ OT ไม่สำเร็จ: ${error.message}`);
      return;
    }
    fetchRequests();
    toast.success("ยื่นคำขอ OT เรียบร้อย");
    notifyApprovers({
      type: "ot",
      title: "คำขอ OT ใหม่",
      description: `${req.employeeName} ยื่นขอ OT ${req.date} (${req.startTime}-${req.endTime}) ${req.hours} ชม.`,
      targetEmployee: req.employeeName,
    });
  };

  const handleApprove = async (id: string) => {
    const req = requests.find((r) => r.id === id);
    if (!req) return;
    if (!user?.id) return;

    // Check if this user already acted on this request
    const { data: existingLog } = await supabase
      .from("approval_logs")
      .select("id")
      .eq("request_id", id)
      .eq("request_type", "ot")
      .eq("approver_user_id", user.id)
      .maybeSingle();

    if (existingLog) {
      toast.error("คุณได้อนุมัติคำขอนี้ไปแล้ว");
      return;
    }

    const nextTier = (req.approvedTiers || 0) + 1;
    const totalTiers = req.totalTiers || 1;

    await supabase.from("approval_logs").insert({
      request_id: id,
      request_type: "ot",
      tier: nextTier,
      action: "approve",
      approver_user_id: user.id,
    });

    if (nextTier >= totalTiers) {
      await supabase.from("overtime_requests").update({
        status: "approved",
        approved_by: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "Admin",
        approved_tiers: nextTier,
        current_tier: nextTier,
      }).eq("id", id);
      setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: "approved" as OTStatus, approvedTiers: nextTier } : r));
      toast.success("อนุมัติ OT เรียบร้อย (ครบทุกระดับ)");

      notifyRequester(req.employeeId, {
        type: "approval",
        title: "คำขอ OT ได้รับการอนุมัติ",
        description: `คำขอ OT ${req.date} (${req.startTime}-${req.endTime}) ${req.hours} ชม. ได้รับการอนุมัติแล้ว`,
        targetEmployee: req.employeeName,
      });
    } else {
      await supabase.from("overtime_requests").update({
        approved_tiers: nextTier,
        current_tier: nextTier + 1,
      }).eq("id", id);
      setRequests((prev) => prev.map((r) => r.id === id ? { ...r, approvedTiers: nextTier, currentTier: nextTier + 1 } : r));
      toast.success(`อนุมัติระดับ ${nextTier}/${totalTiers} — รอระดับถัดไป`);

      notifyTierApprover("ot", nextTier, {
        type: "ot",
        title: `คำขอ OT รอการอนุมัติ (ระดับ ${nextTier + 1}/${totalTiers})`,
        description: `${req.employeeName} ยื่นขอ OT ${req.date} (${req.startTime}-${req.endTime}) ${req.hours} ชม. — ผ่านระดับ ${nextTier} แล้ว`,
        targetEmployee: req.employeeName,
      });
    }
  };

  const handleReject = async (id: string) => {
    if (!user?.id) return;

    const { data: existingLog } = await supabase
      .from("approval_logs")
      .select("id")
      .eq("request_id", id)
      .eq("request_type", "ot")
      .eq("approver_user_id", user.id)
      .maybeSingle();

    if (existingLog) {
      toast.error("คุณได้ดำเนินการกับคำขอนี้ไปแล้ว");
      return;
    }

    await supabase.from("approval_logs").insert({
      request_id: id,
      request_type: "ot",
      tier: (requests.find(r => r.id === id)?.approvedTiers || 0) + 1,
      action: "reject",
      approver_user_id: user.id,
    });

    await supabase.from("overtime_requests").update({ status: "rejected" }).eq("id", id);
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: "rejected" as OTStatus } : r));
    toast.success("ปฏิเสธ OT เรียบร้อย");
    const req = requests.find((r) => r.id === id);
    if (req) {
      notifyRequester(req.employeeId, {
        type: "approval",
        title: "คำขอ OT ไม่ได้รับการอนุมัติ",
        description: `คำขอ OT ${req.date} (${req.startTime}-${req.endTime}) ${req.hours} ชม. ไม่ได้รับการอนุมัติ`,
        targetEmployee: req.employeeName,
      });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display">ขอทำงานโอที</h2>
          <p className="text-sm text-muted-foreground mt-0.5">ยื่นคำขอ ติดตาม และอนุมัติการทำงานล่วงเวลา</p>
        </div>
        <div className="flex items-center gap-2">
          {role !== "employee" && (
            <button className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">
              <Download className="w-4 h-4" />
              Export
            </button>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", color: "hsl(var(--primary-foreground))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}
          >
            <Plus className="w-4 h-4" />
            ยื่นขอ OT
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { name: "คำขอทั้งหมด", value: stats.total, color: "#FF870F", bg: "hsl(31 100% 93%)", icon: FileText, filterKey: "all" },
          { name: "รออนุมัติ", value: stats.pending, color: "#FF870F", bg: "hsl(31 100% 93%)", icon: Hourglass, filterKey: "pending" },
          { name: "อนุมัติแล้ว", value: stats.approved, color: "hsl(90 100% 30%)", bg: "hsl(90 100% 92%)", icon: CheckCircle2, filterKey: "approved" },
          { name: "ชม. OT รวม", value: stats.totalHours, color: "hsl(220 90% 45%)", bg: "hsl(220 90% 93%)", icon: TrendingUp, filterKey: "" },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.name}
              className="card-base p-4 cursor-pointer transition-all duration-200"
              style={{ borderLeft: `4px solid ${card.color}` }}
              onClick={() => card.filterKey && setStatusFilter(statusFilter === card.filterKey ? "all" : card.filterKey as OTStatus | "all")}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{card.name}</p>
                  <p className="text-2xl font-bold font-display mt-1" style={{ color: card.color }}>{card.value}</p>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: card.bg }}>
                  <Icon className="w-5 h-5" style={{ color: card.color }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center justify-between gap-1 sm:gap-2 sm:justify-start sm:flex-wrap">
        {[
          { key: "all", label: "ทั้งหมด" },
          { key: "pending", label: "รออนุมัติ" },
          { key: "approved", label: "อนุมัติแล้ว" },
          { key: "rejected", label: "ไม่อนุมัติ" },
        ].map((f) => {
          const count = f.key === "pending" ? pendingCount : 0;
          return (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key as OTStatus | "all")}
              className="px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-all relative flex-1 sm:flex-none"
              style={{
                background: statusFilter === f.key ? "hsl(var(--primary))" : "hsl(var(--card))",
                color: statusFilter === f.key ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
                border: `1px solid ${statusFilter === f.key ? "hsl(var(--primary))" : "hsl(var(--border))"}`,
                boxShadow: statusFilter === f.key ? "0 4px 12px hsl(var(--primary) / 0.3)" : "none",
              }}
            >
              {f.label}
              {f.key === "pending" && count > 0 && (
                <span className="absolute -top-2 -right-2 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "#ef4444", color: "#fff", fontSize: "10px" }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters — same set as the attendance page */}
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

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as OTType | "all")}
            className="w-fit min-w-fit flex-shrink-0 px-2.5 py-1.5 text-sm rounded-xl border bg-muted/30 outline-none cursor-pointer"
          >
            <option value="all">ทุกประเภท</option>
            <option value="workday">วันทำงาน</option>
            <option value="holiday">วันหยุด</option>
            <option value="special">กรณีพิเศษ</option>
          </select>

          <select
            value={filterMonth}
            onChange={(e) => {
              const month = e.target.value;
              setFilterMonth(month);
              if (month) { setDateFrom(""); setDateTo(""); }
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
                onClick={() => { setDateFrom(""); setDateTo(""); setFilterMonth(statusFilter === "pending" ? "" : currentMonthLocal()); }}
                className="p-2 rounded-lg border hover:bg-muted transition-colors flex-shrink-0"
                title="ล้างวันที่"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">พนักงาน</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">แผนก</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">วันที่</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">เวลาที่ขอ</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">เวลาจริง</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">ชม. (ที่ขอ)</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground hidden sm:table-cell">ประเภท</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">สถานะ</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">กำลังโหลด...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-muted-foreground">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p>ไม่พบรายการคำขอ OT</p>
                  </td>
                </tr>
              ) : filtered.map((req) => {
                const statusCfg = statusConfig[req.status];
                const StatusIcon = statusCfg.icon;
                const typeCfg = otTypeLabels[req.type];
                return (
                  <tr key={req.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <EmployeeAvatar photoUrl={req.photoUrl} firstName={req.employeeName} size="sm" />
                        <p className="font-medium">{req.employeeName}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{req.department}</td>
                    <td className="px-4 py-3">{req.date}</td>
                    <td className="px-4 py-3 hidden lg:table-cell font-mono text-xs">{req.startTime} - {req.endTime}</td>
                    <td className="px-4 py-3 hidden lg:table-cell font-mono text-xs">
                      {req.actualIn || req.actualOut ? (
                        <span className="text-primary font-semibold">{req.actualIn || "-"} - {req.actualOut || "-"}</span>
                      ) : (
                        <span className="text-muted-foreground">ยังไม่บันทึก</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-bold">
                      {calcActualHours(req.actualIn, req.actualOut) !== null ? (
                        <span className="text-primary">{calcActualHours(req.actualIn, req.actualOut)}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                      <span className="text-muted-foreground font-normal"> ({req.hours})</span>
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${typeCfg.className}`}>{typeCfg.label}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`${statusCfg.className} inline-flex items-center gap-1`}>
                        <StatusIcon className="w-3 h-3" /> {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setDetailReq(req)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground" title="ดูรายละเอียด">
                          <Eye className="w-4 h-4" />
                        </button>
                        {canApprove && req.status === "pending" && (
                          <>
                            <button onClick={() => handleApprove(req.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" style={{ color: "hsl(90 100% 30%)" }} title="อนุมัติ">
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleReject(req.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-destructive" title="ไม่อนุมัติ">
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
          <span>แสดง {filtered.length} จาก {userRequests.length} รายการ</span>
          <span>รวม OT (อนุมัติ): <span className="font-bold text-foreground">{stats.totalHours} ชั่วโมง</span></span>
        </div>
      </div>

      <OTRequestDialog open={showForm} onClose={() => setShowForm(false)} onSubmit={handleAdd} />

      <Dialog open={!!detailReq} onOpenChange={(v) => { if (!v) setDetailReq(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold pb-[10px]">
              <Clock className="w-5 h-5 text-primary" />
              รายละเอียดคำขอ OT
            </DialogTitle>
            <DialogDescription className="sr-only">รายละเอียดคำขอทำงานล่วงเวลา</DialogDescription>
          </DialogHeader>
          {detailReq && (() => {
            const sc = statusConfig[detailReq.status];
            const tc = otTypeLabels[detailReq.type];
            return (
              <DialogBody className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-muted-foreground">พนักงาน</p><p className="text-sm font-semibold mt-0.5">{detailReq.employeeName}</p></div>
                  <div><p className="text-xs text-muted-foreground">แผนก</p><p className="text-sm font-semibold mt-0.5">{detailReq.department || "-"}</p></div>
                </div>
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-muted/40">
                  <div><p className="text-xs text-muted-foreground mb-1">วันที่</p><p className="text-sm font-semibold">{detailReq.date}</p></div>
                  <div><p className="text-xs text-muted-foreground mb-1">เวลาที่ขอ</p><p className="text-sm font-semibold font-mono">{detailReq.startTime} - {detailReq.endTime}</p></div>
                  <div className="col-span-2"><p className="text-xs text-muted-foreground mb-1">เวลาที่ทำจริง</p><p className="text-sm font-semibold font-mono">{detailReq.actualIn || detailReq.actualOut ? `${detailReq.actualIn || "-"} - ${detailReq.actualOut || "-"}` : "ยังไม่บันทึก"}</p></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-muted-foreground mb-1">ชั่วโมง OT</p><p className="text-base font-bold text-primary">{detailReq.hours} ชม.</p></div>
                  <div><p className="text-xs text-muted-foreground mb-1">ประเภท OT</p><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${tc.className}`}>{tc.label}</span></div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">เหตุผล</p>
                  <p className="text-sm p-3 rounded-xl bg-muted/40 whitespace-pre-wrap">{detailReq.reason || "-"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">สถานะ:</p>
                  <span className={`${sc.className} inline-flex items-center gap-1`}>
                    <sc.icon className="w-3 h-3" /> {sc.label}
                  </span>
                  {detailReq.status === "pending" && (detailReq.totalTiers || 1) > 1 && (
                    <span className="text-xs text-muted-foreground">({detailReq.approvedTiers || 0}/{detailReq.totalTiers})</span>
                  )}
                </div>
              </DialogBody>
            );
          })()}
          <DialogFooter>
            {detailReq?.status === "pending" && canApprove ? (
              <>
                <button onClick={() => { if (detailReq) handleReject(detailReq.id); setDetailReq(null); }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background: "hsl(0 84% 50%)" }}>
                  <X className="w-4 h-4" /> ไม่อนุมัติ
                </button>
                <button onClick={() => { if (detailReq) handleApprove(detailReq.id); setDetailReq(null); }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background: "hsl(90 100% 30%)" }}>
                  <CheckCircle className="w-4 h-4" /> อนุมัติ
                </button>
              </>
            ) : (
              <button onClick={() => setDetailReq(null)} className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">ปิด</button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OvertimeRequest;
