

## แก้ไข: Maximum update depth exceeded ที่ LoginRoute

### สาเหตุ
หลังจาก signup สำเร็จ (auto-confirm เปิดอยู่) เกิด race condition:
1. `onAuthStateChange` fires → set user + set loading=false
2. `getSession` resolves → set user + set loading=false อีกครั้ง
3. `fetchProfileAndRole` ทำงานแบบ async → set profile + role → re-render อีก
4. LoginRoute เห็น `user` → `<Navigate to="/dashboard">` → trigger navigation → re-render วนซ้ำ

### แก้ไข

#### 1. `src/contexts/AuthContext.tsx`
- ใช้ flag `initialized` ref เพื่อให้ `getSession` set state เฉพาะก่อน `onAuthStateChange` fire
- ให้ `loading` เป็น `false` หลังจาก profile/role โหลดเสร็จ (ไม่ใช่ทันทีที่ได้ session)
- เปลี่ยน flow: `getSession` ทำงานก่อน set initial state → `onAuthStateChange` จัดการ subsequent changes

#### 2. `src/App.tsx` — LoginRoute
- เพิ่มการ guard ที่ดีกว่า: ใช้ `session` แทน `user` เพื่อลด re-render
- หรือใช้ `useEffect` + `useNavigate` แทน `<Navigate>` component เพื่อหลีกเลี่ยง render-loop

### ไฟล์ที่แก้ไข
1. `src/contexts/AuthContext.tsx` — แก้ race condition ระหว่าง getSession กับ onAuthStateChange
2. `src/App.tsx` — แก้ LoginRoute ใช้ useEffect+useNavigate แทน Navigate component

