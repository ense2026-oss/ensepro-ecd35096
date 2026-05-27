## เป้าหมาย
รวม 2 `StatCarousel` บนหน้า Dashboard ในส่วน Admin/HR/Manager view ให้เหลือชุดเดียว (1 row/track)

## ไฟล์ที่แก้ไข
- `src/pages/Dashboard.tsx` (บรรทัด ~542–554)

## รายละเอียด
ปัจจุบันมี `StatCarousel` 2 ชุดแยกกัน:
- ชุดที่ 1: พนักงาน / มาทำงาน / ลา / มาสาย
- ชุดที่ 2: OT / รออนุมัติ / อนุมัติแล้ว / พนักงานใหม่

จะรวมเป็น `StatCarousel` ชุดเดียวที่บรรจุ 8 `StatCard` ทั้งหมด

## ส่งผล
- **มือถือ**: เหลือ carousel เดียวที่ลากซ้าย-ขวาได้ มี 8 ใบการ์ด
- **เดสก์ท็อป**: grid 4 คอลัมน์ 8 ใบ (2 แถวบนจอปกติ, 1 แถวบนจอกว้างมาก)
- **Employee view**: ไม่เปลี่ยน (มีแค่ 1 row อยู่แล้ว)

## โค้ดที่แก้
ใน `src/pages/Dashboard.tsx` บรรทัด ~542–554 จะเปลี่ยนจาก:
```tsx
<StatCarousel> ...4 cards... </StatCarousel>
<StatCarousel> ...4 cards... </StatCarousel>
```
เป็น:
```tsx
<StatCarousel>
  ...8 cards...
</StatCarousel>
```
ไม่มีการเปลี่ยนแปลง logic, data fetching, หรือ styling อื่น