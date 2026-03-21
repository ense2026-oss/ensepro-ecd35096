

## แผนเชื่อมต่อระบบ HR กับ Lovable Cloud (ฐานข้อมูลจริง)

โปรเจกต์นี้มีข้อมูล mock ทั้งหมดอยู่ใน React Context (useState) — ข้อมูลจะหายเมื่อ refresh หน้า แผนนี้จะย้ายทุกอย่างไปเก็บในฐานข้อมูลจริงผ่าน Lovable Cloud

---

### ภาพรวมสิ่งที่ต้องทำ (แบ่งเป็น Phase)

#### Phase 1: ระบบ Authentication + Profiles
- สร้างตาราง `profiles` (เก็บข้อมูลพื้นฐาน: ชื่อ, avatar, username)
- สร้างตาราง `user_roles` (แยก role ออกจาก profile ตาม best practice)
- ตั้ง trigger สร้าง profile อัตโนมัติเมื่อ signup
- เปลี่ยน AuthContext จาก demo credentials → Supabase Auth (email+password)
- สร้างหน้า Login/Signup ใหม่ใช้ Supabase Auth
- เปิด auto-confirm email เพื่อความสะดวกในการทดสอบ (ผู้ใช้ขอให้ใช้งานได้จริง)

#### Phase 2: ข้อมูลพนักงาน (Employees)
- สร้างตาราง `employees` (40+ columns ตาม Employee interface)
- สร้างตาราง `employee_education`, `employee_work_history`, `employee_custom_payroll_items`
- ย้าย EmployeeContext จาก useState → useQuery/useMutation กับ Supabase
- RLS: Admin/HR/Manager เห็นทุกคน, Employee เห็นเฉพาะตัวเอง
- Seed demo data ผ่าน migration

#### Phase 3: โครงสร้างองค์กร + สังกัด
- สร้างตาราง `affiliations` (สังกัด)
- สร้างตาราง `positions` (ตำแหน่ง, parent_id สำหรับ sub-position)
- สร้างตาราง `org_nodes` (โครงสร้างองค์กร, parent_id แบบ tree)
- ย้าย OrgContext → Supabase queries

#### Phase 4: สัญญาจ้าง (Contracts)
- สร้างตาราง `contracts`, `contract_signatures`, `contract_attachments`, `contract_notifications`
- สร้าง storage bucket สำหรับเก็บไฟล์ลายเซ็นและเอกสารแนบ
- ย้าย ContractContext → Supabase queries
- RLS: Employee เห็นเฉพาะสัญญาของตัวเอง

#### Phase 5: การลงเวลา + ลา + OT
- สร้างตาราง `attendance_records`, `check_in_records`
- สร้างตาราง `leave_types`, `leave_requests`
- สร้างตาราง `overtime_requests`
- สร้างตาราง `time_edit_requests`
- ย้ายข้อมูลจาก mock ใน component-level useState → Supabase

#### Phase 6: การแจ้งเตือน + ตั้งค่า
- สร้างตาราง `app_notifications`
- สร้างตาราง `company_settings` (branding, modules, display, contract settings)
- ย้าย TimeEditContext, PendingCountsContext, BrandingContext → Supabase
- เปิด Realtime สำหรับ notifications

---

### ตารางฐานข้อมูลที่จะสร้าง (รวม 15+ ตาราง)

```text
profiles ──── user_roles
    │
employees ──── employee_education
    │          employee_work_history  
    │          employee_custom_payroll_items
    │
affiliations ── positions (tree: parent_id)
    │
org_nodes (tree: parent_id)
    │
contracts ──── contract_signatures
    │          contract_attachments
    │          contract_notifications
    │
attendance_records
check_in_records
leave_types ── leave_requests
overtime_requests
time_edit_requests
app_notifications
company_settings
```

### RLS Policies (หลัก)
- **profiles**: ผู้ใช้อ่าน/แก้ไขได้เฉพาะของตัวเอง, Admin อ่านได้ทั้งหมด
- **employees**: Admin/HR/Manager CRUD ทั้งหมด, Employee อ่านเฉพาะตัวเอง
- **contracts**: Admin/HR จัดการได้, Employee อ่านเฉพาะสัญญาของตัวเอง
- **leave/attendance/OT**: Admin/HR เห็นทั้งหมด, Employee เห็นเฉพาะของตัวเอง

### ไฟล์ที่ต้องแก้ไข (หลัก)
1. **Migration SQL** — สร้างตาราง + RLS + seed data
2. `src/contexts/AuthContext.tsx` — เปลี่ยนเป็น Supabase Auth
3. `src/contexts/EmployeeContext.tsx` — เปลี่ยนเป็น Supabase queries
4. `src/contexts/OrgContext.tsx` — เปลี่ยนเป็น Supabase queries
5. `src/contexts/ContractContext.tsx` — เปลี่ยนเป็น Supabase queries
6. `src/contexts/TimeEditContext.tsx` — เปลี่ยนเป็น Supabase queries
7. `src/contexts/BrandingContext.tsx` — เปลี่ยนจาก localStorage → DB
8. `src/contexts/PendingCountsContext.tsx` — คำนวณจาก DB queries
9. `src/pages/Login.tsx` — ใช้ Supabase Auth login
10. `src/pages/Attendance.tsx` — ดึงข้อมูลจาก DB
11. `src/pages/Leave.tsx` — ดึงข้อมูลจาก DB
12. `src/pages/CheckIn.tsx` — บันทึกลง DB
13. `src/pages/OvertimeRequest.tsx` — ดึง/บันทึกจาก DB
14. `src/App.tsx` — เพิ่ม auth guard + route protection

### Storage Bucket
- `signatures` — เก็บรูปลายเซ็น
- `attachments` — เก็บเอกสารแนบสัญญา
- `avatars` — เก็บรูปโปรไฟล์พนักงาน

### ลำดับการทำงาน
เนื่องจากงานนี้มีขนาดใหญ่มาก จะทำทีละ Phase ในแต่ละ message:
1. **Message 1**: Phase 1 (Auth + Profiles + Roles) — สร้างตาราง + แก้ Auth + Login
2. **Message 2**: Phase 2 (Employees) — สร้างตาราง + แก้ Context
3. **Message 3**: Phase 3 (Org + Affiliations) — สร้างตาราง + แก้ Context
4. **Message 4**: Phase 4 (Contracts) — สร้างตาราง + Storage + แก้ Context
5. **Message 5**: Phase 5 (Attendance/Leave/OT) — สร้างตาราง + แก้หน้าต่างๆ
6. **Message 6**: Phase 6 (Notifications/Settings) + QA ทั้งระบบ

