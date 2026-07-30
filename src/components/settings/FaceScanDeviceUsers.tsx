import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, RefreshCw, Link2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface DeviceUser {
  id: string;
  device_id: string;
  pin: string;
  name: string;
  matched_employee_id: string | null;
  last_seen_at: string;
}

interface EmployeeLite {
  id: string;
  prefix: string;
  first_name: string;
  last_name: string;
  nickname: string;
  face_scan_id: string;
}

interface Device {
  id: string;
  name: string;
  enabled: boolean;
}

const normalize = (s: string) => s.replace(/\s+/g, "").toLowerCase();

const FaceScanDeviceUsers = ({
  devices,
  onChanged,
}: {
  devices: Device[];
  onChanged?: () => void;
}) => {
  const [users, setUsers] = useState<DeviceUser[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [pulling, setPulling] = useState(false);
  const [applying, setApplying] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: du }, { data: emps }] = await Promise.all([
      supabase
        .from("face_scan_device_users")
        .select("id, device_id, pin, name, matched_employee_id, last_seen_at")
        .order("pin"),
      supabase
        .from("employees")
        .select("id, prefix, first_name, last_name, nickname, face_scan_id")
        .eq("status", "active"),
    ]);
    setUsers((du ?? []) as DeviceUser[]);
    setEmployees((emps ?? []) as EmployeeLite[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel("facescan-device-users")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "face_scan_device_users" },
        () => fetchAll()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const deviceName = (id: string) => devices.find((d) => d.id === id)?.name ?? "—";

  // Unique PIN list across devices (same person may exist on both machines)
  const uniqueUsers = useMemo(() => {
    const map = new Map<string, DeviceUser & { devices: string[] }>();
    for (const u of users) {
      const key = u.pin;
      const prev = map.get(key);
      if (prev) prev.devices.push(u.device_id);
      else map.set(key, { ...u, devices: [u.device_id] });
    }
    return [...map.values()];
  }, [users]);

  const employeeByPin = useMemo(() => {
    const m = new Map<string, EmployeeLite>();
    for (const e of employees) if (e.face_scan_id) m.set(e.face_scan_id.trim(), e);
    return m;
  }, [employees]);

  // Auto-match suggestions: device user name -> employee full name / nickname
  const suggestions = useMemo(() => {
    const takenPins = new Set(employees.map((e) => e.face_scan_id.trim()).filter(Boolean));
    const usedEmp = new Set<string>();
    const out: { pin: string; deviceName: string; employee: EmployeeLite; rawName: string }[] = [];
    for (const u of uniqueUsers) {
      if (employeeByPin.has(u.pin) || takenPins.has(u.pin)) continue;
      const n = normalize(u.name);
      if (!n) continue;
      const match = employees.find((e) => {
        if (usedEmp.has(e.id) || e.face_scan_id.trim()) return false;
        const full = normalize(`${e.first_name}${e.last_name}`);
        const rev = normalize(`${e.last_name}${e.first_name}`);
        const nick = normalize(e.nickname);
        return n === full || n === rev || (nick.length > 1 && n === nick);
      });
      if (match) {
        usedEmp.add(match.id);
        out.push({
          pin: u.pin,
          deviceName: deviceName(u.device_id),
          employee: match,
          rawName: u.name,
        });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniqueUsers, employees, employeeByPin]);

  const matchedCount = uniqueUsers.filter((u) => employeeByPin.has(u.pin)).length;

  const pullFromDevices = async () => {
    const enabled = devices.filter((d) => d.enabled);
    if (enabled.length === 0) return toast.error("ไม่มีเครื่องสแกนที่เปิดใช้งาน");
    setPulling(true);
    const { error } = await supabase.functions.invoke("facescan-queue-command", {
      body: { sync_type: "pull_users", device_id: null, payload: {} },
    });
    setPulling(false);
    if (error) return toast.error("ส่งคำสั่งไม่สำเร็จ: " + error.message);
    toast.success(
      "ส่งคำสั่งดึงรายชื่อแล้ว — เครื่องจะตอบกลับภายใน 30 วินาที รายการจะขึ้นเองอัตโนมัติ"
    );
  };

  const applySuggestions = async () => {
    if (suggestions.length === 0) return;
    setApplying(true);
    let done = 0;
    for (const s of suggestions) {
      const { error } = await supabase
        .from("employees")
        .update({ face_scan_id: s.pin })
        .eq("id", s.employee.id);
      if (!error) done++;
    }
    setApplying(false);
    toast.success(`จับคู่สำเร็จ ${done}/${suggestions.length} คน`);
    await fetchAll();
    onChanged?.();
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="font-medium text-sm">รายชื่อผู้ใช้ในเครื่องสแกน</div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">ในเครื่องทั้งหมด {uniqueUsers.length} รหัส</Badge>
            <Badge
              variant="outline"
              className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
            >
              จับคู่แล้ว {matchedCount}
            </Badge>
            <Badge
              variant="outline"
              className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
            >
              ยังไม่จับคู่ {uniqueUsers.length - matchedCount}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchAll}>
            <RefreshCw className="w-4 h-4 mr-1" /> รีเฟรช
          </Button>
          <Button size="sm" onClick={pullFromDevices} disabled={pulling}>
            <Download className="w-4 h-4 mr-1" />
            {pulling ? "กำลังส่งคำสั่ง..." : "ดึงรายชื่อจากเครื่อง"}
          </Button>
        </div>
      </div>

      {!loading && uniqueUsers.length === 0 && (
        <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
          ยังไม่มีข้อมูลรายชื่อจากเครื่อง — กด <strong>“ดึงรายชื่อจากเครื่อง”</strong>{" "}
          แล้วรอประมาณ 30 วินาที (เครื่องต้องออนไลน์อยู่) รายการจะขึ้นเองอัตโนมัติ
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs">
              ระบบเทียบชื่อแล้วพบคู่ที่ตรงกัน <strong>{suggestions.length}</strong> รายการ
            </div>
            <Button size="sm" onClick={applySuggestions} disabled={applying}>
              <Link2 className="w-4 h-4 mr-1" />
              {applying ? "กำลังจับคู่..." : "ยืนยันจับคู่ทั้งหมด"}
            </Button>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {suggestions.map((s) => (
              <div key={s.pin} className="text-xs flex items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  {s.pin}
                </Badge>
                <span className="text-muted-foreground truncate">{s.rawName}</span>
                <span className="text-muted-foreground">→</span>
                <span className="truncate">
                  {s.employee.prefix}
                  {s.employee.first_name} {s.employee.last_name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {uniqueUsers.length > 0 && (
        <div className="max-h-72 overflow-y-auto rounded-md border divide-y">
          {uniqueUsers.map((u) => {
            const emp = employeeByPin.get(u.pin);
            return (
              <div key={u.pin} className="flex items-center gap-2 p-2 text-xs">
                <Badge variant="outline" className="font-mono">
                  {u.pin}
                </Badge>
                <span className="flex-1 truncate">{u.name || "(ไม่มีชื่อในเครื่อง)"}</span>
                <span className="text-muted-foreground truncate hidden sm:block">
                  {u.devices.map(deviceName).join(", ")}
                </span>
                {emp ? (
                  <Badge className="gap-1" variant="outline">
                    <CheckCircle2 className="w-3 h-3" />
                    {emp.first_name} {emp.last_name}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600">
                    ยังไม่จับคู่
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export default FaceScanDeviceUsers;
