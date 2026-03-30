

## ปัญหาที่พบ

ระบบตั้งค่าโมดูลปัจจุบันใช้ **localStorage** ในการเก็บสถานะเปิด/ปิดโมดูล ซึ่งหมายความว่า:
- การตั้งค่าจะมีผลเฉพาะในเบราว์เซอร์ของ Admin ที่ทำการตั้งค่าเท่านั้น
- พนักงานและ roles อื่นๆ ไม่ได้รับการตั้งค่าเพราะ localStorage ของแต่ละคนแยกกัน

## แนวทางแก้ไข

ย้ายการเก็บค่าโมดูลจาก localStorage ไปเก็บในฐานข้อมูล (ตาราง `company_settings` ที่มีอยู่แล้ว) โดยใช้ key `module_settings`

### ขั้นตอน

1. **ModuleSettings.tsx** — เปลี่ยนจาก localStorage เป็นอ่าน/เขียนจากตาราง `company_settings` (key: `module_settings`) ใช้รูปแบบ upsert เหมือน CompanySettings
   
2. **Sidebar.tsx** — เปลี่ยนจากอ่าน localStorage เป็นดึงค่าจาก `company_settings` ตอน mount และ subscribe realtime changes

3. **MobileFooterNav.tsx** — เช่นเดียวกับ Sidebar

4. **Settings.tsx** — เปลี่ยนจากอ่าน localStorage เป็นใช้ค่าจากฐานข้อมูลเดียวกัน

5. **สร้าง Hook กลาง `useModuleSettings`** — เพื่อลดโค้ดซ้ำ โดย hook นี้จะ:
   - ดึงค่าจาก `company_settings` (key = `module_settings`) ตอน mount
   - Subscribe realtime เพื่ออัพเดทอัตโนมัติเมื่อ admin เปลี่ยนค่า
   - ยังคง dispatch `module-settings-changed` event เพื่อให้ component ในหน้าเดียวกันอัพเดททันที

6. **เปิด realtime สำหรับตาราง `company_settings`** — เพิ่ม migration: `ALTER PUBLICATION supabase_realtime ADD TABLE public.company_settings;`

### รายละเอียดทางเทคนิค

- ค่าในฐานข้อมูลจะเป็น JSONB format: `{"employees": true, "attendance": false, "leave": true, ...}`
- ตาราง `company_settings` มี RLS policy ที่อนุญาตให้ทุกคนอ่านได้ และ admin/hr เขียนได้ — เหมาะสมแล้ว
- ลบการอ้างอิง localStorage (`module-settings` key) ออกทั้งหมด
- เก็บ custom event `module-settings-changed` ไว้เป็น fallback สำหรับ in-page reactivity

