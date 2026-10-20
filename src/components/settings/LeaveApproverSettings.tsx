import { useMemo, useState, useEffect } from "react";
import { Pencil, Search, Loader2, Users, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useEmployees } from "@/contexts/EmployeeContext";
import EmployeeAvatar from "@/components/ui/employee-avatar";
import PaginationBar from "@/components/ui/pagination-bar";
import ApproverMultiSelect from "@/components/approvals/ApproverMultiSelect";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter,
} from "@/components/ui/dialog";
import { useApprovalAssignments, saveEmployeeApprovers, applyApproversBulk, type ApprovalRequestType } from "@/lib/approvalAssignments";
import { logInfo } from "@/lib/systemLog";

const PAGE_SIZE = 20;

// ข้อความแยกตามประเภทคำขอ (ตารางเดียวกัน แยกด้วย request_type)
const LABELS: Record<"leave" | "time_edit", { title: string; what: string; act: string }> = {
  leave: { title: "ผู้อนุมัติการลา", what: "ใบลา", act: "อนุมัติ" },
  time_edit: { title: "ผู้อนุมัติแก้ไขเวลา", what: "คำขอแก้ไขเวลา", act: "อนุมัติ/ปฏิเสธ" },
};

// ตั้งผู้อนุมัติการลาแบบรายบุคคล — ดู/แก้รายคน หรือตั้งทีเดียวทั้งกลุ่มตามสังกัด/ตำแหน่ง
// (ตัวอย่าง: พขร. ทุกคนใช้ นายสถานี + ผช.นายสถานี แล้วค่อยแก้เฉพาะคนที่ต่างออกไป)
export default function LeaveApproverSettings({ requestType = "leave" }: { requestType?: "leave" | "time_edit" }) {
  const L = LABELS[requestType];
  const rt: ApprovalRequestType = requestType;
  const { employees } = useEmployees();
  const { assignments, loading, refetch, approversOf } = useApprovalAssignments(rt);

  const people = useMemo(
    () => employees.filter((e) => e.status !== "inactive" && (e.role || "").toLowerCase() !== "admin"),
    [employees],
  );
  const nameOf = useMemo(
    () => new Map(employees.map((e) => [e.id, `${e.prefix || ""}${e.firstName} ${e.lastName}`.trim()])),
    [employees],
  );

  // ─── ตัวกรอง ───
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("all");
  const [position, setPosition] = useState("all");
  const [onlyUnset, setOnlyUnset] = useState(false);
  const [page, setPage] = useState(1);

  const depts = useMemo(() => [...new Set(people.map((e) => e.dept).filter(Boolean))].sort(), [people]);
  const positions = useMemo(
    () => [...new Set(people.filter((e) => dept === "all" || e.dept === dept).map((e) => e.position).filter(Boolean))].sort(),
    [people, dept],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people.filter((e) => {
      if (dept !== "all" && e.dept !== dept) return false;
      if (position !== "all" && e.position !== position) return false;
      if (onlyUnset && approversOf(e.id).length > 0) return false;
      if (q && !`${e.prefix || ""}${e.firstName} ${e.lastName} ${e.nickname || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [people, search, dept, position, onlyUnset, approversOf]);

  useEffect(() => { setPage(1); }, [search, dept, position, onlyUnset]);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const assignedCount = useMemo(() => new Set(assignments.map((a) => a.employee_id)).size, [assignments]);

  // ─── แก้รายคน ───
  const [editId, setEditId] = useState<string | null>(null);
  const [editIds, setEditIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const editing = editId ? employees.find((e) => e.id === editId) : null;

  const openEdit = (id: string) => { setEditId(id); setEditIds(approversOf(id)); };
  const saveEdit = async () => {
    if (!editId) return;
    setSaving(true);
    try {
      await saveEmployeeApprovers(editId, editIds, rt);
      await refetch();
      logInfo("account", `ตั้ง${L.title}: ${nameOf.get(editId) || editId}`, { employeeId: editId, approverIds: editIds, requestType: rt });
      toast.success("บันทึกผู้อนุมัติแล้ว");
      setEditId(null);
    } catch (e: any) {
      toast.error(e?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  // ─── ตั้งเป็นกลุ่ม ───
  const [bulkIds, setBulkIds] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState<"add" | "replace">("replace");
  const [bulkSaving, setBulkSaving] = useState(false);
  const runBulk = async () => {
    if (bulkIds.length === 0) { toast.error("กรุณาเลือกผู้อนุมัติอย่างน้อย 1 คน"); return; }
    if (filtered.length === 0) { toast.error("ไม่มีพนักงานตามตัวกรองที่เลือก"); return; }
    const verb = bulkMode === "replace" ? "ตั้งแทนที่ผู้อนุมัติเดิม" : "เพิ่มผู้อนุมัติ";
    const names = bulkIds.map((id) => nameOf.get(id)).filter(Boolean).join(", ");
    if (!confirm(`${verb}ให้พนักงาน ${filtered.length} คน (ตามตัวกรองที่แสดงอยู่)\nผู้อนุมัติ: ${names}\n\nยืนยันหรือไม่?`)) return;
    setBulkSaving(true);
    try {
      const res = await applyApproversBulk(filtered.map((e) => e.id), bulkIds, bulkMode, rt);
      await refetch();
      logInfo("account", `ตั้ง${L.title}เป็นกลุ่ม (${bulkMode}) ${res.employees} คน`, { count: res.employees, approverIds: bulkIds, mode: bulkMode, requestType: rt });
      toast.success(`ตั้งผู้อนุมัติให้ ${res.employees} คนแล้ว`);
      setBulkIds([]);
    } catch (e: any) {
      toast.error(e?.message || "ตั้งผู้อนุมัติไม่สำเร็จ");
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card-base p-5 space-y-1.5">
        <h4 className="font-semibold">{L.title} — กำหนดรายบุคคล</h4>
        <p className="text-sm text-muted-foreground">
          กำหนดว่าใครอนุมัติ{L.what}ของพนักงานแต่ละคน เลือกได้หลายคน <b className="text-foreground">คนใดคนหนึ่งอนุมัติก็จบ</b> ·
          ผู้อนุมัติได้รับแจ้งเตือนและกด{L.act}ได้เฉพาะ{L.what}ของลูกทีมตัวเอง ·
          พนักงานที่ยังไม่ได้ตั้ง ใช้ผู้อนุมัติเดิมตามสิทธิ์ของ role (admin/hr ดำเนินการแทนได้ทุกรายการเสมอ)
        </p>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          ตั้งแล้ว {assignedCount} จาก {people.length} คน
        </p>
      </div>

      {/* ตัวกรอง + ตั้งเป็นกลุ่ม */}
      <div className="card-base p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อพนักงาน..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border bg-muted/30 outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <select
            value={dept}
            onChange={(e) => { setDept(e.target.value); setPosition("all"); }}
            className="px-3 py-2 text-sm rounded-xl border bg-muted/30 outline-none cursor-pointer"
          >
            <option value="all">ทุกสังกัด</option>
            {depts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl border bg-muted/30 outline-none cursor-pointer"
          >
            <option value="all">ทุกตำแหน่ง</option>
            {positions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={onlyUnset} onChange={(e) => setOnlyUnset(e.target.checked)} className="accent-primary" />
            เฉพาะที่ยังไม่ตั้ง
          </label>
        </div>

        <div className="rounded-xl border border-dashed p-3 space-y-2.5" style={{ borderColor: "hsl(var(--border))" }}>
          <p className="text-xs font-semibold flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> ตั้งผู้อนุมัติให้ทุกคนที่แสดงอยู่ตามตัวกรอง ({filtered.length} คน)
          </p>
          <ApproverMultiSelect value={bulkIds} onChange={setBulkIds} placeholder="เลือกผู้อนุมัติสำหรับกลุ่มนี้..." />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="radio" checked={bulkMode === "replace"} onChange={() => setBulkMode("replace")} className="accent-primary" />
              แทนที่ของเดิม
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="radio" checked={bulkMode === "add"} onChange={() => setBulkMode("add")} className="accent-primary" />
              เพิ่มจากของเดิม
            </label>
            <button
              onClick={runBulk}
              disabled={bulkSaving || bulkIds.length === 0 || filtered.length === 0}
              className="ml-auto px-4 py-2 rounded-xl text-sm font-bold text-primary-foreground bg-primary hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            >
              {bulkSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              ตั้งให้ {filtered.length} คน
            </button>
          </div>
        </div>
      </div>

      {/* รายชื่อ */}
      <div className="card-base overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : paged.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">ไม่พบพนักงาน</p>
        ) : (
          <div>
            {paged.map((e) => {
              const ids = approversOf(e.id);
              return (
                <div key={e.id} className="flex items-start gap-3 px-4 py-3 border-b last:border-0" style={{ borderColor: "hsl(var(--border))" }}>
                  <EmployeeAvatar photoUrl={e.photoUrl} avatar={e.avatar} avatarColor={e.avatarColor} avatarTextColor={e.avatarTextColor} firstName={e.firstName} size="sm" rounded="full" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{`${e.prefix || ""}${e.firstName} ${e.lastName}`}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{[e.position, e.dept].filter(Boolean).join(" · ")}</p>
                    {ids.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {ids.map((id) => (
                          <span key={id} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                            {nameOf.get(id) || "ไม่พบพนักงาน"}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground mt-1">ยังไม่ตั้ง — ใช้ผู้อนุมัติเดิม (admin/hr)</p>
                    )}
                  </div>
                  <button onClick={() => openEdit(e.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground flex-shrink-0" title="แก้ไขผู้อนุมัติ" aria-label="แก้ไขผู้อนุมัติ">
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {filtered.length > 0 && <PaginationBar page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />}
      </div>

      <Dialog open={!!editId} onOpenChange={(v) => { if (!v) setEditId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold pb-[10px]">
              {L.title} — {editing ? `${editing.prefix || ""}${editing.firstName} ${editing.lastName}` : ""}
            </DialogTitle>
            <DialogDescription className="sr-only">กำหนด{L.title}ของพนักงาน</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <ApproverMultiSelect value={editIds} onChange={setEditIds} excludeEmployeeId={editId || undefined} />
          </DialogBody>
          <DialogFooter>
            <button onClick={() => setEditId(null)} className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">ยกเลิก</button>
            <button onClick={saveEdit} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-bold text-primary-foreground bg-primary hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} บันทึก
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
