import { useState } from "react";
import { Save, Trash2, Plus, ScanFace, Eye, EyeOff, Clock, Users, Settings2, RefreshCw, CheckCircle, XCircle, Search, Link2, Unlink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import TimeInput24 from "@/components/ui/time-input-24";

// ─── Types ───────────────────────────────────────────────────────
interface FaceScannerDevice {
  id: number;
  name: string;
  apiBaseUrl: string;
  username: string;
  password: string;
  enabled: boolean;
}

interface SyncSchedule {
  id: number;
  deviceId: number;
  time: string;
  enabled: boolean;
}

interface SyncLog {
  id: number;
  deviceName: string;
  time: string;
  date: string;
  recordsSynced: number;
  status: "success" | "failed";
  message: string;
}

interface FaceIdMapping {
  id: number;
  employeeName: string;
  employeeCode: string;
  faceScanId: string;
  deviceName: string;
  linked: boolean;
  lastSync: string;
}

// ─── Mock Data ───────────────────────────────────────────────────
const initialDevices: FaceScannerDevice[] = [
  { id: 1, name: "เครื่องสแกนหน้า #1", apiBaseUrl: "https://aifacescan.net/facetime/api/v1", username: "admin", password: "password123", enabled: true },
];

const initialSchedules: SyncSchedule[] = [
  { id: 1, deviceId: 1, time: "06:00", enabled: true },
  { id: 2, deviceId: 1, time: "12:00", enabled: true },
  { id: 3, deviceId: 1, time: "18:00", enabled: false },
];

const initialSyncLogs: SyncLog[] = [
  { id: 1, deviceName: "เครื่องสแกนหน้า #1", time: "06:00", date: "20/02/2569", recordsSynced: 45, status: "success", message: "ซิงค์ข้อมูลสำเร็จ 45 รายการ" },
  { id: 2, deviceName: "เครื่องสแกนหน้า #1", time: "12:00", date: "20/02/2569", recordsSynced: 32, status: "success", message: "ซิงค์ข้อมูลสำเร็จ 32 รายการ" },
  { id: 3, deviceName: "เครื่องสแกนหน้า #1", time: "18:00", date: "19/02/2569", recordsSynced: 0, status: "failed", message: "ไม่สามารถเชื่อมต่อเครื่องได้ (Timeout)" },
  { id: 4, deviceName: "เครื่องสแกนหน้า #1", time: "06:00", date: "19/02/2569", recordsSynced: 50, status: "success", message: "ซิงค์ข้อมูลสำเร็จ 50 รายการ" },
  { id: 5, deviceName: "เครื่องสแกนหน้า #1", time: "12:00", date: "19/02/2569", recordsSynced: 28, status: "success", message: "ซิงค์ข้อมูลสำเร็จ 28 รายการ" },
];

const initialMappings: FaceIdMapping[] = [
  { id: 1, employeeName: "สมชาย ใจดี", employeeCode: "EMP001", faceScanId: "FS-0001", deviceName: "เครื่องสแกนหน้า #1", linked: true, lastSync: "20/02/2569 06:00" },
  { id: 2, employeeName: "สมหญิง รักงาน", employeeCode: "EMP002", faceScanId: "FS-0002", deviceName: "เครื่องสแกนหน้า #1", linked: true, lastSync: "20/02/2569 06:00" },
  { id: 3, employeeName: "มานะ ขยัน", employeeCode: "EMP003", faceScanId: "FS-0003", deviceName: "เครื่องสแกนหน้า #1", linked: true, lastSync: "20/02/2569 06:00" },
  { id: 4, employeeName: "สุดา ดีใจ", employeeCode: "EMP004", faceScanId: "", deviceName: "", linked: false, lastSync: "-" },
  { id: 5, employeeName: "วิชัย เก่งมาก", employeeCode: "EMP005", faceScanId: "FS-0005", deviceName: "เครื่องสแกนหน้า #1", linked: true, lastSync: "19/02/2569 18:00" },
  { id: 6, employeeName: "นิดา สุขใจ", employeeCode: "EMP006", faceScanId: "", deviceName: "", linked: false, lastSync: "-" },
  { id: 7, employeeName: "ประสิทธิ์ ทำได้", employeeCode: "EMP007", faceScanId: "FS-0007", deviceName: "เครื่องสแกนหน้า #1", linked: true, lastSync: "20/02/2569 12:00" },
  { id: 8, employeeName: "กาญจนา ใสซื่อ", employeeCode: "EMP008", faceScanId: "", deviceName: "", linked: false, lastSync: "-" },
];

// ─── Sub-tab type ────────────────────────────────────────────────
type SubTab = "devices" | "sync" | "mapping";

const subTabs: { id: SubTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "devices", label: "การเชื่อมต่อ", icon: Settings2 },
  { id: "sync", label: "ตั้งเวลาซิงค์", icon: Clock },
  { id: "mapping", label: "จับคู่ Face Scan ID", icon: Users },
];

