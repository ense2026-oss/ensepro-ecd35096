
สิ่งที่ตรวจพบ

1. จำนวนในหน้า “สิทธิ์ผู้ใช้งาน” ตอนนี้นับจาก `public.user_roles` ไม่ได้นับจากพนักงานที่มีอยู่จริงในตาราง `employees`
- ตอนนี้ฐานข้อมูลมี `user_roles = 15` บัญชี
- แต่ `employees = 5` คน
- จึงทำให้หน้า Settings แสดง `employee = 7` เพราะมันนับ “บัญชีล็อกอิน” ไม่ใช่ “พนักงาน”

2. มีช่องโหว่เชิงข้อมูลที่ทำให้ตัวเลขเพี้ยนสะสม
- ลบพนักงานแล้ว ลบแค่แถวใน `employees`
- แต่บัญชีล็อกอิน / `profiles` / `user_roles` ยังอยู่
- ผลคือ Roles page จะนับคนเกินจริงเรื่อย ๆ

3. การเปลี่ยน role ของพนักงานยังไม่ sync กับสิทธิ์จริง
- `EmployeeContext.updateEmployee()` อัปเดต `employees.role`
- แต่ไม่ได้อัปเดต `user_roles`
- แปลว่า role ที่เห็นในข้อมูลพนักงาน อาจไม่ตรงกับ role ที่ระบบใช้ตรวจสิทธิ์จริง

4. การแก้สิทธิ์ในหน้า Roles ใช้งานได้ “ระดับ UI”
- `RolesSettings` บันทึกลง `role_permissions` ได้
- `usePermissions()` อ่านสิทธิ์ใหม่ได้
- แต่ backend/RLS ยังมีบางส่วนที่ hardcode role อยู่ ทำให้ “แก้สิทธิ์แล้วบางหน้าหรือบางข้อมูลอาจยังไม่เปลี่ยนตาม”

แผนแก้ไข

1. แก้แหล่งนับจำนวนในหน้า Roles ให้ถูกต้อง
- เปลี่ยนจากนับ `user_roles` ล้วน ๆ
- ไปนับเฉพาะบัญชีที่ผูกกับ `employees.user_id`
- แสดงผลเป็น “จำนวนพนักงานที่ผูกบัญชีแล้ว” ให้ชัดเจน
- ถ้าต้องการความโปร่งใส จะเพิ่มข้อมูลรองว่า “มีบัญชีล็อกอินที่ยังไม่ผูกกับพนักงานอีกกี่บัญชี”

2. แก้ lifecycle ของ role ให้เป็นข้อมูลชุดเดียวกันจริง
- ตอนแก้ role ของพนักงาน: อัปเดตทั้ง `employees.role` และ `user_roles`
- ตอนลบพนักงาน: จัดการบัญชีที่ผูกอยู่ด้วย ไม่ปล่อย orphan account ค้าง
- ทำผ่าน backend function ที่ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์ ไม่อัปเดต `user_roles` จาก client ตรง ๆ

3. ทำ data cleanup สำหรับข้อมูลที่เพี้ยนอยู่แล้ว
- ตรวจบัญชีที่มี `user_roles` แต่ไม่มี `employees`
- ตรวจพนักงานที่มี `employees.role` ไม่ตรงกับ `user_roles`
- ทำ migration/cleanup script ให้ข้อมูลกลับมาตรงกัน
- จะไม่ลบบัญชีทิ้งแบบเดาสุ่ม แต่จะยึด “บัญชีที่ผูกกับพนักงาน” เป็นฐานของตัวเลขในหน้า Settings

4. ทำให้การแก้สิทธิ์ “ใช้งานได้จริง” มากขึ้น
- ตรวจตาราง/นโยบายที่ยัง hardcode `admin/hr/manager`
- ค่อย ๆ เปลี่ยนให้ตรวจจาก `role_permissions` / helper function เดียวกัน
- เริ่มจากส่วนที่กระทบผู้ใช้จริงก่อน: employees, organization-related data, notifications, leave/attendance ที่เกี่ยวกับ role-based access

ไฟล์/ส่วนที่จะปรับ

- `src/components/settings/RolesSettings.tsx`
  - เปลี่ยน logic การนับจำนวน
  - ปรับข้อความใน UI ให้สื่อว่ากำลังนับอะไร
  - เพิ่ม warning ถ้ามี orphan auth accounts

- `src/contexts/EmployeeContext.tsx`
  - ตอน update role ต้องเรียก backend function เพื่อ sync `user_roles`
  - ตอน delete employee ต้อง cleanup บัญชีที่ผูกอยู่

- Backend function ใหม่
  - ฟังก์ชันอัปเดต role ของพนักงานอย่างปลอดภัย
  - ฟังก์ชันลบ/ยกเลิกการผูกบัญชีพนักงานอย่างปลอดภัย

- Migration ใหม่
  - cleanup / reconcile ข้อมูล role ที่ค้าง
  - ปรับ RLS บางส่วนให้สอดคล้องกับ dynamic permissions มากขึ้น

รายละเอียดทางเทคนิค

```text
Current problem
employees.role        -> ใช้แสดงผลบางจุด
user_roles.role       -> ใช้สิทธิ์จริง
role_permissions      -> ใช้กำหนดสิทธิ์ราย role

ตอนนี้ 3 ส่วนนี้ยัง sync กันไม่ครบ
```

```text
Target state
employee edit/delete
   -> backend function
   -> sync employees + user_roles (+ cleanup auth link when needed)

roles settings count
   -> count linked employees by role
   -> optional secondary orphan-account summary
```

สิ่งที่จะตรวจสอบหลังแก้

1. จำนวน role ในหน้า Settings ต้องตรงกับ “พนักงานที่ผูกบัญชีจริง”
2. เปลี่ยน role ของพนักงานแล้ว สิทธิ์เมนู/การเข้าถึงต้องเปลี่ยนตามหลัง login ใหม่
3. ลบพนักงานแล้ว จำนวนใน Roles ต้องลดลงทันทีและไม่เหลือ role ค้าง
4. แก้สิทธิ์ในหน้า Roles แล้ว เมนูและการเข้าถึงข้อมูลต้องสอดคล้องกันทั้ง UI และ backend

หมายเหตุสำคัญ

- ปัญหา `employee = 7` ที่คุณเห็น ไม่ใช่แค่ UI นับผิดอย่างเดียว แต่สะท้อนว่าโครงสร้าง role assignment กับ account lifecycle ยังไม่ sync กันครบ
- ถ้าจะแก้ให้ “เชื่อถือได้จริง” ต้องแก้ทั้งหน้า Settings, การแก้ role ของพนักงาน, การลบพนักงาน, และการบังคับใช้สิทธิ์ฝั่ง backend พร้อมกัน
- จะไม่แตะไฟล์ generated เช่น `src/integrations/supabase/client.ts` และ `src/integrations/supabase/types.ts`
