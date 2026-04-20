

## ปรับหน้า "จัดการกะทำงาน" ให้เป็นรูปแบบเดียวกับ "จัดการวันหยุด"

### เป้าหมาย
เปลี่ยน UX หลักของ `/shifts` ให้เป็น **ปฏิทินตารางรายเดือน** (Monthly Grid) แบบเดียวกับหน้า Day-Off โดยพนักงานแต่ละคนเป็น 1 แถว วันแต่ละวันเป็น 1 คอลัมน์ และแต่ละเซลล์แสดง "กะ" ของคนนั้นในวันนั้น

### โครงสร้าง 3 Tab (เลียนแบบ DayOff)

```text
[ ปฏิทินรายเดือน ] [ รายพนักงาน ] [ จัดการแบบกลุ่ม ]
```

#### Tab 1: ปฏิทินรายเดือน (View หลัก)

- Header: ปุ่ม ‹ เดือน › + ปุ่ม "วันนี้" + ค้นหาชื่อ + ฟิลเตอร์แผนก (เหมือน DayOff)
- ตาราง sticky คอลัมน์ซ้าย = พนักงาน (avatar + ชื่อ + แผนก)
- คอลัมน์อื่น = วันที่ 1..N ของเดือน (มี weekday header เล็ก)
- เซลล์แสดง **ตัวย่อชื่อกะ** + พื้นหลังสี `shift.color` (เช่น "เช้า"=เขียว, "บ่าย"=ส้ม)
- เซลล์ที่ตรงกับวันหยุด (ตามฟังก์ชัน `is_dayoff`) แสดงเป็นสีเทา/ขีด `—` แทน
- คลิกเซลล์ → เปิด popover เลือกกะ (จาก `shifts`) หรือ "ลบกะ"
  - เลือกกะ → upsert เป็น `assignment_type = 'day'` (start=end=วันนั้น)
  - เลือก "ลบ" → ลบ day-assignment ของวันนั้น (จะกลับไปใช้ bulk pattern)
- Logic merge เหมือนเดิม: bulk expand เป็นรายวัน แล้ว day override ทับ
- Legend ด้านบน: รายการกะทั้งหมด (ใช้ `Shift Legend` ที่มีอยู่แล้ว) + คำว่า "คลิกเซลล์เพื่อเปลี่ยนกะ"

#### Tab 2: รายพนักงาน
- เลือกพนักงาน 1 คน → เห็น
  - ปฏิทิน 1 เดือนแบบ grid 7 คอลัมน์ของคนนั้น (reuse logic เดิมจาก calendar dialog)
  - รายการ bulk assignment ทั้งหมด (เริ่ม/สิ้นสุด/กะ) + ปุ่มแก้/ลบ
  - ปุ่ม "เพิ่มกะระยะยาว" เปิด dialog เดิม

#### Tab 3: จัดการแบบกลุ่ม (Bulk)
- ย้ายฟอร์ม "กำหนดกะให้พนักงานหลายคน" (เดิมเป็น dialog) มาเป็น tab content
  - เลือกหลายคน → เลือกกะ → ระบุช่วงวันที่ → บันทึก
- เพิ่มฟีเจอร์ใหม่: **คัดลอกกะของคนหนึ่งไปอีกคน** (ตามช่วงเดือน)

### สิ่งที่คงไว้
- Summary cards 4 ใบด้านบน
- Shift Legend (รายการกะที่ใช้งาน)
- Realtime subscription บน `shift_assignments` + `shifts`
- Dialog แก้ไข/ลบ assignment เดิม (ใช้ร่วมกัน)

### สิ่งที่ตัด/ลด
- `viewMode` table/calendar เดิม → แทนด้วย Tab structure
- ตาราง bulk-assignment แบบ row list เดิม → ยังเข้าถึงได้ใน Tab "รายพนักงาน"
- `ShiftCalendarView` เดิม → ไม่ใช้แล้ว (เก็บไฟล์ไว้ ไม่ลบ)
- Per-employee calendar dialog เดิม → logic ย้ายไป Tab Calendar (in-place click-to-edit)

### รายละเอียดทางเทคนิค

**ฟังก์ชันสำคัญที่จะเพิ่ม** (ใน `ShiftManagement.tsx`):
- `getShiftForDate(empId, dateIso)` — รวม bulk + day override → คืน `Shift | null`
- `setShiftForDate(empId, dateIso, shiftId | null)` — upsert/delete day assignment
- ใช้ `is_dayoff` SQL function ผ่าน `supabase.rpc("is_dayoff", { _employee_id, _date })` แต่เพื่อ performance จะ pre-fetch `employee_dayoff_patterns`, `employee_dayoff_overrides`, `company_holidays` ของเดือนนั้นมาคำนวณฝั่ง client (เลียน DayOff)

**Realtime เพิ่ม**: subscribe `employee_dayoff_overrides`, `employee_dayoff_patterns`, `company_holidays` ด้วย เพื่อให้กริดอัพเดทเมื่อวันหยุดเปลี่ยน

**Permissions**: ใช้ `canAction(role, "shift", "edit")` เช็คก่อน toggle (เหมือนหน้าเดิม) — ถ้าไม่มีสิทธิ์ → cell อ่านอย่างเดียว

**Layout cell**: ขนาด `min-w-[36px] h-8` แสดงตัวอักษร 2 ตัวแรกของชื่อกะ (เช่น "เช") พื้นหลัง `shift.color` + opacity 25% / text สี `shift.color`

### ลำดับการทำ
1. Refactor `ShiftManagement.tsx` เป็น Tab structure (เก็บ state เดิม + เพิ่ม dayoff state)
2. สร้าง Monthly Grid component พร้อม cell click → popover เลือกกะ
3. ย้าย "กำหนดกะให้พนักงานหลายคน" จาก dialog ไปเป็น Tab 3 (Bulk)
4. ใส่ Tab 2 (รายพนักงาน) reuse calendar logic + bulk assignment list
5. เพิ่ม realtime สำหรับตาราง dayoff
6. ทดสอบ end-to-end: คลิกเซลล์ → กะเปลี่ยน, ลบ day → กลับเป็น bulk, วันหยุดแสดงถูกต้อง

