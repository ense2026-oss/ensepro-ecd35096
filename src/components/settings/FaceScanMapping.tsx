import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Save, RefreshCw, Send, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import EmployeeAvatar from "@/components/ui/employee-avatar";

interface Employee {
  id: string;
  prefix: string;
  first_name: string;
  last_name: string;
  nickname: string;
  dept: string;
  position: string;
  face_scan_id: string;
  status: string;
}

interface EnrollStatus {
  employee_id: string;
  device_id: string;
  status: string; // pending | synced | error
  synced_at: string | null;
  error_message: string;
}

interface Device {
  id: string;
  name: string;
  enabled: boolean;
}

const FaceScanMapping = ({ devices }: { devices: Device[] }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [statuses, setStatuses] = useState<EnrollStatus[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "linked" | "unlinked">("all");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: emps }, { data: st }] = await Promise.all([
      supabase
        .from("employees")
        .select("id, prefix, first_name, last_name, nickname, dept, position, face_scan_id, status")
        .eq("status", "active")
        .order("first_name"),
      supabase.from("face_scan_enroll_status").select("*"),
    ]);
    if (emps) setEmployees(emps as Employee[]);
    if (st) setStatuses(st as EnrollStatus[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel("facescan-mapping")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "face_scan_enroll_status" },
        () => fetchAll()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const enabledDevices = useMemo(() => devices.filter((d) => d.enabled), [devices]);

  const statusFor = (employeeId: string): { label: string; tone: string; icon: any } => {
    const rows = statuses.filter((s) => s.employee_id === employeeId);
    if (rows.length === 0) return { label: "ยังไม่ซิงค์", tone: "secondary", icon: Clock };
    if (rows.some((r) => r.status === "error"))
      return { label: "ผิดพลาด", tone: "destructive", icon: AlertCircle };
    if (
      enabledDevices.length > 0 &&
      enabledDevices.every((d) => rows.find((r) => r.device_id === d.id)?.status === "synced")
    )
      return { label: "ซิงค์แล้ว", tone: "default", icon: CheckCircle2 };
    return { label: "บางส่วน", tone: "outline", icon: Clock };
  };

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const fullName = `${e.prefix}${e.first_name} ${e.last_name} ${e.nickname}`;
      const draftValue = drafts[e.id] ?? e.face_scan_id;
      const matchSearch =
        !search ||
        fullName.includes(search) ||
        draftValue.includes(search) ||
        e.dept.includes(search) ||
        e.position.includes(search);
      const linked = (drafts[e.id] ?? e.face_scan_id).trim() !== "";
      const matchFilter =
        filter === "all" || (filter === "linked" ? linked : !linked);
      return matchSearch && matchFilter;
    });
  }, [employees, drafts, search, filter]);

  const linkedCount = employees.filter((e) => (drafts[e.id] ?? e.face_scan_id).trim() !== "").length;
  const unlinkedCount = employees.length - linkedCount;

  const setDraft = (id: string, value: string) =>
    setDrafts((prev) => ({ ...prev, [id]: value }));

  const saveOne = async (emp: Employee) => {
    const value = (drafts[emp.id] ?? emp.face_scan_id).trim();
    if (value === emp.face_scan_id) {
      toast.info("ไม่มีการเปลี่ยนแปลง");
      return;
    }
    // Check duplicates
    if (value && employees.some((e) => e.id !== emp.id && e.face_scan_id === value)) {
      toast.error(`Face Scan ID "${value}" ถูกใช้กับพนักงานคนอื่นแล้ว`);
      return;
    }
    setSavingId(emp.id);
    const { error } = await supabase
      .from("employees")
      .update({ face_scan_id: value })
      .eq("id", emp.id);
    setSavingId(null);
    if (error) return toast.error("บันทึกไม่สำเร็จ: " + error.message);
    toast.success("บันทึกแล้ว");
    setDrafts((prev) => {
      const n = { ...prev };
      delete n[emp.id];
      return n;
    });
    fetchAll();
  };

  const pushAll = async () => {
    if (enabledDevices.length === 0) {
      toast.error("ไม่มีเครื่องสแกนที่เปิดใช้งาน");
      return;
    }
    setPushing(true);
    const { error } = await supabase.functions.invoke("facescan-queue-command", {
      body: { sync_type: "enroll_push", device_id: null, payload: {} },
    });
    setPushing(false);
    if (error) return toast.error("ส่งคำสั่งไม่สำเร็จ: " + error.message);
    toast.success("ส่งคำสั่งซิงค์รายชื่อเรียบร้อย — Bridge จะดำเนินการในรอบถัดไป (≤30 วินาที)");
  };

  return (
    <div className="space-y-4">
      <FaceScanDeviceUsers devices={devices} onChanged={fetchAll} />
      {!loading && linkedCount < employees.length && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          ⚠️ ตอนนี้ผูกรหัสเครื่องสแกนแล้ว <strong>{linkedCount}</strong> จาก{" "}
          <strong>{employees.length}</strong> คน — พนักงานที่ยังไม่ผูกรหัส
          แม้จะสแกนที่เครื่องได้ ระบบจะ <strong>ข้ามรายการนั้นทั้งหมด</strong>{" "}
          (ดูจำนวนที่ถูกข้ามได้ในแท็บ Sync Logs)
        </div>
      )}

      {/* Top stats / actions */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="outline">ทั้งหมด {employees.length}</Badge>
            <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20" variant="outline">
              จับคู่แล้ว {linkedCount}
            </Badge>
            <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20" variant="outline">
              ยังไม่จับคู่ {unlinkedCount}
            </Badge>
            <Badge variant="outline">เครื่องที่เปิดใช้ {enabledDevices.length}</Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchAll}>
              <RefreshCw className="w-4 h-4 mr-1" /> รีเฟรช
            </Button>
            <Button size="sm" onClick={pushAll} disabled={pushing || enabledDevices.length === 0}>
              <Send className="w-4 h-4 mr-1" />
              {pushing ? "กำลังส่ง..." : "ซิงค์รายชื่อไปเครื่อง"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ / Face Scan ID / แผนก"
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "linked", "unlinked"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "ทั้งหมด" : f === "linked" ? "จับคู่แล้ว" : "ยังไม่จับคู่"}
            </Button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="grid gap-2">
        {loading && <Card className="p-8 text-center text-muted-foreground">กำลังโหลด...</Card>}
        {!loading && filtered.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">ไม่พบรายการ</Card>
        )}
        {!loading &&
          filtered.map((emp) => {
            const status = statusFor(emp.id);
            const StatusIcon = status.icon;
            const value = drafts[emp.id] ?? emp.face_scan_id;
            const dirty = drafts[emp.id] !== undefined && drafts[emp.id] !== emp.face_scan_id;
            return (
              <Card key={emp.id} className="p-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <EmployeeAvatar firstName={emp.first_name} size="lg" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {emp.prefix}
                      {emp.first_name} {emp.last_name}
                      {emp.nickname && (
                        <span className="text-xs text-muted-foreground ml-1">({emp.nickname})</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {emp.dept} · {emp.position}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={value}
                      onChange={(e) => setDraft(emp.id, e.target.value)}
                      placeholder="Enroll No."
                      className="w-32 h-9 font-mono text-sm"
                    />
                    <Button
                      size="sm"
                      variant={dirty ? "default" : "outline"}
                      disabled={!dirty || savingId === emp.id}
                      onClick={() => saveOne(emp)}
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                    <Badge
                      variant={status.tone === "destructive" ? "destructive" : "outline"}
                      className="gap-1 whitespace-nowrap"
                    >
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </Badge>
                  </div>
                </div>
              </Card>
            );
          })}
      </div>
    </div>
  );
};

export default FaceScanMapping;
