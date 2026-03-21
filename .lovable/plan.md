

## แก้ไข Console Errors และปรับปรุงความเร็ว Dashboard

### ปัญหาที่พบ

1. **"Function components cannot be given refs"** — `StatCard` และ `Skeleton` ไม่ได้ใช้ `forwardRef` แต่ถูกส่ง ref ผ่าน animation หรือ parent component
2. **Dashboard โหลดช้า** — `fetchAll()` ดึงข้อมูลทุกตาราง 6 queries พร้อมกันทุกครั้ง + Realtime trigger `fetchAll()` ซ้ำทั้งหมดเมื่อมีการเปลี่ยนแปลงในตารางใดตารางหนึ่ง
3. **TikTok Ads SDK error** — เป็น external script ไม่ใช่โค้ดของเรา ไม่ต้องแก้

### แผนแก้ไข

#### 1. แก้ `Skeleton` ให้ใช้ `forwardRef` (`src/components/ui/skeleton.tsx`)
- เปลี่ยนจาก function component ธรรมดาเป็น `React.forwardRef`

#### 2. แก้ `StatCard` ให้ใช้ `forwardRef` (`src/pages/Dashboard.tsx`)
- เปลี่ยน `StatCard` เป็น `forwardRef` component

#### 3. ปรับปรุงความเร็ว Dashboard (`src/pages/Dashboard.tsx`)
- **จำกัดคอลัมน์ที่ดึง**: ใช้ `.select("id, status, ...")` แทน `.select("*")` สำหรับ `attendance_records` และตารางอื่นๆ
- **เพิ่ม filter วันที่สำหรับ leave/OT**: ดึงเฉพาะข้อมูลเดือนนี้แทนทั้งหมด
- **Debounce realtime callback**: เพิ่ม debounce 500ms เพื่อไม่ให้ fetchAll ถูกเรียกซ้ำถี่เกินไปเมื่อมี event หลายตารางพร้อมกัน

### ไฟล์ที่แก้ไข
1. `src/components/ui/skeleton.tsx` — เพิ่ม forwardRef
2. `src/pages/Dashboard.tsx` — เพิ่ม forwardRef ให้ StatCard, optimize queries, debounce realtime

