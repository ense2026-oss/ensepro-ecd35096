import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Plus,
  Pencil,
  Trash2,
  Server,
  KeyRound,
  Activity,
  BookOpen,
  Copy,
  Check,
  RefreshCw,
  Wifi,
  Loader2,
  Users,
  Download,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import FaceScanMapping from "./FaceScanMapping";

interface Device {
  id: string;
  name: string;
  description: string;
  device_ip: string;
  server_ip: string;
  server_port: number;
  machine_number: number;
  comm_password: string;
  enabled: boolean;
  last_sync_at: string | null;
  last_status: string;
  serial_number: string;
  connection_mode: string;
  adms_last_seen: string | null;
}

interface BridgeToken {
  id: string;
  name: string;
  token_prefix: string;
  enabled: boolean;
  created_at: string;
  last_used_at: string | null;
}

interface SyncLog {
  id: string;
  device_id: string | null;
  sync_type: string;
  status: string;
  records_synced: number;
  message: string;
  started_at: string;
  finished_at: string | null;
}

const PROJECT_REF = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const FN_BASE = `https://${PROJECT_REF}.supabase.co/functions/v1`;
const ADMS_FN_URL = `${FN_BASE}/facescan-adms`;

const FaceScanConnectionSettings = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [tokens, setTokens] = useState<BridgeToken[]>([]);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Device dialog
  const [deviceDialogOpen, setDeviceDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [deviceForm, setDeviceForm] = useState({
    name: "",
    description: "",
    device_ip: "",
    server_ip: "203.154.4.201",
    server_port: 8272,
    machine_number: 1,
    comm_password: "0",
    enabled: true,
    serial_number: "",
    connection_mode: "adms",
  });

  // Delete device confirm
  const [deleteDeviceId, setDeleteDeviceId] = useState<string | null>(null);

  // Token dialog
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Test connection state
  const [testingDeviceId, setTestingDeviceId] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const [d, t, l] = await Promise.all([
      supabase.from("face_scan_devices").select("*").order("name"),
      supabase
        .from("face_scan_bridge_tokens")
        .select("id, name, token_prefix, enabled, created_at, last_used_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("face_scan_sync_logs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50),
    ]);
    if (d.data) setDevices(d.data as Device[]);
    if (t.data) setTokens(t.data as BridgeToken[]);
    if (l.data) setLogs(l.data as SyncLog[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();

    const channel = supabase
      .channel("facescan-settings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "face_scan_devices" },
        () => fetchAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "face_scan_sync_logs" },
        () => fetchAll()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const openNewDevice = () => {
    setEditingDevice(null);
    setDeviceForm({
      name: "",
      description: "",
      device_ip: "",
      server_ip: "203.154.4.201",
      server_port: 8272,
      machine_number: 1,
      comm_password: "0",
      enabled: true,
      serial_number: "",
      connection_mode: "adms",
    });
    setDeviceDialogOpen(true);
  };

  const openEditDevice = (d: Device) => {
    setEditingDevice(d);
    setDeviceForm({
      name: d.name,
      description: d.description,
      device_ip: d.device_ip,
      server_ip: d.server_ip,
      server_port: d.server_port,
      machine_number: d.machine_number,
      comm_password: d.comm_password,
      enabled: d.enabled,
      serial_number: d.serial_number ?? "",
      connection_mode: d.connection_mode ?? "adms",
    });
    setDeviceDialogOpen(true);
  };

  const saveDevice = async () => {
    if (!deviceForm.name.trim()) {
      toast.error("กรุณากรอกชื่อเครื่อง");
      return;
    }
    if (deviceForm.connection_mode === "adms" && !deviceForm.serial_number.trim()) {
      toast.error("โหมด ADMS ต้องกรอก Serial Number (SN) ของเครื่อง");
      return;
    }
    if (deviceForm.connection_mode === "bridge" && !deviceForm.device_ip.trim()) {
      toast.error("โหมด Bridge ต้องกรอก Device IP");
      return;
    }
    if (editingDevice) {
      const { error } = await supabase
        .from("face_scan_devices")
        .update(deviceForm)
        .eq("id", editingDevice.id);
      if (error) return toast.error("บันทึกไม่สำเร็จ: " + error.message);
      toast.success("อัปเดตเครื่องสแกนแล้ว");
    } else {
      const { error } = await supabase.from("face_scan_devices").insert(deviceForm);
      if (error) return toast.error("เพิ่มไม่สำเร็จ: " + error.message);
      toast.success("เพิ่มเครื่องสแกนแล้ว");
    }
    setDeviceDialogOpen(false);
  };

  const confirmDeleteDevice = async () => {
    if (!deleteDeviceId) return;
    const { error } = await supabase.from("face_scan_devices").delete().eq("id", deleteDeviceId);
    if (error) return toast.error("ลบไม่สำเร็จ: " + error.message);
    toast.success("ลบเครื่องสแกนแล้ว");
    setDeleteDeviceId(null);
  };

  const createToken = async () => {
    if (!tokenName.trim()) {
      toast.error("กรุณาตั้งชื่อ Token");
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("facescan-token-create", {
        body: { name: tokenName },
      });
      console.log("[facescan-token-create] response", { data, error });
      if (error) {
        toast.error("สร้าง Token ไม่สำเร็จ: " + error.message);
        return;
      }
      // Tolerate string/object response shapes
      let payload: any = data;
      if (typeof payload === "string") {
        try { payload = JSON.parse(payload); } catch { /* ignore */ }
      }
      const token = payload?.token ?? payload?.data?.token;
      if (!token) {
        toast.error("ไม่พบ Token ใน response");
        return;
      }
      setNewToken(token);
      setTokenName("");
      fetchAll();
    } catch (e: any) {
      console.error("createToken error", e);
      toast.error("สร้าง Token ไม่สำเร็จ: " + (e?.message ?? "unknown"));
    }
  };

  const toggleToken = async (t: BridgeToken) => {
    const { error } = await supabase
      .from("face_scan_bridge_tokens")
      .update({ enabled: !t.enabled })
      .eq("id", t.id);
    if (error) toast.error("อัปเดต Token ไม่สำเร็จ");
  };

  const deleteToken = async (id: string) => {
    const { error } = await supabase.from("face_scan_bridge_tokens").delete().eq("id", id);
    if (!error) {
      toast.success("ลบ Token แล้ว");
      fetchAll();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
    toast.success("คัดลอกแล้ว");
  };

  const testConnection = async (device: Device) => {
    setTestingDeviceId(device.id);
    try {
      const { data, error } = await supabase.functions.invoke("facescan-test-connection", {
        body: { device_id: device.id },
      });
      if (error) throw error;
      if (data?.bridge_online) {
        toast.success(
          `✅ Bridge ออนไลน์ — คำสั่งทดสอบถูกส่งไปยัง ${device.name} แล้ว`,
          { description: data.message, duration: 6000 }
        );
      } else {
        toast.warning(`⚠️ Bridge offline`, {
          description: data?.message ?? "ไม่พบการตอบสนองจาก Bridge Service",
          duration: 8000,
        });
      }
    } catch (e: any) {
      toast.error("ทดสอบไม่สำเร็จ: " + (e?.message ?? "Unknown error"));
    } finally {
      setTestingDeviceId(null);
    }
  };

  const pullLogs = async (device: Device) => {
    const days = parseInt(prompt("ดึงข้อมูลย้อนหลังกี่วัน? (1-30)", "7") ?? "0", 10);
    if (!days || days < 1 || days > 30) return;
    const { error } = await supabase.functions.invoke("facescan-queue-command", {
      body: { sync_type: "pull_logs", device_id: device.id, payload: { days } },
    });
    if (error) return toast.error("สั่งดึงข้อมูลไม่สำเร็จ: " + error.message);
    toast.success(`สั่งดึงข้อมูล ${days} วันย้อนหลังจาก ${device.name} แล้ว`);
  };

  const formatDateTime = (s: string | null) => {
    if (!s) return "—";
    const d = new Date(s);
    return d.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "medium" });
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      success: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
      running: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
      queued: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
      error: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
      pending: "bg-muted text-muted-foreground border-border",
    };
    return (
      <Badge variant="outline" className={map[status] || map.pending}>
        {status}
      </Badge>
    );
  };

  const sampleNodeScript = `// bridge-service.js (รันบน Windows PC ในออฟฟิศ)
// npm install @supabase/supabase-js koffi node-cron
import koffi from 'koffi';
import cron from 'node-cron';

const CLOUD_URL = '${FN_BASE}';
const BRIDGE_TOKEN = 'fsbt_xxxxxxxxxxxx'; // <-- ใส่ token จากหน้า Bridge Token

// โหลด DLL
const lib = koffi.load('FK623Attend.dll');
const ConnectNet = lib.func('int ConnectNet(str, int, str)');
const GetGeneralLogData = lib.func('int GetGeneralLogData(int, _Out_ str, _Out_ str, _Out_ int*, _Out_ int*, _Out_ int*)');
const DisConnect = lib.func('void DisConnect(int)');

async function fetchConfig() {
  const res = await fetch(\`\${CLOUD_URL}/facescan-bridge-config\`, {
    headers: { 'x-bridge-token': BRIDGE_TOKEN }
  });
  return await res.json();
}

async function pushRecords(deviceId, records) {
  await fetch(\`\${CLOUD_URL}/facescan-ingest\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bridge-token': BRIDGE_TOKEN,
    },
    body: JSON.stringify({ device_id: deviceId, records }),
  });
}

async function pollDevice(device) {
  const handle = ConnectNet(device.device_ip, device.server_port, device.comm_password);
  if (handle <= 0) {
    console.error('Connect failed', device.name);
    return;
  }
  const records = [];
  // ... ใช้ GetGeneralLogData อ่าน logs ทั้งหมด
  // แปลงเป็น { enroll_number, datetime (ISO), verify_mode, in_out }
  DisConnect(handle);
  if (records.length) await pushRecords(device.id, records);
}

// Poll ทุก 30 วินาที
cron.schedule('*/30 * * * * *', async () => {
  const cfg = await fetchConfig();
  for (const dev of cfg.devices) await pollDevice(dev);
});

console.log('Bridge service started');`;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold font-display">เชื่อมต่อ FaceScan</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          จัดการการเชื่อมต่อกับเครื่องสแกนหน้า HIP CiF76S — ADMS Push (ตรงเข้า Cloud) หรือ Bridge Service
        </p>
      </div>

      <Tabs defaultValue="devices" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6 h-auto">
          <TabsTrigger value="devices" className="gap-2">
            <Server className="w-4 h-4" /> เครื่องสแกน
          </TabsTrigger>
          <TabsTrigger value="mapping" className="gap-2">
            <Users className="w-4 h-4" /> จับคู่ Face ID
          </TabsTrigger>
          <TabsTrigger value="adms" className="gap-2">
            <Wifi className="w-4 h-4" /> ADMS Push
          </TabsTrigger>
          <TabsTrigger value="tokens" className="gap-2">
            <KeyRound className="w-4 h-4" /> Bridge Token
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <Activity className="w-4 h-4" /> Sync Logs
          </TabsTrigger>
          <TabsTrigger value="guide" className="gap-2">
            <BookOpen className="w-4 h-4" /> คู่มือ Bridge
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mapping">
          <FaceScanMapping devices={devices} />
        </TabsContent>

        {/* DEVICES */}
        <TabsContent value="devices" className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {devices.length} เครื่อง {loading && "(กำลังโหลด...)"}
            </p>
            <Button onClick={openNewDevice} size="sm">
              <Plus className="w-4 h-4 mr-1" /> เพิ่มเครื่อง
            </Button>
          </div>

          <div className="grid gap-3">
            {devices.map((d) => (
              <Card key={d.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="font-semibold">{d.name}</h4>
                      <Badge variant={d.enabled ? "default" : "secondary"} className="text-xs">
                        {d.enabled ? "เปิดใช้" : "ปิดใช้"}
                      </Badge>
                      <Badge variant="outline" className="text-xs uppercase">
                        {d.connection_mode === "adms" ? "ADMS Push" : "Bridge"}
                      </Badge>
                      {statusBadge(d.last_status)}
                    </div>
                    {d.description && (
                      <p className="text-sm text-muted-foreground mb-2">{d.description}</p>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {d.connection_mode === "adms" ? (
                        <>
                          <div>
                            <span className="font-medium text-foreground">SN:</span>{" "}
                            {d.serial_number || "—"}
                          </div>
                          <div>
                            <span className="font-medium text-foreground">เห็นล่าสุด:</span>{" "}
                            {formatDateTime(d.adms_last_seen)}
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <span className="font-medium text-foreground">Device IP:</span> {d.device_ip}
                          </div>
                          <div>
                            <span className="font-medium text-foreground">Server:</span> {d.server_ip}:{d.server_port}
                          </div>
                          <div>
                            <span className="font-medium text-foreground">Machine #:</span> {d.machine_number}
                          </div>
                        </>
                      )}
                      <div>
                        <span className="font-medium text-foreground">Sync ล่าสุด:</span>{" "}
                        {formatDateTime(d.last_sync_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testConnection(d)}
                      disabled={testingDeviceId === d.id || !d.enabled}
                      className="gap-1.5"
                    >
                      {testingDeviceId === d.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Wifi className="w-3.5 h-3.5" />
                      )}
                      Test
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => pullLogs(d)}
                      disabled={!d.enabled}
                      className="gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Pull
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEditDevice(d)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteDeviceId(d.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            {devices.length === 0 && !loading && (
              <Card className="p-8 text-center text-muted-foreground">
                ยังไม่มีเครื่องสแกน — กดปุ่ม "เพิ่มเครื่อง" เพื่อเริ่มต้น
              </Card>
            )}
          </div>
        </TabsContent>

        {/* TOKENS */}
        <TabsContent value="tokens" className="space-y-3">
          <Card className="p-4 bg-muted/30">
            <div className="text-sm space-y-2">
              <p className="font-medium">Endpoint สำหรับ Bridge Service:</p>
              <div className="font-mono text-xs bg-background border rounded p-2 break-all flex items-center justify-between gap-2">
                <code>{FN_BASE}/facescan-ingest</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={() => copyToClipboard(`${FN_BASE}/facescan-ingest`)}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Bridge ส่ง POST พร้อม header <code>x-bridge-token: &lt;token&gt;</code>
              </p>
            </div>
          </Card>

          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{tokens.length} token</p>
            <Button
              size="sm"
              onClick={() => {
                setNewToken(null);
                setTokenName("");
                setTokenDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1" /> สร้าง Token ใหม่
            </Button>
          </div>

          <div className="grid gap-2">
            {tokens.map((t) => (
              <Card key={t.id} className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t.name}</span>
                      <Badge variant={t.enabled ? "default" : "secondary"} className="text-xs">
                        {t.enabled ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono mt-1">
                      {t.token_prefix}••••••••••••••••••••
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      สร้าง: {formatDateTime(t.created_at)} · ใช้ล่าสุด:{" "}
                      {formatDateTime(t.last_used_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={t.enabled} onCheckedChange={() => toggleToken(t)} />
                    <Button variant="ghost" size="icon" onClick={() => deleteToken(t.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            {tokens.length === 0 && (
              <Card className="p-8 text-center text-muted-foreground">ยังไม่มี Token</Card>
            )}
          </div>
        </TabsContent>

        {/* LOGS */}
        <TabsContent value="logs" className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {logs.length} รายการล่าสุด (real-time)
            </p>
            <Button variant="outline" size="sm" onClick={fetchAll}>
              <RefreshCw className="w-4 h-4 mr-1" /> รีเฟรช
            </Button>
          </div>
          <div className="grid gap-2">
            {logs.map((log) => {
              const dev = devices.find((d) => d.id === log.device_id);
              return (
                <Card key={log.id} className="p-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      {statusBadge(log.status)}
                      <Badge variant="outline" className="text-xs">
                        {log.sync_type}
                      </Badge>
                      <span className="text-sm font-medium">{dev?.name || "ทุกเครื่อง"}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(log.started_at)}
                    </div>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {log.message}
                    {log.records_synced > 0 && (
                      <span className="ml-2 font-medium text-foreground">
                        ({log.records_synced} records)
                      </span>
                    )}
                  </div>
                </Card>
              );
            })}
            {logs.length === 0 && (
              <Card className="p-8 text-center text-muted-foreground">
                ยังไม่มีบันทึก sync
              </Card>
            )}
          </div>
        </TabsContent>

        {/* GUIDE */}
        <TabsContent value="guide" className="space-y-4">
          <Card className="p-5 space-y-4">
            <div>
              <h4 className="font-semibold mb-2">📌 ภาพรวม</h4>
              <p className="text-sm text-muted-foreground">
                เครื่อง HIP CiF76S ใช้ Windows DLL และอยู่บน Private LAN (192.168.x.x) ไม่สามารถเชื่อมต่อจากเว็บ cloud ได้โดยตรง
                จึงต้องติดตั้ง <strong>Bridge Service</strong> บน PC Windows ที่อยู่ LAN เดียวกับเครื่องสแกน เพื่อทำหน้าที่:
              </p>
              <ul className="text-sm text-muted-foreground list-disc pl-5 mt-2 space-y-1">
                <li>เรียก DLL เพื่อเชื่อมต่อเครื่อง (ConnectNet)</li>
                <li>ดึง check-in/out logs (GetGeneralLogData) → POST ไปยัง <code>facescan-ingest</code></li>
                <li>รับคำสั่ง enroll/delete ผู้ใช้จาก cloud → ส่งเข้าเครื่อง</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">🛠 ขั้นตอนติดตั้ง</h4>
              <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1.5">
                <li>ติดตั้ง Node.js 18+ บน PC Windows ในออฟฟิศ</li>
                <li>คัดลอก DLL ทั้ง 4 ไฟล์ (FK623Attend.dll, FKAttend.dll, FKViaDev.dll, FaceDataConv.dll) ไปที่โฟลเดอร์ service</li>
                <li>สร้าง Bridge Token จากแท็บ "Bridge Token" และคัดลอกเก็บไว้</li>
                <li>วางโค้ด <code>bridge-service.js</code> ด้านล่าง แล้วใส่ token ที่ได้</li>
                <li>รัน <code>node bridge-service.js</code> หรือใช้ NSSM/Task Scheduler ให้รันอัตโนมัติ</li>
              </ol>
            </div>

            <div>
              <h4 className="font-semibold mb-2">📡 API Endpoints</h4>
              <div className="space-y-2 text-sm">
              <div className="font-mono text-xs bg-muted p-2 rounded">
                  <span className="font-semibold text-primary">POST</span>{" "}
                  {FN_BASE}/facescan-ingest
                  <div className="text-muted-foreground mt-1">
                    Body: <code>{`{ device_id, records: [{enroll_number, datetime, verify_mode, in_out}] }`}</code>
                  </div>
                </div>
                <div className="font-mono text-xs bg-muted p-2 rounded">
                  <span className="font-semibold text-primary">GET</span>{" "}
                  {FN_BASE}/facescan-bridge-config
                  <div className="text-muted-foreground mt-1">
                    Returns: enabled devices + employee enroll list
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">💻 ตัวอย่างโค้ด Bridge (Node.js)</h4>
              <div className="relative">
                <Textarea
                  readOnly
                  value={sampleNodeScript}
                  className="font-mono text-xs min-h-[400px]"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(sampleNodeScript)}
                >
                  {copiedToken ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DEVICE DIALOG */}
      <Dialog open={deviceDialogOpen} onOpenChange={setDeviceDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingDevice ? "แก้ไขเครื่องสแกน" : "เพิ่มเครื่องสแกน"}</DialogTitle>
            <DialogDescription>กำหนดค่าการเชื่อมต่อสำหรับเครื่อง HIP CiF76S</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 flex-1 overflow-y-auto py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 mx-[20px]">
                <Label>ชื่อเครื่อง *</Label>
                <Input
                  value={deviceForm.name}
                  onChange={(e) => setDeviceForm({ ...deviceForm, name: e.target.value })}
                  placeholder="เช่น Station"
                />
              </div>
              <div className="col-span-2 mx-[20px]">
                <Label>คำอธิบาย</Label>
                <Input
                  value={deviceForm.description}
                  onChange={(e) =>
                    setDeviceForm({ ...deviceForm, description: e.target.value })
                  }
                  placeholder="เช่น รถไฟฟ้าขสมช"
                />
              </div>
              <div className="col-span-2 mx-[20px]">
                <Label>Device IP *</Label>
                <Input
                  value={deviceForm.device_ip}
                  onChange={(e) => setDeviceForm({ ...deviceForm, device_ip: e.target.value })}
                  placeholder="192.168.2.201"
                />
              </div>
              <div className="mx-[20px] mr-0">
                <Label>Server IP</Label>
                <Input
                  value={deviceForm.server_ip}
                  onChange={(e) => setDeviceForm({ ...deviceForm, server_ip: e.target.value })}
                />
              </div>
              <div className="mr-[20px]">
                <Label>Server Port</Label>
                <Input
                  type="number"
                  value={deviceForm.server_port}
                  onChange={(e) =>
                    setDeviceForm({ ...deviceForm, server_port: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="mr-0 ml-[20px]">
                <Label>Machine No.</Label>
                <Input
                  type="number"
                  value={deviceForm.machine_number}
                  onChange={(e) =>
                    setDeviceForm({
                      ...deviceForm,
                      machine_number: parseInt(e.target.value) || 1,
                    })
                  }
                />
              </div>
              <div className="mr-[20px]">
                <Label>Comm Password</Label>
                <Input
                  value={deviceForm.comm_password}
                  onChange={(e) =>
                    setDeviceForm({ ...deviceForm, comm_password: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2 flex items-center justify-between border-t pt-3 mx-[20px]">
                <Label>เปิดใช้งาน</Label>
                <Switch
                  checked={deviceForm.enabled}
                  onCheckedChange={(v) => setDeviceForm({ ...deviceForm, enabled: v })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeviceDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={saveDevice}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* TOKEN DIALOG */}
      <Dialog open={tokenDialogOpen} onOpenChange={setTokenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>สร้าง Bridge Token ใหม่</DialogTitle>
            <DialogDescription>
              {newToken
                ? "Token ของคุณ (แสดงเพียงครั้งเดียว — กรุณาคัดลอกเก็บไว้)"
                : "ตั้งชื่อเพื่อใช้แยกแยะ Token แต่ละตัว"}
            </DialogDescription>
          </DialogHeader>
          {newToken ? (
            <div className="space-y-3">
              <div className="font-mono text-xs bg-muted p-3 rounded break-all">{newToken}</div>
              <Button onClick={() => copyToClipboard(newToken)} variant="outline" className="w-full">
                {copiedToken ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {copiedToken ? "คัดลอกแล้ว" : "คัดลอก Token"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>ชื่อ Token</Label>
                <Input
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder="เช่น Office PC Bridge"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            {newToken ? (
              <Button onClick={() => setTokenDialogOpen(false)}>เสร็จสิ้น</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setTokenDialogOpen(false)}>
                  ยกเลิก
                </Button>
                <Button onClick={createToken}>สร้าง</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRM */}
      <AlertDialog open={!!deleteDeviceId} onOpenChange={(o) => !o && setDeleteDeviceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบเครื่องสแกน</AlertDialogTitle>
            <AlertDialogDescription>
              การลบจะลบ Sync Logs ที่เกี่ยวข้องทั้งหมดด้วย และไม่สามารถยกเลิกได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteDevice}
              className="bg-destructive hover:bg-destructive/90"
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FaceScanConnectionSettings;
