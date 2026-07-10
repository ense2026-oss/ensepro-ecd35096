## เป้าหมาย
ทำให้ระบบสิทธิ์ (Roles) ทำงานสอดคล้องกันทั้งระบบ ตามผลตรวจสอบ โดยยึด role_permissions เป็นแหล่งความจริงเดียว, บังคับ scope (self/department/all) จริงที่ฐานข้อมูล, และรองรับ custom roles

---

## สรุปปัญหาที่จะแก้ (จากผลตรวจสอบ)

1. **Scope ไม่ถูกบังคับที่ DB** สำหรับ leave / overtime / shift / payslip / day_off → ใครมีสิทธิ์ดูก็เห็นข้อมูลทั้งบริษัท แม้ตั้ง scope เป็น department/self
2. **สัญญาจ้าง + คำขอแก้ไขเวลา** ล็อก role ตายตัว (admin/hr/manager/executive) ไม่อ่าน role_permissions
3. **โมดูล `ot` กับ `ot_management`** ขัดกัน (UI เช็คอันหนึ่ง DB บังคับอีกอัน)
4. **Custom roles** (ฝ่ายบุคคล, หัวหน้าทีม ฯลฯ) assign ให้พนักงานไม่ได้ เพราะ `user_roles.role` เป็น enum 6 ค่าเท่านั้น

---

## ส่วนที่ 1 — รองรับ Custom Roles ได้จริง (Database)

ปัญหาแกนคือ `user_roles.role` เป็น enum `app_role` เก็บได้แค่ 6 ค่า

**Migration:**
- เพิ่มคอลัมน์ `role_name text` ใน `user_roles` (เก็บชื่อ role แบบอิสระ ตรงกับ `role_permissions.role_name`)
- backfill: `role_name = role::text` สำหรับแถวเดิมทั้งหมด
- ทำให้ `role` (enum) nullable และตั้ง `role_name` เป็น NOT NULL หลัง backfill; เพิ่ม unique (user_id, role_name)
- ปรับฟังก์ชัน SECURITY DEFINER ให้ใช้ `role_name` แทน `role::text`:
  - `can_access_module` — join `role_permissions` ด้วย `ur.role_name`
  - `can_view_employee_data` — เช่นกัน
  - `has_role(_user_id, _role app_role)` — เทียบ `role_name = _role::text`
  - `get_user_role`, `can_access_leave`, `notify_approvers`, `get_approver_user_ids`, `handle_new_user` — อ่าน/เขียน `role_name`
- `handle_new_user`: เขียนทั้ง `role` (enum, ค่า base ถ้า map ได้ ไม่งั้น null) และ `role_name`

**Edge function + Frontend:**
- `supabase/functions/sync-employee-role`: เขียน `role_name` เสมอ; `role` (enum) เขียนเฉพาะเมื่อเป็น 1 ใน 6 base role (ไม่งั้น null) — แก้จุดที่ตอนนี้ `update ... set role = appRole` แล้ว fail กับ custom role
- ตรวจสอบ `useRoleOptions` / จุด assign role ใน EmployeeFormDialog ให้ส่งชื่อ custom role ไปตรงๆ

---

## ส่วนที่ 2 — บังคับ Scope จริงที่ DB (แบบเต็มรูปแบบ)

เปลี่ยน SELECT policy ที่ตอนนี้ใช้ `can_access_module(..., 'view')` (ไม่มี scope) ให้ใช้ `can_view_employee_data(auth.uid(), <module>, employee_id)` ซึ่งบังคับ self/department/all ให้อยู่แล้ว (เหมือน attendance/employees ที่ทำถูกอยู่แล้ว)

ตารางที่ต้องแก้ SELECT policy:
- `leave_requests` → module `leave`
- `overtime_requests` → module `ot`
- `shift_assignments` → module `shiftManagement`
- `payslips` → module `payroll`
- `employee_dayoff_overrides` → module `day_off`
- `employee_dayoff_patterns` → module `day_off`

