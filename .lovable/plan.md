# แก้ปัญหา test_connection ขึ้น "undefined"

## สรุปสถานะ
- ✅ ไฟล์ `.env` ถูกต้อง, Bridge เชื่อมต่อระบบคลาวด์ได้, รับคำสั่งมาประมวลผลได้
- ✅ Network ปกติ: `ping 192.168.2.201` ตอบกลับ <1ms, อยู่วง LAN เดียวกัน, IP ตรง
- ❌ Bridge ต่อ ZK protocol ที่พอร์ต 4370 ไม่สำเร็จ และข้อความ error เป็น `undefined`

## ต้นเหตุ
1. **มองไม่เห็น error จริง** — `node-zklib` โยน object `ZKError { err, ip, command }` ที่ตัวมันเองไม่มี property `.message` (ข้อความจริงอยู่ใน `err.err.message`). โค้ดอ่าน `e.message` จึงได้ `undefined`
2. **เรียก ZKLib ผิดพารามิเตอร์** — signature คือ `new ZKLib(ip, port, timeout, inport)` แต่โค้ดส่ง `(ip, port, ZK_TIMEOUT, ZK_TIMEOUT)` ทำให้ค่า UDP inport กลายเป็น 10000 (ควรเป็นพอร์ตเฉพาะ เช่น 4000)
3. **test_connection ใช้ `getTime()`** ซึ่งบางรุ่นไม่รองรับ — ควรใช้ `getInfo()` เป็นตัวเช็คสุขภาพมาตรฐานกว่า

## สิ่งที่จะแก้ (เฉพาะโฟลเดอร์ `facescan-bridge/` — ไม่กระทบเว็บแอป)

### 1. `bridge.js` — เพิ่ม helper ดึงข้อความ error จริง
เพิ่มฟังก์ชัน `errMessage(e)` ที่ไล่อ่าน `e.message → e.err?.message → e.err → e.code → JSON.stringify(e)` แล้วนำไปใช้แทน `e.message` ทุกจุด (catch ของ handleCommand, syncDevice, poll, ack)

### 2. `bridge.js` — แก้พารามิเตอร์การเชื่อมต่อ
- เพิ่มตัวแปร `ZK_INPORT` (ดีฟอลต์ 4000, ตั้งค่าได้ผ่าน `.env`)
- เปลี่ยนทุกจุดที่สร้าง `new ZKLib(...)` ให้เป็น `new ZKLib(ip, DEVICE_PORT, ZK_TIMEOUT, ZK_INPORT)`
- ส่ง callback จับ error ให้ `createSocket(onErr, onClose)` เพื่อ log `ECONNREFUSED` / `ETIMEDOUT` ชัดเจน

### 3. `bridge.js` — ปรับ test_connection ให้เสถียรขึ้น
- ลองเรียก `getInfo()` ก่อน, ถ้าไม่ได้ค่อย fallback เป็น `getTime()`
- ถ้าทั้งคู่ไม่ได้แต่ `createSocket()` สำเร็จ ให้ถือว่า "เชื่อมต่อได้"
- ส่งผลกลับ ack พร้อมรายละเอียด (เช่น จำนวน log/ผู้ใช้บนเครื่อง หรือเวลาเครื่อง)

### 4. `.env.example` + `README.md`
- เพิ่ม `ZK_INPORT=4000` พร้อมคำอธิบาย
- เพิ่มหมายเหตุ: ถ้า error เป็น `ECONNREFUSED` = พอร์ต 4370 ปิด/ปิดบริการ ZK บนเครื่อง; ถ้า `ETIMEDOUT`/`TIMEOUT_ON_WRITING_MESSAGE` = เครื่องอาจปิดโหมด TCP ให้ลองเปิด "TCP/Comm" หรือเปิดบริการ ZKAccess บนเครื่อง

## หลังแก้เสร็จ
1. คุณ copy ไฟล์ `bridge.js` (และ `.env.example`/`README.md`) ตัวใหม่ไปทับที่ PC ออฟฟิศ — **ไม่ต้อง `npm install` ใหม่**
2. รัน `npm start` อีกครั้ง แล้วส่ง log ที่เห็นมาให้ผม — คราวนี้จะเห็น **สาเหตุจริง** (เช่น `ECONNREFUSED` หรือ `ETIMEDOUT`) แทนคำว่า `undefined`
3. จากสาเหตุจริงนั้น เราจะรู้ทันทีว่าต้องไปเปิดบริการ/พอร์ตอะไรบนเครื่องสแกน HIP CiF76S

## หมายเหตุทางเทคนิค
ถ้าหลังแก้แล้วยังเจอ `TIMEOUT_ON_WRITING_MESSAGE` ตลอด (บั๊กที่รู้จักของ `node-zklib` กับบางรุ่น) ทางเลือกถัดไปคือสลับไปใช้ไลบรารี fork ที่แก้บั๊กนี้แล้ว (`zklib-js`) ซึ่งจะเป็นแผนแยกอีกขั้นถ้าจำเป็น
