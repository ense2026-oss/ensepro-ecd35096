
สรุปปัญหาหลัก: การยืนยันตัวตนฝั่ง backend น่าจะสำเร็จแล้ว แต่หน้าเว็บวนสลับระหว่าง `/login` กับ `/dashboard` เพราะ logic ฝั่ง frontend ใช้เงื่อนไขไม่สอดคล้องกัน ทำให้ provider ต่าง ๆ ถูก mount ซ้ำและยิง request จำนวนมากจน browser ขึ้น `ERR_INSUFFICIENT_RESOURCES`

### สิ่งที่ต้องแก้

#### 1) ทำให้สถานะ auth bootstrap เสถียร
ไฟล์: `src/contexts/AuthContext.tsx`

- ปรับ `fetchProfileAndRole()` ให้ไม่ทำให้ระบบค้างถ้า profile/role หาไม่เจอ
- เปลี่ยน query ที่เสี่ยง throw จาก `.single()` เป็นแนวทางที่ handle “ไม่มีข้อมูล” ได้
- เพิ่ม fallback profile ขั้นต่ำจากข้อมูลผู้ใช้ที่ login อยู่ เพื่อให้ `currentUser` ไม่เป็น `null` ระหว่างรอโหลด
- แยกสถานะให้ชัดว่า
  - `user` = มี session แล้ว
  - `profile ready` = โหลดข้อมูลประกอบเสร็จหรือ fallback พร้อมใช้แล้ว

ผลลัพธ์: login สำเร็จแล้ว UI จะไม่หลุดกลับหน้า login เพราะ `currentUser` ยังไม่ทันมา

#### 2) เอา navigation หลัง login ออกแบบที่ race กับ auth state
ไฟล์: `src/pages/Login.tsx`

- ตอนนี้หน้า login `navigate("/dashboard")` ทันทีหลัง `login()` สำเร็จ
- จะเปลี่ยนให้ submit แค่เรียก `auth.login(...)` แล้วปล่อยให้ route guard ตัดสินใจ redirect เองเมื่อ auth state พร้อมจริง

ผลลัพธ์: ไม่รีบกระโดดไป dashboard ก่อน profile/currentUser พร้อม

#### 3) แก้ route guard ใน layout ไม่ให้สร้าง redirect loop
ไฟล์: `src/components/layout/MainLayout.tsx`

- ตอนนี้ `MainLayout` ใช้ `if (!currentUser) return <Navigate to="/login" />`
- จะเปลี่ยนเป็น:
  - ถ้า auth ยัง bootstrap ไม่เสร็จ → แสดง loading state
  - ถ้าไม่มี `user` จริง ๆ ค่อย redirect ไป `/login`
  - ถ้ามี `user` แล้วแต่ข้อมูลประกอบยังมาไม่ครบ → ไม่ redirect ซ้ำ

ผลลัพธ์: ตัดวงจร `/login -> /dashboard -> /login`

#### 4) ใช้ employee record id ให้ถูกที่สำหรับ self-route
ไฟล์:
- `src/components/layout/MainLayout.tsx`
- `src/components/layout/Sidebar.tsx`

- ตอนนี้บางจุดยังใช้ `currentUser.id` (auth user id) เพื่อพาไป `/employees/:id`
- จะเปลี่ยนให้ใช้ `currentUser.employeeId` แทนทุกจุดที่เป็น “โปรไฟล์พนักงานของตัวเอง”
- ใส่ fallback ไป `/profile` ถ้ายังไม่มี employee link

ผลลัพธ์: หลัง login แล้ว route ของพนักงานจะไม่ชี้ไป id ผิดประเภท

#### 5) Hardening ฝั่งฐานข้อมูลสำหรับผู้ใช้ใหม่
งาน migration

- ตรวจพบว่ามีฟังก์ชัน `handle_new_user()` อยู่แล้ว แต่ยังไม่มี trigger ใช้งาน
- จะเพิ่ม trigger ให้สร้าง profile/role อัตโนมัติเมื่อมีผู้ใช้ใหม่
- ทำ one-time backfill สำหรับผู้ใช้ที่อาจมี account แล้วแต่ยังไม่มี profile/role

ผลลัพธ์: ผู้ใช้ใหม่ในอนาคตจะไม่เจออาการ login แล้วใช้งานต่อไม่ได้เพราะข้อมูลประกอบไม่ถูกสร้าง

### ผลที่คาดว่าจะได้หลังแก้
- login แล้วไม่เด้งกลับหน้า login
- หน้าไม่ขาว
- request flood ใน console ลดลงมาก
- error `Failed to fetch employees` / `ERR_INSUFFICIENT_RESOURCES` หายไปหรือเหลือเฉพาะ error จริง
- การเข้าเมนูข้อมูลส่วนตัวของผู้ใช้ทำงานถูก id

### ไฟล์ที่จะเกี่ยวข้อง
- `src/contexts/AuthContext.tsx`
- `src/pages/Login.tsx`
- `src/components/layout/MainLayout.tsx`
- `src/components/layout/Sidebar.tsx`
- migration ใหม่ใน `supabase/migrations/`

### รายละเอียดเชิงเทคนิค
```text
ปัจจุบัน
login success
-> user ถูก set แล้ว
-> Login.tsx navigate("/dashboard")
-> ProtectedRoute ผ่าน
-> MainLayout เห็น currentUser ยัง null
-> redirect กลับ /login
-> LoginRoute เห็น user ยังอยู่
-> redirect ไป /dashboard อีก
-> loop + providers mount/unmount + request storm
```

```text
หลังแก้
login success
-> auth state พร้อม
-> profile โหลดหรือ fallback พร้อม
-> LoginRoute ค่อย redirect
-> MainLayout รอ bootstrap ให้เสร็จก่อน
-> เข้า dashboard ได้ครั้งเดียว ไม่ loop
```