คงไว้: policy "อ่าน record ของตัวเอง" ทุกตาราง (พนักงานเห็นของตัวเองเสมอ)

**หมายเหตุที่ต้องยืนยันตอนทำ:** policy "All authenticated can read approved leaves" (ใบลาที่อนุมัติแล้วทุกคนเห็น) ใช้สำหรับปฏิทินลารวม — จะคงไว้เพื่อไม่ให้ปฏิทินพัง (ระบุไว้เป็นข้อยกเว้นของ scope)

---

## ส่วนที่ 3 — สัญญาจ้าง + คำขอแก้ไขเวลา ใช้ role_permissions

- `contracts`: ลบ policy hardcode (admin/hr/manager/executive) แล้วสร้างใหม่แยกตาม action โดยใช้ `can_access_module(auth.uid(),'contracts', view/add/edit/delete)` + scope ผ่าน `can_view_employee_data('contracts', employee_id)` สำหรับ SELECT; คง "อ่านสัญญาตัวเอง"
- `time_edit_requests`: ผูกกับโมดูล `attendance` (เป็นการแก้ข้อมูลเวลา) — ใช้ `can_access_module('attendance','edit'/'approve')` สำหรับจัดการ/อนุมัติ, `can_view_employee_data('attendance', employee_id)` สำหรับดู; คง "อ่าน/สร้างของตัวเอง"

---

## ส่วนที่ 4 — รวมโมดูล OT ให้สอดคล้อง

- ปัจจุบัน DB บังคับด้วย `ot` แต่หน้า `/overtime-management` เช็ค `ot_management` ใน UI
- แก้หน้า `OvertimeManagement.tsx` ให้เช็คสิทธิ์ผ่านโมดูล `ot` (ตรงกับ DB) — ใช้ scope จาก can_view_employee_data
- เลิกใช้ `ot_management` (คงข้อมูลเดิมไว้ได้ แต่ไม่นำมาบังคับ เพื่อลดความสับสน)

---

## ส่วนที่ 5 — ตรวจสอบหลังแก้ (Verification)

- รัน security linter หลัง migration
- ทดสอบด้วย Playwright โดย login เป็น role ต่างๆ (มีเซสชัน admin อยู่แล้ว) ตรวจว่า:
  - Manager (department) เห็นเฉพาะข้อมูลแผนกตัวเองในลา/โอที/กะ/สลิป
  - Employee เห็นเฉพาะของตัวเอง
  - Accountant เห็นสัญญาได้ตามที่เปิดสิทธิ์
- ยิง query ตรวจว่า custom role ที่ assign แล้วได้สิทธิ์ตาม role_permissions จริง

---

## รายละเอียดทางเทคนิค (technical)

- ฟังก์ชันหลักที่เป็นหัวใจ scope คือ `can_view_employee_data(_user_id, _module, _target_employee_id)` ซึ่งเลือก scope กว้างสุดของ role ผู้ใช้ต่อโมดูล แล้วตรวจ self/department/all อยู่แล้ว — แผนนี้แค่นำมาใช้กับตารางที่ยังไม่ได้ใช้ และปรับให้อ่าน `role_name`
- ทุก policy ยังคงมี `has_role(auth.uid(),'admin')` เป็น bypass ให้ admin
- การเปลี่ยน `user_roles` เป็น text-based role ต้องปรับทุกฟังก์ชันที่อ้าง `ur.role` พร้อมกันในไฟล์ migration เดียว เพื่อไม่ให้สิทธิ์หลุดระหว่างทาง
- ไม่แตะ schema `auth`, ไม่แก้ `client.ts`/`types.ts`

**ลำดับงาน:** migration (ส่วน 1–3) → แก้ edge function + โค้ดหน้า OT/ฟอร์ม role (ส่วน 1,4) → linter + ทดสอบ (ส่วน 5)
