# แผนเชื่อมต่อเครื่องสแกนหน้า HIP CiF76S แบบ ADMS Push ตรงเข้า Cloud

## เป้าหมาย
ให้ตัวเครื่อง HIP CiF76S "ดันข้อมูล" (push) การสแกนเข้า-ออก ผ่านอินเทอร์เน็ตเข้าระบบเราโดยตรง — แบบเดียวกับที่มันเคยส่งไป `203.154.4.201:5005` แต่เปลี่ยนปลายทางมาเป็นของเรา **ไม่ต้องมี PC รัน Bridge ใน LAN อีกต่อไป**

## ความจริงทางเทคนิคที่ต้องเข้าใจก่อน (สำคัญ)
เครื่องตระกูล ADMS/Push ส่งข้อมูลไปที่ path ตายตัวในเฟิร์มแวร์ คือ `/iclock/cdata`, `/iclock/getrequest`, `/iclock/devicecmd` โดยตั้งได้แค่ **โดเมน/IP + พอร์ต** เปลี่ยน path ไม่ได้

แต่ Edge Function ของเราอยู่ที่ `.../functions/v1/<ชื่อ>` เครื่องจึงยิงตรงเข้า Supabase ไม่ได้ ต้องมี **ตัวรับ ADMS สาธารณะ (relay)** ที่เปิด path `/iclock/*` แล้วส่งต่อเข้า Edge Function

ข้อดี: relay นี้รันที่ไหนก็ได้บนอินเทอร์เน็ต (ฟรี เช่น Deno Deploy / Cloudflare Worker) **ไม่ต้องอยู่ใน LAN และไม่ต้องเปิดพอร์ตเราเตอร์** — ต่างจาก Bridge เดิมที่ต้องอยู่ในวงเดียวกับเครื่อง

```text
[HIP CiF76S]  --push /iclock/*-->  [Relay สาธารณะ]  --forward-->  [facescan-adms (Lovable Cloud)]  -->  check_in_records
   (ใน LAN)        ออกเน็ตขาออก         (Deno/CF ฟรี)                    (Edge Function)               (ตารางลงเวลา)
```

## สิ่งที่จะสร้าง

### 1. ปรับฐานข้อมูล `face_scan_devices`
- เพิ่ม `serial_number` (SN ของเครื่อง — เป็นตัวระบุตัวตนในโปรโตคอล ADMS)
- เพิ่ม `connection_mode` (`bridge` หรือ `adms`, ค่าเริ่มต้น `adms`)
- เพิ่ม `adms_last_seen` (เวลาที่เครื่อง push ล่าสุด ไว้ดูสถานะออนไลน์)

### 2. Edge Function ใหม่ `facescan-adms`
ทำหน้าที่พูดภาษา ADMS/iclock โดยตรง:
- `GET /cdata` → handshake ตอบค่า config ให้เครื่อง (ความถี่ส่ง, timezone)
- `POST /cdata?table=ATTLOG` → รับ log การสแกน (ข้อความคั่นด้วย tab) แล้วแปลง → insert เข้า `check_in_records` (ใช้ logic เดียวกับ `facescan-ingest`: map `enroll_number` → `face_scan_id` → พนักงาน)
- `GET /getrequest` → ตอบคิวคำสั่ง (เช่น sync รายชื่อ) ให้เครื่องมารับ
- `POST /devicecmd` → รับผลคำสั่ง
- ยืนยันตัวตนด้วย **SN** เทียบกับเครื่องในตาราง + อัปเดต `adms_last_seen` และเขียน `face_scan_sync_logs`

### 3. ตัวรับ ADMS สาธารณะ (relay) — โค้ดพร้อมคู่มือ
สร้างไฟล์สคริปต์ (Deno Deploy เป็นตัวหลัก, ทางเลือก Cloudflare Worker) ที่:
- เปิด `/iclock/*` รับ request จากเครื่อง
- ส่งต่อ (proxy) ไปยัง `facescan-adms` พร้อมแนบ header ระบุ path เดิม
- เป็นแค่ตัวส่งต่อ ไม่เก็บข้อมูล — logic ทั้งหมดอยู่ใน Lovable Cloud
- คุณ deploy ครั้งเดียวจะได้โดเมนสาธารณะ (เช่น `xxx.deno.dev`) ไว้กรอกในเครื่อง

### 4. ปรับหน้า ตั้งค่า → เครื่องสแกน (`FaceScanConnectionSettings.tsx`)
- ฟอร์มเครื่อง: เพิ่มช่อง **Serial Number (SN)** และตัวเลือก **โหมดเชื่อมต่อ (ADMS / Bridge)**
- เพิ่มกล่อง **ค่าที่ต้องกรอกในเครื่อง** (Server Address = โดเมน relay, Port, เปิด HTTPS) พร้อมปุ่ม copy
- เพิ่มแท็บคู่มือ **"ADMS Push"**: ขั้นตอนตั้งค่าในเมนูเครื่อง HIP CiF76S ทีละจอ (Comm → Cloud Server / ADMS → ใส่ Server Address + Port → Reboot)
- แสดงสถานะ "เครื่องออนไลน์ล่าสุด" จาก `adms_last_seen`

## ลำดับการตั้งค่าฝั่งคุณ (หลังผมทำเสร็จ)
1. ผม deploy `facescan-adms` ให้อัตโนมัติ
2. คุณ deploy relay (ผมให้โค้ด + คู่มือ คลิกไม่กี่ครั้ง) → ได้โดเมนสาธารณะ
3. กรอก SN ของเครื่องในหน้าตั้งค่า
4. เข้าเมนูเครื่อง: Comm → Cloud Server/ADMS → Server Address = โดเมน relay, Port = 443, เปิด HTTPS → Reboot
5. ลองสแกน → record ควรเข้า `check_in_records` ภายในไม่กี่วินาที

## หมายเหตุข้อจำกัด
- ถ้าเปิดโหมดส่งมาที่เรา เครื่องจะ **หยุดส่ง