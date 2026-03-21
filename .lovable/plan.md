

## แก้ไข: Logout ไม่ทำงาน + 406 Error บน Published URL

### ปัญหาที่ 1: Logout ไม่ทำงาน
**ไฟล์**: `src/components/layout/Sidebar.tsx` (บรรทัด 267-276)

ปุ่ม logout ใช้ `<NavLink to="/login" onClick={() => logout()}>` ซึ่ง navigate ไป `/login` ก่อนที่ `signOut()` จะเสร็จ → LoginRoute เห็น user ยังอยู่ → redirect กลับ `/dashboard` → วนซ้ำ

**แก้ไข**: เปลี่ยนเป็น `<button>` + `useNavigate` → `await logout()` แล้วค่อย `navigate("/login")`

MobileFooterNav ไม่มีปุ่ม logout จึงไม่ต้องแก้

### ปัญหาที่ 2: 406 Error (company_settings)
`BrandingProvider` query `company_settings` ทันทีที่โหลด แต่ RLS ต้อง `authenticated` เท่านั้น → ยังไม่ login → 406

**แก้ไข**: เพิ่ม RLS policy ให้ `anon` อ่าน `company_settings` ได้ (เป็นข้อมูล branding ที่ไม่ sensitive)

### ไฟล์ที่แก้ไข
1. `src/components/layout/Sidebar.tsx` — เปลี่ยน logout จาก NavLink เป็น button + await
2. Migration SQL — เพิ่ม `anon SELECT` policy บน `company_settings`

