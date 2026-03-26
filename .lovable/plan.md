

## แผนการแก้ไข: สร้างบัญชี Auth ให้พนักงานที่ยังไม่มี

### สรุปปัญหา
พนักงาน 25 คนมีข้อมูลในตาราง employees แต่ไม่มีบัญชี Auth (user_id = null) จึงล็อกอินไม่ได้ และบางคนมีอีเมลรูปแบบผิด

### ขั้นตอนการแก้ไข

**1. แก้ไขอีเมลที่รูปแบบไม่ถูกต้อง**
- SQL migration เพื่อ fix 4 อีเมลที่มีปัญหา:
  - `sutee1410@ gmail.com` → `sutee1410@gmail.com`
  - `Yodyachai 885@gmail.com` → `yodyachai885@gmail.com`
  - `Watson01415@.gmail.com` → `watson01415@gmail.com`
  - `tiger_009@hotmail` → `tiger_009@hotmail.com`

**2. สร้างบัญชี Auth ให้พนักงาน 25 คน**
- เรียก Edge Function `create-employee-auth` ที่มีอยู่แล้วเพื่อสร้างบัญชี Auth สำหรับแต่ละคน
- ใช้อีเมลจากตาราง employees และรหัสผ่านเริ่มต้น `Password123!`
- Function จะสร้าง auth user, profile, user_role และเชื่อม user_id กลับมาที่ employees อัตโนมัติ

**3. อัปเดต initial_password**
- ตั้ง `initial_password = 'Password123!'` ให้กับ 25 คนที่เพิ่งสร้างบัญชี

### รายละเอียดทางเทคนิค
- ใช้ `create-employee-auth` Edge Function ที่มี service role key สร้าง auth user แบบ email_confirm: true
- Function ทำ sanitize email อยู่แล้ว (ลบ whitespace)
- แต่อีเมลที่มี `@.` หรือขาด TLD ต้องแก้ในฐานข้อมูลก่อน เพราะ function จะ reject

