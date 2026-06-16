## เป้าหมาย
ทำให้หน้า "บันทึกเวลา" (Attendance) ทำงานตรงกับการตั้งค่า "สิทธิ์ผู้ใช้งาน" (role_permissions) จริง ทั้งฝั่งหน้าจอและฐานข้อมูล โดยเฉพาะ:
- **employee** → เห็นเฉพาะของตัวเอง (scope = self) และ **ไม่มีสิทธิ์แก้ไขเวลา** (can_edit = false)
- ทุก role อื่น ๆ ทำงานตามค่าที่ตั้งไว้ (view/scope/edit/approve)

## ปัญหาที่พบ
1. **ฝั่งหน้าจอ (`src/pages/Attendance.tsx`)**
   - ดึงข้อมูลทั้งหมดโดยไม่กรองตาม scope → employee เห็นของทุกคน
   - ปุ่ม "แก้ไขเวลา" (ในตาราง) และปุ่ม "ขอแก้ไขเวลา" (หัวข้อ) แสดงให้ทุกคนเห็น ใช้แค่เช็ค `role !== "employee"` แบบฮาร์ดโค้ด ไม่ได้อิงจากสิทธิ์จริง
   - ปุ่ม Export อิง `role !== "employee"` แบบฮาร์ดโค้ดเช่นกัน
2. **ฝั่งฐานข้อมูล (RLS)**
   - policy `Attendance view` และ `Checkin manage view` อนุญาตให้ทุก role ที่มี `can_view = true` อ่าน **ทุกแถว** โดยไม่สนใจ scope → employee สามารถดึงข้อมูลคนอื่นผ่าน API ได้โดยตรง (ช่องโหว่ความปลอดภัย)

## สิ่งที่จะทำ

### 1) ฐานข้อมูล — บังคับ scope จริงด้วย RLS (migration)
สร้างฟังก์ชัน security-definer ตัวเดียวที่ใช้ค่า scope จาก `role_permissions`:

```text
can_view_employee_data(_user_id, _module, _target_employee_id) → boolean
  - อ่าน can_view + scope ของ role ผู้ใช้สำหรับ module นั้น (เลือก scope กว้างสุดถ้ามีหลาย)
  - can_view = false           → false
  - scope = 'all'              → true
  - scope = 'self'             → true เฉพาะแถวที่ employee.user_id = ผู้ใช้
  - scope = 'department'       → true เฉพาะแถวที่อยู่แผนกเดียวกับผู้ใช้
```

แล้วแทนที่ policy view เดิมให้อิงฟังก์ชันนี้:
- `attendance_records`: ลบ policy `Attendance view` เดิม → สร้างใหม่เป็น scope-aware (`has_role(admin)` OR `can_view_employee_data(..., 'attendance', employee_id)`)
- `check_in_records`: ลบ policy `Checkin manage view` เดิม → สร้างใหม่เป็น scope-aware (`..., 'check-in', employee_id`)
- คง policy "อ่านของตัวเอง" เดิมไว้ (เป็น defense-in-depth) และไม่แตะ policy add/edit/delete/approve ที่ใช้ `can_access_module` อยู่แล้ว

ผลลัพธ์: employee/accountant (scope self) จะดึงได้เฉพาะข้อมูลตัวเอง, manager/หัวหน้าทีม (department) ได้เฉพาะแผนกตัวเอง, admin/hr/executive (all) ได้ทั้งหมด — ตรงตามตารางสิทธิ์

### 2) หน้าจอ Attendance — ขับเคลื่อนด้วยสิทธิ์จริง (`src/pages/Attendance.tsx`)
- เพิ่มการอ่านสิทธิ์: `canAction(role,'attendance','edit')`, `getScope(role,'attendance')` และ `currentUser` (เพื่อรู้ employeeId/dept ของตัวเอง)
- **กรองข้อมูลตาม scope** เพิ่มในชั้นหน้าจอ (นอกเหนือจาก RLS) เพื่อให้ตาราง การ์ดสรุป และ dropdown กรองพนักงาน ตรงกับสิทธิ์:
  - self → เฉพาะ `row.employeeId === currentUser.employeeId`
  - department → เฉพาะ `row.dept === currentUser.dept`
  - all → ทั้งหมด
- **ปุ่ม "แก้ไขเวลา" ในตาราง**: แสดงเฉพาะเมื่อ `canEdit` (employee จะไม่เห็น)
- **ปุ่ม "ขอแก้ไขเวลา" (หัวข้อ)**: เปลี่ยนจาก `role !== "employee"` เป็น `canEdit`
- **ปุ่ม Export**: แสดงเฉพาะเมื่อ scope ไม่ใช่ self (employee/accountant จะไม่เห็น) ตรงตามข้อกำหนด "ห้าม export ของ employee"
- แท็บ/ปุ่ม "อนุมัติ-ไม่อนุมัติ" ในคำขอ ยังคงอิง `canApproveTime` (canAction approve) เหมือนเดิม

### 3) ตรวจสอบทุก role ว่าตรงตามค่าที่ตั้งไว้
ค่าที่ตั้งในระบบ (module = attendance) ที่จะถูกบังคับใช้:

```text
role        view  edit  approve  scope        ผลที่ได้
admin        ✓     ✓      ✓       all          เห็นทุกคน + แก้ไข/อนุมัติได้
hr           ✓     ✓      ✓       all          เห็นทุกคน + แก้ไข/อนุมัติ (ไม่ export ถูกตั้งแยก)
executive    ✓     ✓      ✓       all          เห็นทุกคน + แก้ไข/อนุมัติ
manager      ✓     ✓      ✓       department   เห็นเฉพาะแผนก + แก้ไข/อนุมัติ
accountant   ✓     ✗      ✗       self         เห็นเฉพาะตัวเอง อ่านอย่างเดียว
employee     ✓     ✗      ✗       self         เห็นเฉพาะตัวเอง อ่านอย่างเดียว ไม่มีปุ่มแก้ไข
```

(ปัจจุบันมีผู้ใช้จริงเฉพาะ admin/hr/manager/employee/executive — custom role ถูกจำกัดโดย enum อยู่แล้ว)

## การทดสอบ
- ตรวจ migration ผ่าน security linter
- ยืนยันด้วย query ว่า policy view ใหม่อิงฟังก์ชัน scope
- ตรวจหน้าจอ: ในมุมมอง employee ต้องเห็นเฉพาะข้อมูลตัวเอง ไม่มีปุ่มแก้ไข/Export; มุมมอง manager เห็นเฉพาะแผนก; admin/hr/executive เห็นทั้งหมดและแก้ไข/อนุมัติได้

## หมายเหตุ
ไม่แตะ logic การอนุมัติคำขอแก้ไขเวลา (ที่เพิ่งแก้ให้ apply เวลาจริงไปแล้ว) — เปลี่ยนเฉพาะการ "มองเห็น" และ "สิทธิ์ปุ่ม" ให้ตรงการตั้งค่า