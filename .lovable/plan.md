

## แก้ไขการแสดงหน้าตามสิทธิ์ "สิทธิ์ผู้ใช้งาน" (role_permissions)

### ปัญหาที่พบ

หลายหน้ายังใช้ `hasAdminAccess` (hardcoded: admin/hr/manager) จาก AuthContext แทนที่จะใช้ `usePermissions` ที่ดึงสิทธิ์จริงจากตาราง `role_permissions` ทำให้:
- **executive** ที่มีสิทธิ์เต็ม ไม่สามารถอนุมัติ/จัดการข้อมูลได้
- **accountant** ที่มีสิทธิ์ payroll เต็ม กลับถูกบล็อก
- Dashboard แสดง viewType ผิด (executive เห็นแค่มุมมอง employee)

### สิทธิ์ปัจจุบันในฐานข้อมูล (สรุป)

| Role | สิทธิ์เด่น | Scope |
|------|-----------|-------|
| **admin** | ทุกอย่างเต็ม + settings | all |
| **executive** | ทุกอย่างเต็ม (ยกเว้น settings) | all |
| **hr** | ทุกอย่างเต็ม (ยกเว้น settings) | all |
| **manager** | ทุกอย่างเต็ม (ยกเว้น settings, payroll) | department |
| **accountant** | payroll เต็ม, ที่เหลือดูอย่างเดียว | payroll=all, อื่น=self |
| **employee** | ดู+ยื่นลา/OT ของตัวเอง, ไม่เห็น payroll/reports/settings/shifts | self |

### แผนแก้ไข

#### 1) Dashboard — ใช้ usePermissions แทน hardcoded role check
- แทน `viewType` ที่ใช้ `isAdmin/isHR/isManager` ด้วยการตรวจ `getScope(role, 'employee')`:
  - scope = "all" → admin view (admin, executive, hr)
  - scope = "department" → manager view
  - scope = "self" → employee view
- import `usePermissions` และลบการพึ่งพา `isAdmin, isHR, isManager, isAccountant, hasAdminAccess`

#### 2) OvertimeRequest — ใช้ usePermissions
- แทน `hasAdminAccess` ด้วย:
  - `canAction(role, 'ot', 'approve')` → แสดงปุ่มอนุมัติ
  - `canAction(role, 'ot', 'add')` → แสดงฟอร์มยื่นคำขอ
  - `getScope(role, 'ot')` → กรองข้อมูลตาม scope
- กรองข้อมูลด้วย employee_id แทนการเทียบชื่อ (เปราะบาง)

#### 3) Contracts — ใช้ usePermissions
- แทน `hasAdminAccess` ด้วย:
  - `canAction(role, 'contracts', 'add')` → แสดงปุ่มสร้างสัญญา
  - `canAction(role, 'contracts', 'edit')` → แสดงปุ่มแก้ไข
  - `getScope(role, 'contracts')` → กรองสัญญาที่เห็น

#### 4) Notifications — ใช้ usePermissions
- แทน `hasAdminAccess` ด้วย:
  - `canAction(role, 'leave', 'approve') || canAction(role, 'ot', 'approve')` → แสดงส่วนอนุมัติ
  - ปรับ filter/stat cards ตามสิทธิ์จริง

#### 5) Attendance — ตรวจสอบและเพิ่ม permission check
- เพิ่ม `usePermissions` สำหรับ action controls (edit, approve time edits)

### ไฟล์ที่จะแก้ไข
1. `src/pages/Dashboard.tsx` — ใช้ usePermissions กำหนด viewType
2. `src/pages/OvertimeRequest.tsx` — แทน hasAdminAccess ด้วย permissions
3. `src/pages/Contracts.tsx` — แทน hasAdminAccess ด้วย permissions
4. `src/pages/Notifications.tsx` — แทน hasAdminAccess ด้วย permissions
5. `src/pages/Attendance.tsx` — เพิ่ม permission-based action controls

### ผลลัพธ์
ทุกหน้าจะแสดงผลและควบคุมสิทธิ์ตามที่ตั้งค่าไว้ในหน้า "สิทธิ์ผู้ใช้งาน" (role_permissions) โดยไม่ hardcode role ใดๆ — เมื่อแอดมินเปลี่ยนสิทธิ์ ระบบจะปรับการแสดงผลทันที

