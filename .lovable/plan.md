
# แก้ไขการตั้งค่าทุกระบบให้ทำงานได้จริง

จากการตรวจสอบโค้ด พบว่าหลายหน้าตั้งค่า "บันทึกได้แต่ไม่มีผลจริง" เพราะค่าที่บันทึกไม่ถูกนำไปใช้ หรือใช้ค่า hardcode แทน จะแก้ตามลำดับความสำคัญ 3 เฟส

---

## เฟส 1 — ระบบเงินเดือน (กระทบเงินจริง สำคัญสุด)

**ปัญหา:** `PayrollSettings.tsx` เก็บค่าทั้งหมดไว้ใน state เฉย ๆ ปุ่มบันทึกแค่โชว์ toast ไม่ได้เขียนลงฐานข้อมูล ส่วน `Payroll.tsx` และ `exportPayroll.ts` ใช้ค่าตายตัว (`PAYROLL_CONFIG`: เบี้ยขยัน 2000, ประกันสังคม 5%/เพดาน 750, ภาษี progressive) การปรับในหน้าตั้งค่าจึงไม่มีผลต่อการคำนวณเลย

**แก้:**
1. ให้ `PayrollSettings` โหลด/บันทึกค่าจริงลง `company_settings` (key = `payroll_config`) — ครอบคลุม อัตรา OT, เบี้ยขยัน + เงื่อนไขตัด, ประกันสังคม (เปิด/ปิด, %, เพดาน), ภาษี (progressive/flat + อัตรา), ค่ากะ, รอบจ่าย และ Template รายการรายรับ/หัก
2. สร้าง hook กลาง `usePayrollConfig` อ่านค่าจาก `company_settings` พร้อมค่า default เดิมเป็น fallback
3. เปลี่ยน `Payroll.tsx` และ `exportPayroll.ts` ให้ใช้ค่าจาก config นี้แทน `PAYROLL_CONFIG` ที่ hardcode

## เฟส 1 — การเปิด/ปิดโมดูล

**ปัญหา:** `MobileFooterNav.tsx` แม็ป `/shift-management` เป็นคีย์ `"shifts"` แต่ระบบจริงใช้ `"shift-management"` ทำให้เมนูจัดกะบนมือถือไม่ซ่อนเมื่อปิดโมดูล และยังไม่มี guard ป้องกันการเข้าหน้าโดยพิมพ์ URL ตรง ๆ

**แก้:**
1. แก้คีย์ใน `MobileFooterNav.tsx` ให้ตรงกับ `useModuleSettings` (`shift-management`)
2. เพิ่ม guard ในการกำหนดเส้นทาง: ถ้าโมดูลถูกปิด → redirect กลับ `/dashboard` (ใช้ `useModuleSettings` ร่วมกับ `ProtectedRoute`)

---

## เฟส 2 — สิทธิ์ผู้ใช้งาน (Permissions)

**ปัญหา:** `PermissionsContext.canAccessRoute` คืนค่า `true` เมื่อไม่พบ record สิทธิ์ (fallback อนุญาต) ทำให้ role ที่ไม่ได้ตั้งค่าเข้าถึงได้หมด และ `App.tsx` ไม่ได้เรียก `canAccessRoute` ป้องกันเส้นทางเลย จึงตั้ง scope/สิทธิ์ไปก็ไม่กั้นจริง

**แก้:**
1. เพิ่มการบังคับใช้สิทธิ์ใน `ProtectedRoute`/route layer: เรียก `canAccessRoute(role, path)` ถ้าไม่ผ่าน → redirect `/dashboard`
2. ปรับ fallback ของ `canAccessRoute` ให้ปลอดภัยขึ้น (role ที่มี record แต่ module นั้น `can_view=false` ต้องถูกปฏิเสธ — ปัจจุบันถูกแล้ว แต่กรณีไม่มี record เลยจะคงอนุญาตเฉพาะ role ฐาน admin/hr เพื่อไม่ให้ระบบล็อกตัวเอง)
3. ตรวจความสอดคล้องของคีย์ module ระหว่าง `RolesSettings` กับ `PermissionsContext` (ทั้งคู่ใช้ `ot`, `shiftManagement`, `day_off`, `employee` อยู่แล้ว — ยืนยันให้ตรงกัน)

## เฟส 2 — ผู้ดูแลระบบ (Admin)

**ปัญหา:** `AdminsSettings` บันทึก `role = "Admin"` (Title Case) ลงตาราง employees แล้วพึ่ง edge function `sync-employee-role` ไป sync `user_roles` หากชื่อ role ไม่ตรงรูปแบบ (Title Case vs lowercase enum) สิทธิ์จริงอาจไม่ตรงกับที่แสดง

**แก้:**
1. ตรวจ `sync-employee-role` ให้ normalize role เป็น lowercase ก่อนเขียน `user_roles` (enum `app_role`)
2. ยืนยันว่าเมื่อเพิ่ม/แก้ผู้ดูแล ระบบ sync เข้า `user_roles` จริง (เช็ค log)

---

## เฟส 3 — การอนุมัติหลายชั้น (Approval Tiers)

**ปัญหา:** ระบบลา (`Leave.tsx`) บังคับลำดับ tier ถูกต้องแล้ว (มี `current_tier/approved_tiers/total_tiers` + ป้องกันอนุมัติซ้ำผ่าน `approval_logs`) แต่ฝั่ง **การแก้ไขเวลา (Time Edit)** และ **Attendance** ยังข้ามลำดับ tier อนุมัติทันที

**แก้:**
1. นำตรรกะ tier แบบเดียวกับ Leave มาใช้ใน `TimeEditContext`/หน้าที่อนุมัติ time edit: เดินทีละ tier, อ่าน `approval_config` (key `time_edit`), ป้องกันอนุมัติซ้ำด้วย `approval_logs`
2. แจ้งเตือนผู้อนุมัติเฉพาะ tier ปัจจุบันผ่าน `notify_approvers`/`get_approver_user_ids`

## เฟส 3 — โควต้าวันลา

**ปัญหา:** การเช็คโควต้าอยู่ฝั่ง frontend อย่างเดียว (`Leave.tsx` คำนวณ remaining) — ยังขาดการกันชั้น backend

**แก้:**
1. เพิ่ม database trigger/validation บน `leave_requests` (BEFORE INSERT/UPDATE) ตรวจวันลารวม (approved + pending) ไม่ให้เกิน `leave_types.quota` ปฏิเสธถ้าเกิน
2. คง validation frontend ไว้เพื่อ UX ที่ดี

---

## หมายเหตุทางเทคนิค

- ค่าตั้งค่าทั้งหมดเก็บใน `company_settings` (มี RLS ให้ admin/hr จัดการ, ทุกคนอ่านได้) — สอดคล้องกับ `approval_config`/`module_settings` ที่มีอยู่
- การคำนวณเงินเดือนจะใช้ override ราย record เดิม (`payroll_overrides`) ก่อน แล้วจึง fallback ไปค่าจาก config
- trigger โควต้าลาใช้รูปแบบ validation trigger (ไม่ใช้ CHECK constraint) ตามมาตรฐานโปรเจกต์
- ไม่แตะไฟล์ auto-generated (`client.ts`, `types.ts`)

จะเริ่มทำเฟส 1 ก่อนเพราะกระทบเงินจริงและการมองเห็นเมนู หากอนุมัติแผนนี้ผมจะลงมือทันที
