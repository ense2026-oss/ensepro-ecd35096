import { useState, useEffect } from "react";
import {
  Clock,
  Plus,
  Search,
  Download,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Hourglass,
  TrendingUp,
  FileText,
  ChevronDown,
  X,
  AlertCircle } from
"lucide-react";
import { useEmployees } from "@/contexts/EmployeeContext";
import { usePendingCounts } from "@/contexts/PendingCountsContext";
import { ThaiDatePicker } from "@/components/ui/thai-date-picker";
import { useAuth } from "@/contexts/AuthContext";
import TimeInput24 from "@/components/ui/time-input-24";

// --- Types ---
type OTStatus = "pending" | "approved" | "rejected";
type OTType = "workday" | "holiday" | "special";

interface OTRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  type: OTType;
  reason: string;
  status: OTStatus;
  createdAt: string;
  approvedBy?: string;
}

// --- Mock data ---
const mockRequests: OTRequest[] = [
{ id: "OT-001", employeeId: "EMP001", employeeName: "สมชาย ใจดี", department: "ฝ่ายพัฒนาระบบ", date: "2025-01-20", startTime: "18:00", endTime: "21:00", hours: 3, type: "workday", reason: "ปิดโปรเจกต์ระบบ HR ให้ทันกำหนด", status: "approved", createdAt: "2025-01-19", approvedBy: "สมหญิง แสนดี" },
{ id: "OT-002", employeeId: "EMP002", employeeName: "สมศรี มั่นคง", department: "ฝ่ายบัญชี", date: "2025-01-22", startTime: "17:30", endTime: "20:30", hours: 3, type: "workday", reason: "ปิดงบประจำเดือน", status: "approved", createdAt: "2025-01-21", approvedBy: "สมหญิง แสนดี" },
{ id: "OT-003", employeeId: "EMP003", employeeName: "วิชัย สุขสันต์", department: "ฝ่ายพัฒนาระบบ", date: "2025-01-25", startTime: "09:00", endTime: "17:00", hours: 8, type: "holiday", reason: "Deploy ระบบในวันหยุด", status: "pending", createdAt: "2025-01-23" },
{ id: "OT-004", employeeId: "EMP004", employeeName: "กานดา ศรีสุข", department: "ฝ่ายขาย", date: "2025-01-21", startTime: "18:00", endTime: "20:00", hours: 2, type: "workday", reason: "เตรียมเอกสารนำเสนอลูกค้า", status: "rejected", createdAt: "2025-01-20" },
{ id: "OT-005", employeeId: "EMP005", employeeName: "ธนพล รุ่งเรือง", department: "ฝ่ายพัฒนาระบบ", date: "2025-01-28", startTime: "18:00", endTime: "22:00", hours: 4, type: "workday", reason: "แก้ไขบั๊กเร่งด่วนระบบลูกค้า", status: "pending", createdAt: "2025-01-27" },
{ id: "OT-006", employeeId: "EMP006", employeeName: "ปิยะ แก้วมณี", department: "ฝ่ายซ่อมบำรุง", date: "2025-01-26", startTime: "08:00", endTime: "16:00", hours: 8, type: "special", reason: "ซ่อมบำรุงระบบไฟฟ้าฉุกเฉิน", status: "approved", createdAt: "2025-01-24", approvedBy: "สมหญิง แสนดี" }];


const otTypeLabels: Record<OTType, {label: string;className: string;}> = {
  workday: { label: "วันทำงาน", className: "bg-blue-100 text-blue-700" },
  holiday: { label: "วันหยุด", className: "bg-orange-100 text-orange-700" },
  special: { label: "กรณีพิเศษ", className: "bg-purple-100 text-purple-700" }
};

const statusConfig: Record<OTStatus, {label: string;icon: typeof CheckCircle2;className: string;}> = {
  pending: { label: "รออนุมัติ", icon: Hourglass, className: "badge-late" },
  approved: { label: "อนุมัติแล้ว", icon: CheckCircle2, className: "badge-present" },
  rejected: { label: "ไม่อนุมัติ", icon: XCircle, className: "badge-absent" }
};

