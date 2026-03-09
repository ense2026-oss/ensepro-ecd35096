

## แผนแก้ไข: ซ่อนปุ่มลงเวลาตามการตั้งค่าโมดูล

### ปัญหาที่พบ
ปุ่ม "ลงเวลา" ใน 2 จุดถูก **hardcode** ไว้ ไม่ได้เช็คการตั้งค่าโมดูล:
1. **Topbar.tsx** (บรรทัด 176-187) — ปุ่มลงเวลา (ไอคอน MapPin) ข้างปุ่มกระดิ่ง
2. **MobileFooterNav.tsx** (บรรทัด 139-176) — ปุ่ม floating กลางจอ

### สิ่งที่จะแก้ไข

#### 1. `src/components/layout/Topbar.tsx`
- เพิ่มการอ่าน module settings จาก localStorage + listen event `module-settings-changed`
- ซ่อนปุ่ม "ลงเวลา" เมื่อ `check-in` module ถูกปิด

#### 2. `src/components/layout/MobileFooterNav.tsx`
- ปุ่ม floating ตรงกลาง: ซ่อนเมื่อ `check-in` module ถูกปิด
- ถ้าปิดปุ่มกลาง ให้ layout ของเมนูด้านล่างกระจายเต็มแถวแทน (ไม่เว้นช่องว่างตรงกลาง)

### ไฟล์ที่แก้ไข
1. `src/components/layout/Topbar.tsx` — เพิ่ม module check, conditional render ปุ่มลงเวลา
2. `src/components/layout/MobileFooterNav.tsx` — เพิ่ม conditional render ปุ่ม floating + ปรับ layout

