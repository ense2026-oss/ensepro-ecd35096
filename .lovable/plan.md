

## แก้ไข: LoginRoute Redirect Loop → หน้าขาว + Console Errors

### สาเหตุ

`LoginRoute` ใช้ `useEffect` + `navigate` เพื่อ redirect ไป `/dashboard` เมื่อ login สำเร็จ แต่ `navigate` จาก `useNavigate()` เปลี่ยน reference ทุกครั้งที่ render → useEffect re-run → navigate อีก → re-render → **วนซ้ำไม่สิ้นสุด** → "Maximum update depth exceeded" + "Throttling navigation"

### แก้ไข

**ไฟล์**: `src/App.tsx` (บรรทัด 72-85)

เปลี่ยน `LoginRoute` จากใช้ `useEffect` + `useNavigate` เป็นใช้ `<Navigate>` component โดยตรง ซึ่งไม่ทำให้เกิด loop:

```tsx
const LoginRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Login />;
};
```

ลบ `useNavigate` import ออกจาก react-router-dom (ถ้าไม่ใช้ที่อื่น)

### ไฟล์ที่แก้ไข
1. `src/App.tsx` — เปลี่ยน LoginRoute เป็น declarative redirect