// ═════════════════════════════════════════════════════════════════
const FaceScannerSettings = () => {
  const { toast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("devices");

  // Devices state
  const [devices, setDevices] = useState<FaceScannerDevice[]>(initialDevices);
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({});

  // Sync state
  const [schedules, setSchedules] = useState<SyncSchedule[]>(initialSchedules);
  const [syncLogs] = useState<SyncLog[]>(initialSyncLogs);

  // Mapping state
  const [mappings, setMappings] = useState<FaceIdMapping[]>(initialMappings);
  const [mappingSearch, setMappingSearch] = useState("");
  const [mappingFilter, setMappingFilter] = useState<"all" | "linked" | "unlinked">("all");

  // ─── Device handlers ────────────────────────────────────────────
  const handleChange = (id: number, field: keyof FaceScannerDevice, value: string | boolean) => {
    setDevices((prev) => prev.map((d) => (d.id === id ? { ...d, [field]: value } : d)));
  };

  const handleSave = (id: number) => {
    const device = devices.find((d) => d.id === id);
    if (!device) return;
    if (!device.apiBaseUrl.trim() || !device.username.trim() || !device.password.trim()) {
      toast({ title: "ข้อผิดพลาด", description: "กรุณากรอกข้อมูลให้ครบถ้วน", variant: "destructive" });
      return;
    }
    toast({ title: "สำเร็จ", description: `บันทึกการตั้งค่า "${device.name}" เรียบร้อยแล้ว` });
  };

  const handleDelete = (id: number) => {
    setDevices((prev) => prev.filter((d) => d.id !== id));
    toast({ title: "ลบแล้ว", description: "ลบการตั้งค่าเครื่องสแกนหน้าเรียบร้อยแล้ว" });
  };

  const handleAdd = () => {
    const newId = Math.max(0, ...devices.map((d) => d.id)) + 1;
    setDevices((prev) => [...prev, { id: newId, name: `เครื่องสแกนหน้า #${newId}`, apiBaseUrl: "", username: "", password: "", enabled: false }]);
  };

  const toggleShowPassword = (id: number) => {
    setShowPasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // ─── Sync handlers ─────────────────────────────────────────────
  const handleScheduleToggle = (id: number) => {
    setSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
  };

  const handleScheduleTimeChange = (id: number, time: string) => {
    setSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, time } : s)));
  };

  const handleAddSchedule = () => {
    const newId = Math.max(0, ...schedules.map((s) => s.id)) + 1;
    setSchedules((prev) => [...prev, { id: newId, deviceId: 1, time: "00:00", enabled: false }]);
  };

  const handleDeleteSchedule = (id: number) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    toast({ title: "ลบแล้ว", description: "ลบตารางซิงค์เรียบร้อยแล้ว" });
  };

  const handleSyncNow = () => {
    toast({ title: "กำลังซิงค์...", description: "เริ่มซิงค์ข้อมูลจากเครื่องสแกนหน้าทั้งหมด" });
  };

  const handleSaveSchedules = () => {
    toast({ title: "สำเร็จ", description: "บันทึกตารางซิงค์อัตโนมัติเรียบร้อยแล้ว" });
  };

  // ─── Mapping handlers ──────────────────────────────────────────
  const handleLinkMapping = (id: number) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, linked: true, faceScanId: `FS-${String(m.id).padStart(4, "0")}`, deviceName: "เครื่องสแกนหน้า #1", lastSync: "20/02/2569 12:00" }
          : m
      )
    );
    toast({ title: "สำเร็จ", description: "จับคู่ Face Scan ID เรียบร้อยแล้ว" });
  };

  const handleUnlinkMapping = (id: number) => {
    setMappings((prev) =>
      prev.map((m) => (m.id === id ? { ...m, linked: false, faceScanId: "", deviceName: "", lastSync: "-" } : m))
    );
    toast({ title: "ยกเลิกแล้ว", description: "ยกเลิกการจับคู่ Face Scan ID เรียบร้อยแล้ว" });
  };

  const filteredMappings = mappings.filter((m) => {
    const matchSearch = m.employeeName.includes(mappingSearch) || m.employeeCode.includes(mappingSearch) || m.faceScanId.includes(mappingSearch);
    const matchFilter = mappingFilter === "all" || (mappingFilter === "linked" ? m.linked : !m.linked);
    return matchSearch && matchFilter;
  });

  const linkedCount = mappings.filter((m) => m.linked).length;
  const unlinkedCount = mappings.filter((m) => !m.linked).length;

  // ═════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold font-display">เครื่องสแกนหน้า</h3>
        <p className="text-sm text-muted-foreground mt-0.5">ตั้งค่าการเชื่อมต่อ ซิงค์ข้อมูล และจับคู่ Face Scan ID</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 flex-wrap">
        {subTabs.map((tab) => {
          const isActive = activeSubTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all relative"
              style={{
                background: isActive ? "hsl(var(--primary))" : "hsl(var(--card))",
                color: isActive ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
                border: `1px solid ${isActive ? "hsl(var(--primary))" : "hsl(var(--border))"}`,
                boxShadow: isActive ? "0 4px 12px hsl(var(--primary) / 0.3)" : "none",
              }}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.id === "mapping" && unlinkedCount > 0 && (
                <span
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                  style={{ background: "#ef4444" }}
                >
                  {unlinkedCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ═══ Tab: Devices ═══ */}
      {activeSubTab === "devices" && (
        <div className="space-y-5">
          <div className="flex justify-end">
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-primary-foreground"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}
            >
              <Plus className="w-4 h-4" />
              เพิ่มเครื่อง
            </button>
          </div>

          {devices.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <ScanFace className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">ยังไม่มีเครื่องสแกนหน้าที่ตั้งค่าไว้</p>
              <p className="text-xs mt-1">กดปุ่ม "เพิ่มเครื่อง" เพื่อเริ่มต้น</p>
            </div>
          )}

          {devices.map((device) => (
            <div key={device.id} className="rounded-2xl border p-5 space-y-5" style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-base">{device.name}</h4>
                  <p className="text-sm text-muted-foreground">ตั้งค่า API credentials สำหรับเครื่องนี้</p>
                </div>
                <button onClick={() => handleDelete(device.id)} className="p-2 rounded-lg hover:bg-destructive/10 transition-colors" title="ลบเครื่อง">
                  <Trash2 className="w-5 h-5" style={{ color: "hsl(var(--destructive))" }} />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold">ชื่อเครื่อง</label>
                <input type="text" value={device.name} onChange={(e) => handleChange(device.id, "name", e.target.value)} className="w-full px-4 py-2.5 rounded-xl border bg-background text-sm outline-none focus:ring-2 transition-all" style={{ borderColor: "hsl(var(--border))" }} placeholder="ชื่อเครื่องสแกนหน้า" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold">API Base URL</label>
                <input type="text" value={device.apiBaseUrl} onChange={(e) => handleChange(device.id, "apiBaseUrl", e.target.value)} className="w-full px-4 py-2.5 rounded-xl border bg-background text-sm outline-none focus:ring-2 transition-all" style={{ borderColor: "hsl(var(--border))" }} placeholder="https://aifacescan.net/facetime/api/v1" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Username</label>
                <input type="text" value={device.username} onChange={(e) => handleChange(device.id, "username", e.target.value)} className="w-full px-4 py-2.5 rounded-xl border bg-background text-sm outline-none focus:ring-2 transition-all" style={{ borderColor: "hsl(var(--border))" }} placeholder="username" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Password</label>
                <div className="relative">
                  <input type={showPasswords[device.id] ? "text" : "password"} value={device.password} onChange={(e) => handleChange(device.id, "password", e.target.value)} className="w-full px-4 py-2.5 pr-12 rounded-xl border bg-background text-sm outline-none focus:ring-2 transition-all" style={{ borderColor: "hsl(var(--border))" }} placeholder="••••••••" />
                  <button type="button" onClick={() => toggleShowPassword(device.id)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted transition-colors">
                    {showPasswords[device.id] ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <button type="button" role="switch" aria-checked={device.enabled} onClick={() => handleChange(device.id, "enabled", !device.enabled)} className="relative w-12 h-6 rounded-full transition-colors duration-200" style={{ background: device.enabled ? "hsl(var(--primary))" : "hsl(var(--muted))" }}>
                    <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200" style={{ transform: device.enabled ? "translateX(24px)" : "translateX(0)" }} />
                  </button>
                  <span className="text-sm font-medium">เปิดใช้งาน</span>
                </label>
                <button onClick={() => handleSave(device.id)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-primary-foreground" style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}>
                  <Save className="w-4 h-4" />
                  บันทึก
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ Tab: Sync Schedule ═══ */}
      {activeSubTab === "sync" && (
        <div className="space-y-6">
          {/* Sync schedules */}
          <div className="rounded-2xl border p-5 space-y-5" style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-base">ตารางซิงค์อัตโนมัติ</h4>
                <p className="text-sm text-muted-foreground">กำหนดเวลาดึงข้อมูลจากเครื่องสแกนหน้าอัตโนมัติ</p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSyncNow} className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">
                  <RefreshCw className="w-4 h-4" />
                  ซิงค์ตอนนี้
                </button>
                <button onClick={handleAddSchedule} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-primary-foreground" style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}>
                  <Plus className="w-4 h-4" />
                  เพิ่มเวลา
                </button>
              </div>
            </div>

            {schedules.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">ยังไม่มีตารางซิงค์อัตโนมัติ</p>
            ) : (
              <div className="space-y-3">
                {schedules.map((schedule) => (
                  <div key={schedule.id} className="flex items-center gap-4 p-3 rounded-xl border" style={{ borderColor: "hsl(var(--border))" }}>
                    <button type="button" role="switch" aria-checked={schedule.enabled} onClick={() => handleScheduleToggle(schedule.id)} className="relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0" style={{ background: schedule.enabled ? "hsl(var(--primary))" : "hsl(var(--muted))" }}>
                      <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200" style={{ transform: schedule.enabled ? "translateX(20px)" : "translateX(0)" }} />
                    </button>
                    <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <TimeInput24 value={schedule.time} onChange={(v) => handleScheduleTimeChange(schedule.id, v)} className="w-32" />
                    <span className="text-sm text-muted-foreground flex-1">
                      {devices.find((d) => d.id === schedule.deviceId)?.name ?? "ทุกเครื่อง"}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${schedule.enabled ? "text-green-700 bg-green-100" : "text-muted-foreground bg-muted"}`}>
                      {schedule.enabled ? "เปิดใช้งาน" : "ปิดอยู่"}
                    </span>
                    <button onClick={() => handleDeleteSchedule(schedule.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
                      <Trash2 className="w-4 h-4" style={{ color: "hsl(var(--destructive))" }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button onClick={handleSaveSchedules} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-primary-foreground" style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}>
                <Save className="w-4 h-4" />
                บันทึกตารางซิงค์
              </button>
            </div>
          </div>

          {/* Sync Logs */}
          <div className="rounded-2xl border p-5 space-y-4" style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
            <h4 className="font-bold text-base">ประวัติการซิงค์</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: "hsl(var(--border))" }}>
                    <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground">วันที่</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground">เวลา</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground">เครื่อง</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground">รายการ</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground">สถานะ</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground">รายละเอียด</th>
                  </tr>
                </thead>
                <tbody>
                  {syncLogs.map((log) => (
                    <tr key={log.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors" style={{ borderColor: "hsl(var(--border))" }}>
                      <td className="py-2.5 px-3">{log.date}</td>
                      <td className="py-2.5 px-3 font-medium">{log.time}</td>
                      <td className="py-2.5 px-3">{log.deviceName}</td>
                      <td className="py-2.5 px-3 font-semibold">{log.recordsSynced}</td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${log.status === "success" ? "text-green-700 bg-green-100" : "text-red-700 bg-red-100"}`}>
                          {log.status === "success" ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {log.status === "success" ? "สำเร็จ" : "ล้มเหลว"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">{log.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Tab: Face ID Mapping ═══ */}
      {activeSubTab === "mapping" && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border p-4" style={{ borderColor: "hsl(var(--border))", borderLeft: "4px solid hsl(var(--primary))" }}>
              <p className="text-xs text-muted-foreground font-medium">พนักงานทั้งหมด</p>
              <p className="text-2xl font-bold font-display mt-1">{mappings.length}</p>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: "hsl(var(--border))", borderLeft: "4px solid hsl(90 100% 30%)" }}>
              <p className="text-xs text-muted-foreground font-medium">จับคู่แล้ว</p>
              <p className="text-2xl font-bold font-display mt-1" style={{ color: "hsl(90 100% 30%)" }}>{linkedCount}</p>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: "hsl(var(--border))", borderLeft: "4px solid hsl(0 84% 50%)" }}>
              <p className="text-xs text-muted-foreground font-medium">ยังไม่จับคู่</p>
              <p className="text-2xl font-bold font-display mt-1" style={{ color: "hsl(0 84% 50%)" }}>{unlinkedCount}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="ค้นหาพนักงาน, รหัส, Face Scan ID..."
                value={mappingSearch}
                onChange={(e) => setMappingSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border bg-muted/30 outline-none focus:ring-2 transition-all"
                style={{ borderColor: "hsl(var(--border))" }}
              />
            </div>
            {(["all", "linked", "unlinked"] as const).map((f) => {
              const labels = { all: "ทั้งหมด", linked: "จับคู่แล้ว", unlinked: "ยังไม่จับคู่" };
              return (
                <button
                  key={f}
                  onClick={() => setMappingFilter(f)}
                  className="px-3 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: mappingFilter === f ? "hsl(var(--primary))" : "transparent",
                    color: mappingFilter === f ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
                    border: `1px solid ${mappingFilter === f ? "hsl(var(--primary))" : "hsl(var(--border))"}`,
                  }}
                >
                  {labels[f]}
                </button>
              );
            })}
          </div>

          {/* Table */}
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "hsl(var(--border))" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--muted))" }}>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">พนักงาน</th>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">รหัส</th>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Face Scan ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">เครื่อง</th>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">ซิงค์ล่าสุด</th>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">สถานะ</th>
                    <th className="text-center py-3 px-4 font-semibold text-muted-foreground">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMappings.map((m) => (
                    <tr key={m.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors" style={{ borderColor: "hsl(var(--border))" }}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: m.linked ? "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))" : "hsl(var(--muted))", color: m.linked ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))" }}>
                            {m.employeeName.charAt(0)}
                          </div>
                          <span className="font-medium">{m.employeeName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{m.employeeCode}</td>
                      <td className="py-3 px-4 font-mono text-xs">{m.faceScanId || <span className="text-muted-foreground">-</span>}</td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">{m.deviceName || "-"}</td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">{m.lastSync}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${m.linked ? "text-green-700 bg-green-100" : "text-amber-700 bg-amber-100"}`}>
                          {m.linked ? <Link2 className="w-3 h-3" /> : <Unlink className="w-3 h-3" />}
                          {m.linked ? "จับคู่แล้ว" : "ยังไม่จับคู่"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {m.linked ? (
                          <button onClick={() => handleUnlinkMapping(m.id)} className="text-xs font-medium px-3 py-1.5 rounded-lg border hover:bg-destructive/10 transition-colors" style={{ color: "hsl(var(--destructive))", borderColor: "hsl(var(--border))" }}>
                            ยกเลิก
                          </button>
                        ) : (
                          <button onClick={() => handleLinkMapping(m.id)} className="text-xs font-bold px-3 py-1.5 rounded-lg text-primary-foreground" style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))" }}>
                            จับคู่
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredMappings.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">ไม่พบข้อมูล</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FaceScannerSettings;
