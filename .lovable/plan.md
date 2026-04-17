
## แผนการเชื่อมต่อเครื่องสแกนหน้า HIP CiF76S ผ่าน SDK

### สถาปัตยกรรม (สำคัญต้องเข้าใจก่อน)

เครื่อง HIP CiF76S ใช้ SDK เป็น **Windows DLL** (FK623Attend.dll, FKAttend.dll, FKViaDev.dll, FaceDataConv.dll) และเครื่องอยู่บน **Private LAN** (192.168.x.x) ซึ่งระบบเว็บ Lovable (cloud) **ไม่สามารถเรียก DLL หรือเข้าถึง LAN ได้โดยตรง** จึงต้องใช้รูปแบบ **Local Bridge Service**

```text
┌──────────────────┐         ┌──────────────────────┐         ┌─────────────────┐
│  Lovable Cloud   │ ◄─────► │  Bridge Service      │ ◄─────► │  HIP CiF76S #1  │
│  (Web UI + DB)   │  HTTPS  │  (PC ใน office,      │   TCP   │  192.168.2.201  │
│                  │  + JWT  │   Windows + .NET/    │         │                 │
│  - Settings UI   │         │   Node.js + DLL)     │         ├─────────────────┤
│  - Sync Logs     │         │                      │         │  HIP CiF76S #2  │
│  - Push Events   │         │  - Poll devices      │         │  192.168.1.202  │
│                  │         │  - Push to Cloud     │         └─────────────────┘
└──────────────────┘         └──────────────────────┘
```

**หน้าที่ของ 2 ฝั่ง:**
- **Lovable (เว็บ)**: เก็บ config เครื่อง, Face ID mapping, sync schedule, sync logs และรับข้อมูล check-in ที่ bridge ส่งเข้ามา
- **Bridge Service (PC ในออฟฟิศ)**: เรียก DLL → ดึง log/enroll user/sync time → POST ไปยัง edge function ของเรา

> ผมจะสร้าง **เฉพาะฝั่ง Lovable** (UI + DB + edge functions) ในรอบนี้ ส่วน bridge service จะมีคู่มือ + ตัวอย่างโค้ด Node.js (`edge.js` ใช้ `koffi`/`ffi-napi` เรียก DLL) แยกออกมาเป็น repo เล็กให้ทีม IT รัน

---

### สิ่งที่จะสร้างในรอบนี้

#### 1. เพิ่มเมนูย่อยใน "ตั้งค่า"
เพิ่มแท็บใหม่ **"เชื่อมต่อ FaceScan"** (icon: `Network`) ใน `src/pages/Settings.tsx` ก่อน "เครื่องสแกนหน้า" เดิม

#### 2. ตารางใหม่ในฐานข้อมูล (migration)

| ตาราง | ใช้ทำอะไร |
|---|---|
| `face_scan_devices` | เก็บข้อมูลเครื่อง (name, ip, server_ip, server_port, machine_number, comm_password, enabled) — รองรับเครื่อง #1 Station, #2 Furnace |
| `face_scan_sync_logs` | บันทึกผลการ sync แต่ละครั้ง (device_id, started_at, finished_at, records_synced, status, message) |
| `face_scan_bridge_tokens` | API token สำหรับให้ bridge service ใช้ยืนยันตัวตนตอน push ข้อมูล (hashed) |

RLS: admin/hr จัดการได้, อ่านได้ทุก authenticated, edge function ใช้ service-role bypass

#### 3. คอมโพเนนต์ใหม่: `FaceScanConnectionSettings.tsx`
มี 4 sub-tabs:
- **เครื่องสแกน** — CRUD ข้อมูลเครื่อง (Name, Device IP, Server IP, Server Port, Machine No., Comm Password, Enabled)
- **Bridge Token** — สร้าง/revoke token + แสดง URL ของ edge function ที่ bridge ต้อง POST ไป
- **Sync Logs** — แสดง real-time logs จากตาราง `face_scan_sync_logs`
- **คู่มือ Bridge Service** — instructions + ตัวอย่างโค้ด snippet

ใส่ค่า default ของเครื่องทั้ง 2 ตามที่แจ้งมา (Station, Furnace)

