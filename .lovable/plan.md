
## เขียน `index.js` แบบสมบูรณ์ ใช้ Bridge Token

จะเขียนใหม่ให้เรียกผ่าน **edge functions** (`facescan-bridge-poll` + `facescan-bridge-ack`) ด้วย Bridge Token `fsbt_9708...8eda` แทนการเชื่อม Supabase ตรง — ปลอดภัยกว่า ไม่ต้องใช้ service_role key

### โครงสร้างการทำงาน
```
loop ทุก 30s:
  1. POST /facescan-bridge-poll  (header: x-bridge-token)
     → ได้ devices, enroll_list, commands (queued jobs)
  2. สำหรับแต่ละ command:
     - ถ้า sync_type = 'test_connection' → เรียก DLL Connect()
     - ส่งผลกลับ POST /facescan-bridge-ack {log_id, status, message}
```

### ไฟล์ที่จะเขียน: `C:\hip-bridge\src\index.js`

ครอบคลุม:
- โหลด `plcommpro.dll` ด้วย koffi (async + timeout 5s)
- Bridge Token hard-coded: `fsbt_9708ca27c9ec9465987ee4c39042318fa65a34b0ac8c57855f8b7f7423b48eda`
- Endpoints:
  - `https://typckluzuzpxznrlrprq.supabase.co/functions/v1/facescan-bridge-poll`
  - `https://typckluzuzpxznrlrprq.supabase.co/functions/v1/facescan-bridge-ack`
- Header ที่ต้องส่ง: `x-bridge-token` + `apikey` (anon) + `Authorization: Bearer <anon>` (Supabase gateway บังคับ)
- รองรับ command: `test_connection` (ทำจริง), อื่น ๆ ack กลับเป็น error "not implemented yet"
- Logging ภาษาไทย/อังกฤษ พร้อม timestamp
- Loop infinite + try/catch ทุกชั้น ไม่ให้ process ตาย

### หลังจากผู้ใช้อนุมัติ
1. เขียน `C:\hip-bridge\src\index.js` ใหม่ทั้งไฟล์ (ผู้ใช้จะ copy ไปใช้)
2. ผู้ใช้ `npm start` แล้วส่ง log มาดู