// --- OT Request Form Dialog ---
const OTRequestDialog = ({
  open,
  onClose,
  onSubmit




}: {open: boolean;onClose: () => void;onSubmit: (req: Omit<OTRequest, "id" | "createdAt" | "status">) => void;}) => {
  const { employees } = useEmployees();
  const { currentUser, hasAdminAccess } = useAuth();
  const [form, setForm] = useState({
    employeeId: !hasAdminAccess && currentUser ? currentUser.id : "",
    dateFrom: "",
    dateTo: "",
    startTime: "18:00",
    endTime: "21:00",
    type: "workday" as OTType,
    reason: ""
  });

  if (!open) return null;

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
    const dateLabel = form.dateTo && form.dateTo !== form.dateFrom ?
    `${form.dateFrom} ~ ${form.dateTo}` :
    form.dateFrom;
    onSubmit({
      employeeId: form.employeeId,
      employeeName: selectedEmp ? `${selectedEmp.firstName} ${selectedEmp.lastName}` : "",
      department: empDept,
      date: dateLabel,
      startTime: form.startTime,
      endTime: form.endTime,
      hours: calcHours() * days,
      type: form.type,
      reason: form.reason
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="card-base w-full max-w-lg mx-4 p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" /> ยื่นขอทำงานโอที
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Employee Select - only show for admin access */}
        {hasAdminAccess && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">พนักงาน *</label>
            <select
              value={form.employeeId}
              onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
              className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">-- เลือกพนักงาน --</option>
              {employees.map((emp) =>
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} — {emp.dept}
                </option>
              )}
            </select>
          </div>
        )}

        {/* Date Range */}
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
        {/* Time Range */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">เวลาเริ่ม</label>
            <TimeInput24
              value={form.startTime}
              onChange={(v) => setForm({ ...form, startTime: v })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">เวลาสิ้นสุด</label>
            <TimeInput24
              value={form.endTime}
              onChange={(v) => setForm({ ...form, endTime: v })}
            />
          </div>
        </div>

        {/* Calculated hours */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/60">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">ชั่วโมง OT:</span>
          <span className="text-sm font-bold text-primary">{calcHours()} ชั่วโมง</span>
        </div>

        {/* OT Type */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">ประเภท OT</label>
          <div className="flex gap-2">
            {(Object.keys(otTypeLabels) as OTType[]).map((t) =>
            <button
              key={t}
              onClick={() => setForm({ ...form, type: t })}
              className="flex-1 py-2 rounded-xl border-2 text-xs font-medium transition-all"
              style={{
                borderColor: form.type === t ? "hsl(var(--primary))" : "hsl(var(--border))",
                background: form.type === t ? "hsl(var(--primary) / 0.08)" : "transparent"
              }}>

                {otTypeLabels[t].label}
              </button>
            )}
          </div>
        </div>

        {/* Reason */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">เหตุผลในการขอ OT *</label>
          <textarea
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            rows={3}
            placeholder="ระบุเหตุผลหรือรายละเอียดงานที่ต้องทำ..."
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />

        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">

            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.employeeId || !form.dateFrom || !form.reason}
            className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">

            ยื่นคำขอ
          </button>
        </div>
      </div>
    </div>);

};

// --- Main Page ---
const OvertimeRequest = () => {
  const [requests, setRequests] = useState<OTRequest[]>(mockRequests);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OTStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<OTType | "all">("all");
  const { setOvertimePending } = usePendingCounts();
  const { currentUser, hasAdminAccess } = useAuth();

  // Filter for employee role
  const userRequests = hasAdminAccess
    ? requests
    : requests.filter((r) => currentUser && r.employeeName === `${currentUser.firstName} ${currentUser.lastName}`);
  const pendingCount = userRequests.filter((r) => r.status === "pending").length;
  const approvedCount = userRequests.filter((r) => r.status === "approved").length;
  const rejectedCount = userRequests.filter((r) => r.status === "rejected").length;

  // Sync pending count to global context
  useEffect(() => {
    setOvertimePending(requests.filter((r) => r.status === "pending").length);
  }, [requests, setOvertimePending]);
  useEffect(() => {
    setOvertimePending(pendingCount);
  }, [pendingCount, setOvertimePending]);

  const filtered = userRequests.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (typeFilter !== "all" && r.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.employeeName.toLowerCase().includes(q) || r.department.toLowerCase().includes(q) || r.id.toLowerCase().includes(q);
    }
    return true;
  });

  const stats = {
    total: userRequests.length,
    pending: pendingCount,
    approved: approvedCount,
    totalHours: userRequests.filter((r) => r.status === "approved").reduce((sum, r) => sum + r.hours, 0)
  };

  const handleAdd = (req: Omit<OTRequest, "id" | "createdAt" | "status">) => {
    const newReq: OTRequest = {
      ...req,
      id: `OT-${String(requests.length + 1).padStart(3, "0")}`,
      status: "pending",
      createdAt: new Date().toISOString().slice(0, 10)
    };
    setRequests([newReq, ...requests]);
  };

  const handleApprove = (id: string) => {
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: "approved" as OTStatus, approvedBy: "Admin User" } : r));
  };

  const handleReject = (id: string) => {
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: "rejected" as OTStatus } : r));
  };

  return (
    <div className="space-y-5">
      {/* Header - same style as Leave */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display">ขอทำงานโอที</h2>
          <p className="text-sm text-muted-foreground mt-0.5">ยื่นคำขอ ติดตาม และอนุมัติการทำงานล่วงเวลา</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", color: "hsl(var(--primary-foreground))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}>

            <Plus className="w-4 h-4" />
            ยื่นขอ OT
          </button>
        </div>
      </div>

      {/* Summary Cards - same style as Attendance */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
        { name: "คำขอทั้งหมด", value: stats.total, color: "#FF870F", bg: "hsl(31 100% 93%)", icon: FileText, filterKey: "all" },
        { name: "รออนุมัติ", value: stats.pending, color: "#FF870F", bg: "hsl(31 100% 93%)", icon: Hourglass, filterKey: "pending" },
        { name: "อนุมัติแล้ว", value: stats.approved, color: "hsl(90 100% 30%)", bg: "hsl(90 100% 92%)", icon: CheckCircle2, filterKey: "approved" },
        { name: "ชม. OT รวม", value: stats.totalHours, color: "hsl(220 90% 45%)", bg: "hsl(220 90% 93%)", icon: TrendingUp, filterKey: "" }].
        map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.name}
              className="card-base p-4 cursor-pointer transition-all duration-200"
              style={{ borderLeft: `4px solid ${card.color}` }}
              onClick={() => card.filterKey && setStatusFilter(statusFilter === card.filterKey ? "all" : card.filterKey as OTStatus | "all")}>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{card.name}</p>
                  <p className="text-2xl font-bold font-display mt-1" style={{ color: card.color }}>{card.value}</p>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: card.bg }}>
                  <Icon className="w-5 h-5" style={{ color: card.color }} />
                </div>
              </div>
            </div>);

        })}
      </div>

      {/* Filter tabs - exact same style as Leave page */}
      <div className="flex items-center justify-between gap-1 sm:gap-2 sm:justify-start sm:flex-wrap">
        {[
        { key: "all", label: "ทั้งหมด" },
        { key: "pending", label: "รออนุมัติ" },
        { key: "approved", label: "อนุมัติแล้ว" },
        { key: "rejected", label: "ไม่อนุมัติ" }].
        map((f) => {
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
                boxShadow: statusFilter === f.key ? "0 4px 12px hsl(var(--primary) / 0.3)" : "none"
              }}>

              {f.label}
              {f.key === "pending" && count > 0 &&
              <span
                className="absolute -top-2 -right-2 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: "#ef4444", color: "#fff", fontSize: "10px" }}>

                  {count}
                </span>
              }
            </button>);

        })}
      </div>

      {/* Search + Type filter */}
      <div className="card-base p-3 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อพนักงาน, แผนก, รหัส..."
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />

        </div>
        <div className="relative">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as OTType | "all")}
            className="h-10 pl-3 pr-8 rounded-xl border border-border bg-background text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30">

            <option value="all">ทุกประเภท</option>
            <option value="workday">วันทำงาน</option>
            <option value="holiday">วันหยุด</option>
            <option value="special">กรณีพิเศษ</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>
      <div className="card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">รหัส</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">พนักงาน</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">แผนก</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">วันที่</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">เวลา</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">ชม.</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground hidden sm:table-cell">ประเภท</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">สถานะ</th>
                {hasAdminAccess && pendingCount > 0 && <th className="text-center px-4 py-3 font-semibold text-muted-foreground">จัดการ</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ?
              <tr>
                  <td colSpan={9} className="text-center py-12 text-muted-foreground">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p>ไม่พบรายการคำขอ OT</p>
                  </td>
                </tr> :

              filtered.map((req) => {
                const statusCfg = statusConfig[req.status];
                const StatusIcon = statusCfg.icon;
                const typeCfg = otTypeLabels[req.type];
                return (
                  <tr key={req.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{req.id}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{req.employeeName}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{req.department}</td>
                      <td className="px-4 py-3">{new Date(req.date).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}</td>
                      <td className="px-4 py-3 hidden lg:table-cell font-mono text-xs">
                        {req.startTime} - {req.endTime}
                      </td>
                      <td className="px-4 py-3 text-center font-bold">{req.hours}</td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${typeCfg.className}`}>
                          {typeCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`${statusCfg.className} inline-flex items-center gap-1`}>
                          <StatusIcon className="w-3 h-3" /> {statusCfg.label}
                        </span>
                      </td>
                      {hasAdminAccess && pendingCount > 0 && (
                        <td className="px-4 py-3 text-center">
                          {req.status === "pending" ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleApprove(req.id)}
                                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                                style={{ color: "hsl(90 100% 30%)" }}
                                title="อนุมัติ">
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleReject(req.id)}
                                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-destructive"
                                title="ไม่อนุมัติ">
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          ) : null}
                        </td>
                      )}
                    </tr>);

              })
              }
            </tbody>
          </table>
        </div>

        {/* Footer summary */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
          <span>แสดง {filtered.length} จาก {userRequests.length} รายการ</span>
          <span>รวม OT (อนุมัติ): <span className="font-bold text-foreground">{stats.totalHours} ชั่วโมง</span></span>
        </div>
      </div>

      {/* Dialog */}
      <OTRequestDialog open={showForm} onClose={() => setShowForm(false)} onSubmit={handleAdd} />
    </div>);

};

export default OvertimeRequest;