#### 4. Edge Functions ใหม่

| Function | หน้าที่ |
|---|---|
| `facescan-ingest` | รับ POST จาก bridge: { device_id, token, records: [{user_id, datetime, verify_mode}] } → validate token → insert ลง `check_in_records` (trigger เดิมจะ aggregate เข้า `attendance_records` ให้อัตโนมัติ) |
| `facescan-enroll-sync` | ส่ง command ให้ bridge ดึง enroll list ไปอัปเดตเครื่อง (push pattern via polling) |
| `facescan-bridge-config` | bridge service เรียกตอน startup เพื่อดึงรายการเครื่อง + sync schedule |

ทั้งหมดใช้ `verify_jwt = false` แต่ตรวจ token จากตาราง `face_scan_bridge_tokens` ด้วยตนเอง

#### 5. Mapping กับ employees
ใช้คอลัมน์ `face_scan_id` ใน `employees` ที่มีอยู่แล้ว (ไม่ต้องแก้ schema) — Sub-tab "จับคู่ Face Scan ID" ใน `FaceScannerSettings.tsx` เดิมยังใช้งานได้ และเชื่อมโยงกับ `enrollNumber` ของเครื่อง

#### 6. Realtime
เปิด realtime ที่ `face_scan_sync_logs` เพื่อให้ผู้ดูแลเห็น log ใหม่ทันทีโดยไม่ต้องรีเฟรช

---

### สิ่งที่ผู้ใช้/ทีม IT ต้องทำเอง (อยู่นอกขอบเขต Lovable)

1. **ติดตั้ง Bridge Service** บน PC Windows ในออฟฟิศที่อยู่ LAN เดียวกับเครื่องสแกน
2. **คัดลอกไฟล์ DLL ทั้ง 4 ไฟล์** (FK623Attend.dll, FKAttend.dll, FKViaDev.dll, FaceDataConv.dll) ไปวางในโฟลเดอร์ service
3. **ใส่ Bridge Token** ที่สร้างจาก UI ลงใน config ของ service
4. **ตั้ง Windows Task Scheduler / NSSM** ให้รัน service อัตโนมัติ

ผมจะสร้างคู่มือ + sample Node.js script แสดงในแท็บ "คู่มือ Bridge Service" ของหน้าตั้งค่า

---

### รายละเอียดเทคนิค

- **DLL Functions ที่ bridge จะเรียก** (จากคู่มือ SDK):
  - `ConnectNet(IP, port, password)` — เชื่อมต่อ
  - `ReadAllGLogData / GetGeneralLogData` — ดึง check-in logs
  - `PutEnrollData_StringID` — เพิ่ม/แก้ผู้ใช้
  - `DeleteEnrollData` — ลบผู้ใช้
  - `SetDeviceTime` — ตั้งเวลา
  - `DisConnect` — ตัดการเชื่อมต่อ
- **Real-time push**: bridge เปิด TCP listener ตาม Server IP/Port (203.154.4.201:8272) ที่เครื่องตั้งไว้แล้ว แต่เนื่องจาก IP นี้เป็น public ของลูกค้า bridge จะรันแบบ poll ทุก 30 วินาที + on-demand แทน (ปลอดภัยกว่า)
- **ข้อมูล insert**: `check_in_records` มี trigger `sync_checkin_to_attendance` อยู่แล้วจะอัปเดต `attendance_records` ให้อัตโนมัติ

---

### ลำดับการทำงาน

1. Migration: สร้าง 3 ตารางใหม่ + RLS + realtime
2. สร้างคอมโพเนนต์ `FaceScanConnectionSettings.tsx` (4 sub-tabs)
3. เพิ่ม tab "เชื่อมต่อ FaceScan" ใน `Settings.tsx`
4. สร้าง 3 edge functions (`facescan-ingest`, `facescan-enroll-sync`, `facescan-bridge-config`)
5. Seed ข้อมูลเครื่อง 2 ตัว (Station, Furnace) ตามค่าที่ผู้ใช้แจ้ง
6. เขียนคู่มือ Bridge Service + sample code ในแท็บคู่มือ
