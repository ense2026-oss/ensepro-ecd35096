1. ตรวจสอบสถาปัตยกรรม Relay ปัจจุบัน
   - อธิบายว่าเครื่องสแกนหน้าไม่จำเป็นต้องมี IP สาธารณะ เนื่องจากเครื่องเป็นฝ่าย push ข้อมูลออกไปยัง Relay ที่มี URL สาธารณะ (Deno Deploy) แล้ว Relay จะ forward ต่อไปยัง Supabase Edge Function `facescan-adms`
   - ระบบระบุเครื่องจาก Serial Number (SN) ที่ส่งมาในแต่ละ request ไม่ใช่จาก IP ภายใน

2. ตรวจสอบสถานะ Relay ปัจจุบัน
   - ยืนยันว่า URL `https://jaunty-porcupine-90.ense2026-oss.deno.net` ตอบสนอง `/health` และส่งต่อ handshake ถึง Edge Function ได้
   - ตรวจสอบ `relaytest` ที่เรียกจากหน้าตั้งค่าว่าผ่านครบวงจร

3. ตรวจสอบเครื่องสแกนในฐานข้อมูล
   - อ่าน `face_scan_devices` เพื่อดูจำนวนเครื่อง, SN, connection_mode, enabled, last_sync_at, adms_last_seen
   - ยืนยันว่าทุกเครื่องที่เปิดใช้งานมี `connection_mode = 'adms'` และ `relay_url` ถูกต้อง

4. ตรวจสอบประวัติการเชื่อมต่อและ sync logs
   - อ่าน `face_scan_sync_logs` ล่าสุด ดู handshake, adms_push, pull_users, enroll_push
   - สังเกต error หรือ SN ที่ไม่รู้จัก (เช่น TEST123)
   - ตรวจสอบคำสั่งที่ค้างใน status `queued` หรือ `running`

5. สรุปผลและแนะนำขั้นตอนต่อไป
   - รายงานว่าเครื่องไหน online/offline, เครื่องไหนมีคำสั่งค้าง
   - แนะนำการตั้งค่า ADMS ในเครื่องสแกนหากยังไม่ได้เชื่อมต่อจริง