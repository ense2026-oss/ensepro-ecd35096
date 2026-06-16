## แผนแก้ไข Roles Settings

### ปัญหาที่พบ
- ใน `RolesSettings.tsx` มี `ระบบแจ้งเตือน` ซ้ำ 2 แถว (`notifications`) ทำให้ตอนกดเพิ่ม/บันทึกสร้างข้อมูลซ้ำใน `role_permissions` และชนข้อจำกัด `role_permissions_role_name_module_key`.
- โค้ดบันทึกปัจจุบัน “ลบสิทธิ์เดิมก่อน แล้วค่อย insert ใหม่” ถ้า insert ล้มเหลว role จะหายทันที จึงทำให้ `hr` และ `executive` หายจากหน้าตั้งค่า.
- ตอนนี้ในฐานข้อมูลไม่มี `hr` และ `executive` ใน `role_permissions` แล้ว แต่ยังมีพนักงานที่ใช้ role `HR` 2 คน และ `Executive` 3 คน.

### สิ่งที่จะทำ
1. **แก้ UI/Logic ของ Roles Settings**
   - ลบ `ระบบแจ้งเตือน` ที่ซ้ำออกจาก `moduleConfigs`.
   - เปลี่ยนการบันทึกจาก “ลบทั้งหมดแล้ว insert” เป็น `upsert` ตามคู่ `role_name + module` เพื่อไม่ให้ role หายถ้าบันทึกไม่สำเร็จ.
   - กรอง `moduleConfigs` ให้ unique ตาม `key` ก่อนสร้าง rows เพื่อกันซ้ำซ้อนในอนาคต.
   - ปรับปุ่มบันทึก/เพิ่มให้ `type="button"` ชัดเจน และกันกดซ้ำระหว่าง saving.

2. **กู้คืนข้อมูล role ที่หาย**
   - เพิ่มข้อมูลสิทธิ์ `hr` และ `executive` กลับเข้า `role_permissions` สำหรับทุก module ที่หน้าตั้งค่ารองรับตอนนี้.
   - ใช้ `upsert`/migration ให้ไม่ทับ role อื่นและไม่สร้างข้อมูลซ้ำ.
   - ตั้งค่า `executive` ให้ `payroll` เป็น “ดูเท่านั้น” ตามตัวอย่างที่เคยแจ้งไว้ก่อนหน้า.

3. **แก้สิทธิ์การจัดการ Roles ให้ตรงกับ matrix**
   - ปรับ RLS ของ `role_permissions` จากการ hardcode ว่า `hr/executive` ทำได้เสมอ ให้ใช้ `can_access_module(..., 'settings_roles', action)` สำหรับ add/edit/delete.
   - คง admin เป็น fallback เพื่อไม่ล็อกระบบ.

4. **ตรวจสอบหลังแก้**
   - ตรวจว่า `hr` และ `executive` กลับมาใน `role_permissions`.
   - ตรวจว่าไม่มี `notifications` ซ้ำใน dialog.
   - ตรวจ flow กดเพิ่ม/บันทึกไม่เกิด unique constraint และไม่ลบ role เดิมเมื่อมี error.