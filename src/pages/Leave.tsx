import React, { useState, useEffect, useCallback } from "react";
import { Plus, Download } from "lucide-react";
import LeaveQuotaCards, { type LeaveType } from "@/components/leave/LeaveQuotaCards";
import LeaveTable, { type LeaveRecord } from "@/components/leave/LeaveTable";
import LeaveRequestDialog from "@/components/leave/LeaveRequestDialog";
import { useToast } from "@/hooks/use-toast";
import { usePendingCounts } from "@/contexts/PendingCountsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployees } from "@/contexts/EmployeeContext";
import { supabase } from "@/integrations/supabase/client";

const Leave = () => {
  const { toast } = useToast();
  const { setLeavePending } = usePendingCounts();
  const { currentUser, hasAdminAccess } = useAuth();
  const { employees: allEmployees } = useEmployees();
  const currentUserName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "";
  const employeeNames = React.useMemo(() => {
    const names = allEmployees.map((e) => `${e.firstName} ${e.lastName}`);
    if (currentUserName) {
      return [currentUserName, ...names.filter((n) => n !== currentUserName)];
    }
    return names;
  }, [allEmployees, currentUserName]);

  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch leave types
  const fetchLeaveTypes = useCallback(async () => {
    const { data } = await supabase
      .from("leave_types")
      .select("*")
      .order("sort_order");
    if (data) {
      setLeaveTypes(data.map((lt: any) => ({
        id: lt.id,
        name: lt.name,
        quota: lt.quota,
        used: 0, // will be calculated from leave_requests
        color: lt.color,
        requireDoc: lt.require_doc,
      })));
    }
  }, []);

  // Fetch leave requests
  const fetchLeaves = useCallback(async () => {
    const { data } = await supabase
      .from("leave_requests")
      .select("*, employees(first_name, last_name)")
      .order("created_at", { ascending: false });
    if (data) {
      const records: LeaveRecord[] = data.map((r: any) => ({
        id: r.id,
        name: r.employees ? `${r.employees.first_name} ${r.employees.last_name}` : "",
        type: r.leave_type_name,
        from: r.date_from,
        to: r.date_to,
        days: r.days,
        reason: r.reason,
        status: r.status,
        file: r.has_file,
      }));
      setLeaves(records);

      // Calculate used quota per leave type
      setLeaveTypes((prev) => prev.map((lt) => {
        const used = records
          .filter((r) => r.type === lt.name && r.status !== "rejected")
          .reduce((sum, r) => sum + r.days, 0);
        return { ...lt, used };
      }));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLeaveTypes().then(() => fetchLeaves());
  }, [fetchLeaveTypes, fetchLeaves]);

  // Filter leaves for employee role
  const userLeaves = hasAdminAccess
    ? leaves
    : leaves.filter((l) => currentUser && l.name === `${currentUser.firstName} ${currentUser.lastName}`);

  useEffect(() => {
    setLeavePending(userLeaves.filter((l) => l.status === "pending").length);
  }, [userLeaves, setLeavePending]);

  const filtered = userLeaves.filter((l) => filterStatus === "all" || l.status === filterStatus);

  const handleSubmit = async (record: Omit<LeaveRecord, "id">) => {
    // Find employee id
    const emp = allEmployees.find((e) => `${e.firstName} ${e.lastName}` === record.name);
    if (!emp) return;

    // Find leave type id
    const lt = leaveTypes.find((t) => t.name === record.type);

    await supabase.from("leave_requests").insert({
      employee_id: emp.id,
      leave_type_id: lt?.id || null,
      leave_type_name: record.type,
      date_from: record.from,
      date_to: record.to,
      days: record.days,
      reason: record.reason,
      status: "pending",
      has_file: record.file,
    });

    fetchLeaves();
    toast({ title: "สำเร็จ", description: "ยื่นคำขอลาเรียบร้อยแล้ว" });
  };

  const handleApprove = async (id: string) => {
    await supabase.from("leave_requests").update({ status: "approved" }).eq("id", id);
    setLeaves((prev) => prev.map((l) => l.id === id ? { ...l, status: "approved" } : l));
    toast({ title: "อนุมัติแล้ว", description: "อนุมัติคำขอลาเรียบร้อยแล้ว" });
  };

  const handleReject = async (id: string) => {
    await supabase.from("leave_requests").update({ status: "rejected" }).eq("id", id);
    setLeaves((prev) => prev.map((l) => l.id === id ? { ...l, status: "rejected" } : l));
    toast({ title: "ไม่อนุมัติ", description: "ปฏิเสธคำขอลาเรียบร้อยแล้ว", variant: "destructive" });
  };

  return (
    <div className="space-y-5">
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
