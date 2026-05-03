

# แผนการ Sync ข้อมูลกับเครื่องสแกนหน้าที่มีอยู่เดิม

## สถานการณ์ปัจจุบัน

ระบบของคุณมีโครงสร้างพื้นฐานสำหรับเชื่อมต่อเครื่องสแกนหน้าอยู่แล้ว แต่ยังทำงานเฉพาะ **ขาเข้า** (รับข้อมูลเวลาเข้า-ออกจากเครื่อง) เท่านั้น ยังไม่มี **ขาออก** (ส่งข้อมูลพนักงานไปเครื่อง) ที่สมบูรณ์

```text
[เครื่องสแกนหน้า HIP CiF76S]  ←─  [Bridge Service บน PC ออฟฟิศ]  ←─→  [Lovable Cloud]
         (LAN/Local)                  (Node.js + DLL)              (Edge Functions + DB)
```

**เหตุผลที่ต้องมี Bridge Service:** เครื่องสแกนหน้าอยู่ใน LAN ของออฟฟิศ และใช้ DLL (FK623Attend.dll) ที่ Cloud เรียกตรงไม่ได้ จึงต้องมีโปรแกรมตัวกลางรันบน PC

---

## แผนการดำเนินงาน

### ส่วนที่ 1: ปรับปรุง UI การตั้งค่า

1. **ลบ `FaceScannerSettings.tsx` (mock เก่า)** — เก็บเฉพาะ `FaceScanConnectionSettings.tsx` ที่ต่อ DB จริง เพื่อไม่ให้สับสน
2. **เพิ่มแท็บ "จับคู่ Face Scan ID"** ใน `FaceScanConnectionSettings.tsx`
   - แสดงรายชื่อพนักงานทั้งหมด พร้อมช่องกรอก `face_scan_id` (Enroll Number บนเครื่อง)
   - ปุ่ม "ซิงค์รายชื่อไปเครื่อง" → เรียก edge function `facescan-enroll-sync` ที่มีอยู่แล้ว
   - แสดงสถานะการ sync ล่าสุด (synced/pending/failed) ของแต่ละคน
3. **เพิ่มปุ่ม "Pull ข้อมูลย้อนหลัง"** บนการ์ดเครื่อง — สั่งให้ Bridge ดึง log ตามช่วงวันที่ (เช่น 7 วันล่าสุด) เพื่อ backfill

### ส่วนที่ 2: เพิ่ม Edge Functions ที่ขาด

เพิ่ม 2 ฟังก์ชันใหม่:

| ฟังก์ชัน | หน้าที่ |
|---|---|
| `facescan-bridge-poll` | Bridge เรียกทุก 30 วิ — คืน "command queue" (test_connection, enroll_push, pull_logs, delete_user) ที่ค้างอยู่ในตาราง `face_scan_sync_logs` (status='queued') |
| `facescan-bridge-ack` | Bridge รายงานผลการทำคำสั่ง — อัปเดต log row จาก queued → success/error |

**ปรับ `facescan-bridge-config`:** เพิ่มข้อมูลคำสั่งล่วงหน้า (pending commands) ในรอบ poll เดียวกัน เพื่อลดจำนวน HTTP call

### ส่วนที่ 3: ขยายฐานข้อมูล

เพิ่ม migration:

- ตาราง `face_scan_enroll_status` — เก็บสถานะการ sync รายพนักงาน × รายเครื่อง (employee_id, device_id, synced_at, status)
- เพิ่มคอลัมน์ `command_payload jsonb` ใน `face_scan_sync_logs` — สำหรับเก็บ argument ของคำสั่ง (เช่น ช่วงวันที่ pull, employee_id ที่จะลบ)

### ส่วนที่ 4: คู่มือ Bridge Service ที่ผู้ใช้ต้องติดตั้ง

อัปเดตแท็บ "คู่มือ Bridge" ให้มี:
- โค้ดตัวอย่าง Node.js ที่สมบูรณ์ (รองรับทั้ง pull logs และ push enroll)
- คำสั่ง `npm install` ครบ (`@supabase/supabase-js`, `koffi`, `node-cron`)
- ตัวอย่างการรันเป็น Windows Service ด้วย `nssm` หรือ `pm2`
- ดาวน์โหลด `bridge-service.zip` พร้อมไฟล์ `.env.example`

---

## ขั้นตอนติดตั้งฝั่งลูกค้า (ที่ผู้ใช้ต้องทำเอง)

1. ติดตั้ง Node.js 20+ บน PC ออฟฟิศที่อยู่ LAN เดียวกับเครื่องสแกน
2. ดาวน์โหลด Bridge Service จากแท็บคู่มือ
3. คัดลอก `FK623Attend.dll` (จาก SDK ของ HIP) ไว้ในโฟลเดอร์ Bridge
4. สร้าง Bridge Token จากหน้าตั้งค่า → วางใน `.env`
5. รันด้วย `npm start` หรือติดตั้งเป็น Windows Service
6. กลับมาที่แอป → กรอก `face_scan_id` ของพนักงานแต่ละคน → กด "ซิงค์รายชื่อไปเครื่อง"

---

## ข้อควรพิจารณา

- **face_scan_id ต้องตรงกับ Enroll Number บนเครื่อง** — ระบบไม่สามารถ "สร้าง" enrollment ใหม่จาก cloud ได้ (ต้องลงทะเบียนใบหน้าที่ตัวเครื่องอยู่แล้ว) เราเพียง map ID เท่านั้น
- **Bridge Service ต้องรันตลอดเวลา** — ถ้าปิด PC จะไม่มีการ sync ข้อมูล (สถานะจะแสดง "Bridge offline" ในหน้า Test)
- **ความปลอดภัย:** Bridge Token ใช้ SHA-256 hash, ส่งผ่าน HTTPS, มีระบบ enable/disable และ revoke ได้

