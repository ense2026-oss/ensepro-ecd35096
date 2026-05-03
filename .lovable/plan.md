# แก้ไข `src/hip-sdk.js` ให้ตรงกับ Export ของ FK623Attend.dll

## สาเหตุของ error เดิม
โค้ดเดิมเรียก `ConnectNet`, `DisConnect`, `ReadAllGLogData`, `GetGeneralLogData` แต่ DLL จริงทุกฟังก์ชัน**ขึ้นต้นด้วย `FK_`** จึงหาไม่เจอ

## Mapping ชื่อฟังก์ชัน (จากภาพ Export)

| โค้ดเดิม | ชื่อจริงใน DLL |
|---|---|
| `ConnectNet` | `FK_ConnectNet` |
| `DisConnect` | `FK_DisConnect` |
| `ReadAllGLogData` | `FK_LoadGeneralLogData` |
| `GetGeneralLogData` | `FK_GetGeneralLogData` |
| (เพิ่ม) | `FK_EmptyGeneralLogData` — ใช้ถ้าต้องการล้าง log หลังอ่าน |
| (สำรอง) | `FK_GetLastError` — ใช้ debug error code |

> หมายเหตุ: koffi บน Windows x86 จัดการ `__stdcall` decoration ให้อัตโนมัติเมื่อใช้ชื่อ undecorated เหล่านี้ — ไม่ต้องใส่ `_FK_ConnectNet@N`

## การเปลี่ยนแปลงในไฟล์ `src/hip-sdk.js`

1. แก้ binding ทั้ง 4 ตัวให้ใช้ชื่อ `FK_*`
2. เพิ่ม `FK_GetLastError` เพื่อรายงาน error code เมื่อ connect ไม่สำเร็จ
3. ในฟังก์ชัน `connect()` — เรียก `FK_ConnectNet(ip, port, password)` (signature เดิมใช้ได้)
4. ในฟังก์ชัน `disconnect()` — เรียก `FK_DisConnect(handle)`
5. ในฟังก์ชัน `fetchAttendanceLogs()`:
   - เรียก `FK_LoadGeneralLogData(handle)` แทน `ReadAllGLogData`
   - loop เรียก `FK_GetGeneralLogData(...)` จนกว่าจะ return ค่าที่ไม่ใช่ 0 (หมด record)
6. export `clearLogs()` เพิ่ม (optional) ที่เรียก `FK_EmptyGeneralLogData(handle)` — ให้ผู้ใช้เลือกเองว่าจะล้าง log บนเครื่องสแกนหลังดึงสำเร็จหรือไม่

## หลังจากแก้
รัน:
```
cd /d C:\hip-bridge
npm start
```
ควรจะ connect ได้และดึง log ออกมาเป็น JSON ปกติ ถ้ายัง error จะมี error code จาก `FK_GetLastError` ให้ดูต่อ

หลังคุณกด Approve ผมจะเขียนไฟล์ `src/hip-sdk.js` ฉบับสมบูรณ์ให้ copy ไปวางทับได้ทันที
