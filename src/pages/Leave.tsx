import React, { useState, useEffect } from "react";
import { Plus, Download } from "lucide-react";
import LeaveQuotaCards, { type LeaveType } from "@/components/leave/LeaveQuotaCards";
import LeaveTable, { type LeaveRecord } from "@/components/leave/LeaveTable";
import LeaveRequestDialog from "@/components/leave/LeaveRequestDialog";
import { useToast } from "@/hooks/use-toast";
import { usePendingCounts } from "@/contexts/PendingCountsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployees } from "@/contexts/EmployeeContext";

const initialLeaveTypes: LeaveType[] = [
  { id: 1, name: "ลาป่วย", quota: 30, used: 5, color: "#FF870F", requireDoc: true },
  { id: 2, name: "ลาพักร้อน", quota: 10, used: 3, color: "#87FF0F", requireDoc: false },
  { id: 3, name: "ลากิจ", quota: 7, used: 2, color: "#6B7280", requireDoc: false },
  { id: 4, name: "ลาคลอด", quota: 98, used: 0, color: "#60a5fa", requireDoc: true },
];

const initialLeaves: LeaveRecord[] = [
  { id: 1, name: "สมชาย ใจดี", type: "ลาป่วย", from: "18/02/2569", to: "19/02/2569", days: 2, reason: "ไข้หวัดใหญ่", status: "approved", file: true },
  { id: 2, name: "นิดา สุขใจ", type: "ลาพักร้อน", from: "20/02/2569", to: "21/02/2569", days: 2, reason: "ท่องเที่ยว", status: "pending", file: false },
  { id: 3, name: "มานะ ขยัน", type: "ลากิจ", from: "22/02/2569", to: "22/02/2569", days: 1, reason: "ธุระส่วนตัว", status: "pending", file: false },
  { id: 4, name: "กาญจนา ใสซื่อ", type: "ลาป่วย", from: "15/02/2569", to: "17/02/2569", days: 3, reason: "ผ่าตัด", status: "approved", file: true },
  { id: 5, name: "ประสิทธิ์ ทำได้", type: "ลาพักร้อน", from: "25/02/2569", to: "28/02/2569", days: 4, reason: "ครอบครัว", status: "rejected", file: false },
];

const Leave = () => {
  const { toast } = useToast();
  const { setLeavePending } = usePendingCounts();
  const { currentUser, hasAdminAccess } = useAuth();
  const { employees: allEmployees } = useEmployees();
  const currentUserName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "";
  const employeeNames = React.useMemo(() => {
    const names = allEmployees.map((e) => `${e.firstName} ${e.lastName}`);
    // Put current user first
    if (currentUserName) {
      return [currentUserName, ...names.filter((n) => n !== currentUserName)];
    }
    return names;
  }, [allEmployees, currentUserName]);
  const [leaveTypes, setLeaveTypes] = useState(initialLeaveTypes);
  const [leaves, setLeaves] = useState(initialLeaves);
  const [filterStatus, setFilterStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Filter leaves for employee role - only show their own
  const userLeaves = hasAdminAccess
    ? leaves
    : leaves.filter((l) => currentUser && l.name === `${currentUser.firstName} ${currentUser.lastName}`);

  // Sync pending count to context
  useEffect(() => {
    setLeavePending(userLeaves.filter((l) => l.status === "pending").length);
  }, [userLeaves, setLeavePending]);

  const filtered = userLeaves.filter((l) => filterStatus === "all" || l.status === filterStatus);

  const handleSubmit = (record: Omit<LeaveRecord, "id">) => {
    const newId = Math.max(0, ...leaves.map((l) => l.id)) + 1;
    setLeaves((prev) => [{ ...record, id: newId }, ...prev]);

    // Update quota used
    const lt = leaveTypes.find((t) => t.name === record.type);
    if (lt) {
      setLeaveTypes((prev) => prev.map((t) => t.id === lt.id ? { ...t, used: t.used + record.days } : t));
    }

    toast({ title: "สำเร็จ", description: "ยื่นคำขอลาเรียบร้อยแล้ว" });
  };

  const handleApprove = (id: number) => {
    setLeaves((prev) => prev.map((l) => l.id === id ? { ...l, status: "approved" } : l));
    toast({ title: "อนุมัติแล้ว", description: "อนุมัติคำขอลาเรียบร้อยแล้ว" });
  };

  const handleReject = (id: number) => {
    setLeaves((prev) => prev.map((l) => l.id === id ? { ...l, status: "rejected" } : l));
    toast({ title: "ไม่อนุมัติ", description: "ปฏิเสธคำขอลาเรียบร้อยแล้ว", variant: "destructive" });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display">ระบบลางาน</h2>
          <p className="text-sm text-muted-foreground mt-0.5">จัดการคำขอลาและโควต้าการลา</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", color: "hsl(var(--primary-foreground))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}
          >
            <Plus className="w-4 h-4" />
            ยื่นคำขอลา
          </button>
        </div>
      </div>

      <LeaveQuotaCards leaveTypes={leaveTypes} />

      {/* Filter */}
      <div className="flex items-center justify-between gap-1 sm:gap-2 sm:justify-start sm:flex-wrap">
        {[
          { key: "all", label: "ทั้งหมด" },
          { key: "pending", label: "รออนุมัติ" },
          { key: "approved", label: "อนุมัติแล้ว" },
          { key: "rejected", label: "ไม่อนุมัติ" },
        ].map((f) => {
          const count = f.key === "pending" ? userLeaves.filter((l) => l.status === "pending").length : 0;
          return (
            <button
              key={f.key}
              onClick={() => setFilterStatus(f.key)}
              className="px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-all relative flex-1 sm:flex-none"
              style={{
                background: filterStatus === f.key ? "hsl(var(--primary))" : "hsl(var(--card))",
                color: filterStatus === f.key ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
                border: `1px solid ${filterStatus === f.key ? "hsl(var(--primary))" : "hsl(var(--border))"}`,
                boxShadow: filterStatus === f.key ? "0 4px 12px hsl(var(--primary) / 0.3)" : "none",
              }}
            >
              {f.label}
              {f.key === "pending" && count > 0 && (
                <span
                  className="absolute -top-2 -right-2 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: "#ef4444", color: "#fff", fontSize: "10px" }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <LeaveTable records={filtered} onApprove={hasAdminAccess ? handleApprove : () => {}} onReject={hasAdminAccess ? handleReject : () => {}} hideActions={!hasAdminAccess} />

      <LeaveRequestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        leaveTypes={leaveTypes}
        onSubmit={handleSubmit}
        hasAdminAccess={hasAdminAccess}
        currentUserName={currentUserName}
        employeeNames={employeeNames}
      />
    </div>
  );
};

export default Leave;
