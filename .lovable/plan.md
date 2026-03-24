

## ตรวจสอบและแก้ไขระบบลางาน ให้ทุก Role ใช้งานได้จริงตามสิทธิ์

### ปัญหาที่พบ

1. **ใช้ `hasAdminAccess` แบบ hardcode** — ไม่ได้ใช้ PermissionsContext ที่สร้างไว้แล้ว ทำให้ executive ไม่สามารถอนุมัติได้แม้ตั้งค่าสิทธิ์ไว้
2. **ไม่กรองข้อมูลตาม scope** — manager ที่ตั้ง scope เป็น "department" ยังเห็นข้อมูลทุกคน, employee เห็นข้อมูลตัวเองแต่ใช้วิธี filter ด้วยชื่อ (เปราะบาง)
3. **โควต้าลาแสดงรวมทุกคน** — employee ควรเห็นโควต้าเฉพาะตัวเอง
4. **RLS ไม่ครอบคลุม executive/accountant** — role เหล่านี้ไม่ได้อยู่ใน policy `Admin/HR/Manager full access` จึง query/update ไม่ได้
5. **ปุ่มอนุมัติ/ไม่อนุมัติ** ใช้ `hasAdminAccess` แทน `canAction(role, 'leave', 'approve')`
6. **รายชื่อผู้ทดแทน hardcode** ใน LeaveRequestDialog

### แผนแก้ไข

#### 1) แก้ RLS policy ของ `leave_requests` ให้ครอบคลุมทุก role ที่มีสิทธิ์
- เพิ่ม `executive` และ `accountant` ใน policy ตามที่ตั้งค่าไว้ใน role_permissions
- ใช้ approach: สร้าง DB function `can_access_leave()` ที่ตรวจจาก `role_permissions` table ว่า role นั้นมี `can_view = true` สำหรับ module "leave" หรือไม่
- หรือ approach ที่ง่ายกว่า: เพิ่ม executive/accountant เข้า policy (เนื่องจาก role เหล่านี้มีจำกัด)

#### 2) อัปเดต `Leave.tsx` ให้ใช้ `usePermissions`
- แทน `hasAdminAccess` ด้วย:
  - `canAction(role, 'leave', 'approve')` → แสดงปุ่มอนุมัติ
  - `canAction(role, 'leave', 'add')` → แสดงปุ่มยื่นคำขอ
  - `getScope(role, 'leave')` → กรองข้อมูลตาม scope
- กรอง `leaves` ตาม scope:
  - **self**: แสดงเฉพาะของตัวเอง
  - **department**: แสดงเฉพาะพนักงานในแผนกเดียวกัน
  - **all**: แสดงทั้งหมด

#### 3) แก้โควต้าลาให้แสดงตาม scope
- **self**: คำนวณ used จาก leave_requests ของ employee ปัจจุบันเท่านั้น
- **department/all**: แสดงภาพรวมหรือซ่อน quota cards (เพราะเป็นข้อมูลรวม)

#### 4) อัปเดต `LeaveRequestDialog`
- ใช้ `canAction(role, 'leave', 'add')` ควบคุมการแสดง dialog
- เมื่อ scope = "self": ล็อกชื่อพนักงานเป็นตัวเอง ไม่ให้เลือกคนอื่น
- เมื่อ scope = "department"/"all": แสดง dropdown เลือกพนักงาน (กรองตาม scope)
- แทนรายชื่อผู้ทดแทน hardcode ด้วยรายชื่อจริงจาก EmployeeContext

#### 5) อัปเดต `LeaveTable`
- ส่ง `canApprove` prop แทน `hideActions` — ตรวจจาก `canAction(role, 'leave', 'approve')`

### ไฟล์ที่จะแก้ไข
1. **Migration** — เพิ่ม RLS policy ให้ `leave_requests` ครอบคลุม executive/accountant (ผ่าน DB function ที่ตรวจ `role_permissions`)
2. **`src/pages/Leave.tsx`** — ใช้ usePermissions, กรองตาม scope, โควต้าตาม role
3. **`src/components/leave/LeaveRequestDialog.tsx`** — กรองรายชื่อตาม scope, แทนผู้ทดแทน hardcode
4. **`src/components/leave/LeaveTable.tsx`** — ปรับ prop ให้รองรับ canApprove จาก permissions
5. **`src/components/leave/LeaveQuotaCards.tsx`** — (ไม่ต้องแก้ รับ data จาก parent)

### สรุปผลลัพธ์ที่คาดหวัง

| Role | เห็นข้อมูล | ยื่นลา | อนุมัติ | แก้ไข/ลบ |
|------|-----------|--------|---------|----------|
| employee | ของตัวเอง | ✓ (ตัวเอง) | ✗ | ✗ |
| manager | แผนกตัวเอง | ✓ (ลูกน้อง+ตัวเอง) | ✓ | ตามสิทธิ์ |
| hr | ทั้งหมด | ✓ (ทุกคน) | ✓ | ตามสิทธิ์ |
| admin | ทั้งหมด | ✓ (ทุกคน) | ✓ | ✓ |
| executive | ทั้งหมด | ✓ (ตัวเอง) | ✓ | ตามสิทธิ์ |
| accountant | ทั้งหมด (ดูอย่างเดียว) | ✗ | ✗ | ✗ |

