import React, { useState, useEffect, useCallback } from "react";
import { Plus, Download } from "lucide-react";
import LeaveQuotaCards, { type LeaveType } from "@/components/leave/LeaveQuotaCards";
import LeaveTable, { type LeaveRecord } from "@/components/leave/LeaveTable";
import LeaveRequestDialog from "@/components/leave/LeaveRequestDialog";
import { useToast } from "@/hooks/use-toast";
import { usePendingCounts } from "@/contexts/PendingCountsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployees } from "@/contexts/EmployeeContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { supabase } from "@/integrations/supabase/client";
import { notifyApprovers, notifyRequester } from "@/utils/notifications";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Leave = () => {
  const { toast } = useToast();
  const { setLeavePending } = usePendingCounts();
  const { currentUser, role, user } = useAuth();
  const { employees: allEmployees } = useEmployees();
  const { canAction, getScope } = usePermissions();

  const roleKey = role || "employee";
  const canAdd = canAction(roleKey, "leave", "add");
  const canApprove = canAction(roleKey, "leave", "approve");
  const scope = getScope(roleKey, "leave");

  const currentEmployee = allEmployees.find((e) => e.id === currentUser?.employeeId);
  const currentDept = currentEmployee?.dept || currentUser?.dept || "";

  const scopedEmployees = React.useMemo(() => {
    if (scope === "self") return allEmployees.filter((e) => e.id === currentUser?.employeeId);
    if (scope === "department") return allEmployees.filter((e) => e.dept === currentDept);
    return allEmployees;
  }, [allEmployees, scope, currentUser?.employeeId, currentDept]);

  const currentUserName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "";
  const employeeNames = React.useMemo(() => {
    const names = scopedEmployees.map((e) => `${e.firstName} ${e.lastName}`);
    if (currentUserName && names.includes(currentUserName)) {
      return [currentUserName, ...names.filter((n) => n !== currentUserName)];
    }
    return names.length > 0 ? names : (currentUserName ? [currentUserName] : []);
  }, [scopedEmployees, currentUserName]);

  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingRecord, setEditingRecord] = useState<LeaveRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
        used: 0,
        color: lt.color,
        requireDoc: lt.require_doc,
      })));
    }
  }, []);

  const fetchLeaves = useCallback(async () => {
    const { data } = await supabase
      .from("leave_requests")
      .select("*, employees(first_name, last_name, dept)")
      .order("created_at", { ascending: false });
    if (data) {
      const records: LeaveRecord[] = data.map((r: any) => ({
        id: r.id,
        employeeId: r.employee_id,
        name: r.employees ? `${r.employees.first_name} ${r.employees.last_name}` : "",
        dept: r.employees?.dept || "",
        type: r.leave_type_name,
        from: r.date_from,
        to: r.date_to,
        days: r.days,
        reason: r.reason,
        status: r.status,
        file: r.has_file,
        fileUrl: r.file_url || undefined,
      }));
      setLeaves(records);

      const quotaRecords = scope === "self"
        ? records.filter((r) => r.employeeId === currentUser?.employeeId)
        : records;

      setLeaveTypes((prev) => prev.map((lt) => {
        const used = quotaRecords
          .filter((r) => r.type === lt.name && r.status !== "rejected")
          .reduce((sum, r) => sum + r.days, 0);
        return { ...lt, used };
      }));
    }
    setLoading(false);
  }, [scope, currentUser?.employeeId]);

  useEffect(() => {
    fetchLeaveTypes().then(() => fetchLeaves());
  }, [fetchLeaveTypes, fetchLeaves]);

  const scopedLeaves = React.useMemo(() => {
    if (scope === "self") return leaves.filter((l) => l.employeeId === currentUser?.employeeId);
    if (scope === "department") return leaves.filter((l) => l.dept === currentDept);
    return leaves;
  }, [leaves, scope, currentUser?.employeeId, currentDept]);

  useEffect(() => {
    setLeavePending(scopedLeaves.filter((l) => l.status === "pending").length);
  }, [scopedLeaves, setLeavePending]);

  const filtered = scopedLeaves.filter((l) => filterStatus === "all" || l.status === filterStatus);

  // Upload file to storage
  const uploadFile = async (file: File, leaveId: string): Promise<string | null> => {
    const userId = user?.id;
    if (!userId) return null;
    const ext = file.name.split(".").pop();
    const path = `${userId}/${leaveId}.${ext}`;
    const { error } = await supabase.storage.from("leave-attachments").upload(path, file, { upsert: true });
    if (error) {
      console.error("Upload error:", error);
      return null;
    }
    return path;
  };

  const handleSubmit = async (record: Omit<LeaveRecord, "id">, file?: File) => {
    const emp = allEmployees.find((e) => `${e.firstName} ${e.lastName}` === record.name);
    if (!emp) return;
    const lt = leaveTypes.find((t) => t.name === record.type);
    if (!lt) return;

    if (editingRecord) {
      // Update existing
      const updateData: any = {
        leave_type_id: lt.id,
        leave_type_name: record.type,
        date_from: record.from,
        date_to: record.to,
        days: record.days,
        reason: record.reason,
        has_file: record.file,
      };

      if (file) {
        const fileUrl = await uploadFile(file, editingRecord.id);
        if (fileUrl) {
          updateData.file_url = fileUrl;
          updateData.has_file = true;
        }
      }

      await supabase.from("leave_requests").update(updateData).eq("id", editingRecord.id);
      setEditingRecord(null);
      fetchLeaves();
      toast({ title: "สำเร็จ", description: "แก้ไขคำขอลาเรียบร้อยแล้ว" });
    } else {
      // Insert new
      const { data: inserted } = await supabase.from("leave_requests").insert([{
        employee_id: emp.id,
        leave_type_id: lt.id,
        leave_type_name: record.type,
        date_from: record.from,
        date_to: record.to,
        days: record.days,
        reason: record.reason,
        status: "pending",
        has_file: record.file,
      }]).select("id").single();

      if (inserted && file) {
        const fileUrl = await uploadFile(file, inserted.id);
        if (fileUrl) {
          await supabase.from("leave_requests").update({ file_url: fileUrl, has_file: true }).eq("id", inserted.id);
        }
      }

      fetchLeaves();
      toast({ title: "สำเร็จ", description: "ยื่นคำขอลาเรียบร้อยแล้ว" });
    }
  };

  const handleEdit = (record: LeaveRecord) => {
    setEditingRecord(record);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    // Delete attached file if exists
    const record = leaves.find((l) => l.id === deleteId);
    if (record?.fileUrl) {
      await supabase.storage.from("leave-attachments").remove([record.fileUrl]);
    }
    await supabase.from("leave_requests").delete().eq("id", deleteId);
    setDeleteId(null);
    fetchLeaves();
    toast({ title: "สำเร็จ", description: "ลบคำขอลาเรียบร้อยแล้ว" });
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
          {scope !== "self" && (
            <button className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">
              <Download className="w-4 h-4" />
              Export
            </button>
          )}
          {canAdd && (
            <button
              onClick={() => { setEditingRecord(null); setDialogOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", color: "hsl(var(--primary-foreground))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}
            >
              <Plus className="w-4 h-4" />
              ยื่นคำขอลา
            </button>
          )}
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
          const count = f.key === "pending" ? scopedLeaves.filter((l) => l.status === "pending").length : 0;
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

      <LeaveTable
        records={filtered}
        onApprove={canApprove ? handleApprove : () => {}}
        onReject={canApprove ? handleReject : () => {}}
        hideActions={!canApprove}
        currentEmployeeId={currentUser?.employeeId}
        onEdit={handleEdit}
        onDelete={(id) => setDeleteId(id)}
      />

      <LeaveRequestDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditingRecord(null); }}
        leaveTypes={leaveTypes}
        onSubmit={handleSubmit}
        canSelectEmployee={scope !== "self"}
        currentUserName={currentUserName}
        employeeNames={employeeNames}
        editingRecord={editingRecord}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบคำขอลานี้หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Leave;
