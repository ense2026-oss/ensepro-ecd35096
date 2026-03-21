

## เชื่อมระบบสิทธิ์ Role จากหน้าตั้งค่าให้ใช้งานจริงกับทั้งแอป

### สถานะปัจจุบัน
- **RolesSettings.tsx** มี UI สมบูรณ์ (ตาราง role + dialog แก้ไข permission matrix) แต่ใช้ `useState` เก็บข้อมูลในหน่วยความจำเท่านั้น — รีเฟรชแล้วหาย
- **roleAccess.ts** เป็นไฟล์ config แบบ hardcode ที่ Sidebar/MainLayout ใช้ตัดสินใจแสดงเมนู/บล็อก route
- ทั้งสองระบบไม่เชื่อมกัน → เปลี่ยนสิทธิ์ในหน้าตั้งค่าไม่มีผลจริง

### แผนแก้ไข

#### 1) สร้างตาราง `role_permissions` ในฐานข้อมูล
เก็บ permission matrix ต่อ role ต่อ module:

```
role_permissions
├── id (uuid, PK)
├── role_name (text) — e.g. "admin", "hr", "employee"
├── role_description (text) — e.g. "ผู้ดูแลระบบ"
├── module (text) — e.g. "leave", "ot", "attendance", "employee", ...
├── can_view, can_add, can_edit, can_delete, can_approve (boolean)
├── scope (text) — "self" | "department" | "all"
└── UNIQUE(role_name, module)
```

- RLS: admin อ่าน/เขียนได้ทั้งหมด, authenticated อ่านได้
- Seed ข้อมูลเริ่มต้นจาก default roles ที่มีอยู่ใน RolesSettings

#### 2) สร้าง PermissionsContext (`src/contexts/PermissionsContext.tsx`)
- โหลด `role_permissions` ทั้งหมดครั้งเดียวตอน app bootstrap
- Provide ฟังก์ชัน:
  - `canAccess(role, module)` → ตรวจ `can_view`
  - `canAction(role, module, action)` → ตรวจ can_view/add/edit/delete/approve
  - `getScope(role, module)` → return "self"/"department"/"all"
  - `getModuleRoute(module)` → map module key ↔ route path
- Refresh ข้อมูลเมื่อ admin บันทึกสิทธิ์ใหม่

#### 3) อัปเดต RolesSettings ให้อ่าน/เขียนจากฐานข้อมูล
- โหลด roles + permissions จาก `role_permissions` table
- นับจำนวนผู้ใช้จริงจาก `user_roles` table
- เมื่อบันทึก → upsert ลงฐานข้อมูล → trigger refresh ใน PermissionsContext

#### 4) เปลี่ยน Sidebar, MainLayout, MobileFooterNav ให้ใช้ PermissionsContext
- แทนที่ import จาก `roleAccess.ts` ด้วย hook `usePermissions()`
- เมนูจะแสดง/ซ่อนตาม `can_view` ของ role ผู้ใช้ปัจจุบัน
- Route guard ใช้ permission จริงแทน hardcode

#### 5) Mapping module ↔ route

```text
module key        → route path
leave             → /leave
ot                → /overtime
attendance        → /attendance, /check-in
employee          → /employees
organization      → /organization
shiftManagement   → /shift-management
payroll           → /payroll
reports           → /reports
settings          → /settings
```

### ไฟล์ที่จะแก้ไข/สร้าง
1. **Migration** — สร้างตาราง `role_permissions` + seed ค่าเริ่มต้น + RLS
2. **`src/contexts/PermissionsContext.tsx`** — Context ใหม่สำหรับ permissions
3. **`src/components/settings/RolesSettings.tsx`** — เชื่อมกับฐานข้อมูล
4. **`src/components/layout/Sidebar.tsx`** — ใช้ permissions จาก context
5. **`src/components/layout/MainLayout.tsx`** — ใช้ permissions จาก context
6. **`src/components/layout/MobileFooterNav.tsx`** — ใช้ permissions จาก context
7. **`src/App.tsx`** — เพิ่ม PermissionsProvider ใน tree (ภายใน ProtectedRoute)

### หมายเหตุ
- ไฟล์ `src/config/roleAccess.ts` จะถูกแทนที่ด้วย PermissionsContext แต่จะเก็บไว้เป็น fallback กรณี permission ยังโหลดไม่เสร็จ
- Contracts module จะถูกรวมอยู่ใน permission matrix ด้วย (เพิ่ม module key "contracts")
- Dashboard และ Notifications จะเข้าถึงได้ทุก role เสมอ (ไม่ต้องอยู่ใน matrix)

