

## ระบบจัดการวันหยุดแบบยืดหยุ่นสูง (Flexible Day-Off Management)

### แนวคิดหลัก

ออกแบบให้พนักงานแต่ละคนมีวันหยุด **ไม่ซ้ำกัน** และ **เปลี่ยนได้ทุกสัปดาห์** โดยใช้แนวคิด 3 ชั้น:

```text
ชั้น 1: Default Pattern (รูปแบบประจำ)        ← ตั้งครั้งเดียว ใช้ตลอด
   └─ เช่น "หยุดทุกอาทิตย์" หรือ "หยุดเสาร์-อาทิตย์"
ชั้น 2: Weekly Override (ปรับรายสัปดาห์)     ← หัวหน้าจัดทุกสัปดาห์
   └─ เช่น สัปดาห์นี้คนนี้หยุดวันพุธแทน
ชั้น 3: Single-Day Exception (เพิ่ม/ลบรายวัน) ← จัดเฉพาะกิจ
   └─ เช่น วันนี้สลับให้หยุดแทนเพื่อน
```

ลำดับความสำคัญ: **Exception > Override > Default**

---

### ฐานข้อมูล (3 ตารางใหม่)

**1. `employee_dayoff_patterns`** — รูปแบบวันหยุดประจำของแต่ละคน
- `employee_id`, `weekdays` (array: 0-6, 0=อาทิตย์), `effective_from`, `effective_to`
- รองรับการเปลี่ยน pattern ตามช่วงเวลา (เช่น เดือนนี้หยุดอาทิตย์ เดือนหน้าหยุดจันทร์)

**2. `employee_dayoff_overrides`** — วันหยุดเฉพาะกิจรายวัน
- `employee_id`, `date`, `is_dayoff` (true=หยุด, false=ทำงานแทน), `reason`, `created_by`
- ใช้ทั้ง "เพิ่มวันหยุด" และ "ยกเลิกวันหยุดของ pattern"

**3. `company_holidays`** — วันหยุดบริษัท (นักขัตฤกษ์)
- `date`, `name`, `is_paid`
- มีผลกับทุกคน เว้นแต่มี override

**RLS:** Admin/HR/Manager จัดการได้ทั้งหมด, Employee อ่านของตัวเองได้

---

### หน้า UI ที่จะสร้าง (3 หน้า)

#### 1. หน้าตั้งค่าส่วนกลาง — `Settings → "วันหยุดบริษัท"` (tab ใหม่)
- รายการวันหยุดประจำปี (นักขัตฤกษ์, วันหยุดบริษัท)
- ปุ่ม "นำเข้าวันหยุดราชการไทย" (ปีปัจจุบัน + ปีหน้า)
- เพิ่ม/แก้/ลบรายตัว

#### 2. หน้าใหม่ — `/day-off` "จัดการวันหยุดพนักงาน" (เมนูหลักใหม่)

**View 1: ปฏิทินรายเดือน (Monthly Grid)**
```text
                 จ.  อ.  พ.  พฤ.  ศ.  ส.  อา.
นาย A           ✓   ✓   ✓   ✓    ✓   ●   ●
นาย B           ●   ✓   ✓   ✓    ✓   ✓   ●
นาง C           ✓   ✓   ●   ✓    ✓   ✓   ✓   ← override
```
- คลิกเซลล์ไหนก็ toggle วันหยุดได้ทันที (เป็น override)
- สีต่างกัน: เขียว=ทำงาน, แดง=หยุดตาม pattern, ส้ม=หยุดเพิ่ม, น้ำเงิน=วันหยุดบริษัท
- ฟิลเตอร์: แผนก / ตำแหน่ง / สังกัด / ค้นหาชื่อ
- สลับมุมมอง: รายสัปดาห์ / รายเดือน

**View 2: รายพนักงาน (Employee Detail)**
- เลือกพนักงาน → เห็น pattern ปัจจุบัน + รายการ override ทั้งหมด + ปุ่มแก้
- ตั้ง pattern: เลือกวันในสัปดาห์ + ระบุช่วงผล (effective_from/to)
- เพิ่ม override: เลือกวัน + เหตุผล

**View 3: Bulk Actions**
- เลือกหลายคน → set pattern เดียวกัน
- เลือกหลายคน + เลือกวัน → ประกาศวันหยุดร่วม
- คัดลอก pattern จากคนหนึ่งไปอีกคน

#### 3. ส่วนเพิ่มในหน้าพนักงาน (`/employees/:id`)
- Section ใหม่ "วันหยุดประจำ" แสดง pattern ปัจจุบัน
- ลิงก์ไปหน้า `/day-off?employee={id}` เพื่อจัดการเต็มรูปแบบ

---

### การเชื่อมต่อกับระบบเดิม

| ระบบ | การเปลี่ยนแปลง |
|---|---|
| **Attendance** | trigger `sync_checkin_to_attendance` ปรับให้เช็ก dayoff ก่อน → ถ้าเป็นวันหยุด → status = `dayoff` (ไม่นับขาด) |
| **Leave** | ตอนเลือกวันลา ข้ามวันหยุดตาม pattern (ไม่หักโควต้า) |
| **Payroll** | คำนวณวันทำงานจริงโดยหักวันหยุดของแต่ละคน |
| **Shift Management** | แสดงวันหยุดของแต่ละคนทับกับกะ |
| **Reports** | เพิ่มคอลัมน์ "วันหยุด" + รายงานสรุปการหยุดรายเดือน |

---

### Helper Function (DB)

สร้าง `is_dayoff(employee_id, date)` returning boolean — ใช้ logic:
```text
1. ถ้ามีใน employee_dayoff_overrides → ใช้ค่านั้น (true/false ชัดเจน)
2. ถ้าวันนั้นอยู่ใน company_holidays → true
3. ถ้า weekday อยู่ใน effective pattern → true
4. else → false
```
ใช้ฟังก์ชันนี้ในทุก trigger/query ที่ต้องเช็ก

---

### Realtime
- เปิด realtime ที่ `employee_dayoff_overrides` → เมื่อหัวหน้าแก้ พนักงานเห็นทันที
- Badge "วันหยุดสัปดาห์นี้" ในหน้า Dashboard ของพนักงาน

---

### Permissions (เพิ่มใน `role_permissions`)
- module ใหม่: `day_off` 
- Admin/HR: ทุกสิทธิ์
- Manager: view + edit (เฉพาะคนในแผนก) — ใช้ scope
- Employee: view เฉพาะของตัวเอง

---

### ลำดับการทำ

1. Migration: 3 ตารางใหม่ + RLS + helper function `is_dayoff` + เพิ่ม module `day_off` ใน role_permissions
2. ปรับ trigger `sync_checkin_to_attendance` ให้เช็ก `is_dayoff`
3. สร้าง tab "วันหยุดบริษัท" ใน Settings + ปุ่มนำเข้าวันหยุดราชการ
4. สร้างหน้า `/day-off` พร้อม 3 views (Monthly Grid / Employee Detail / Bulk)
5. เพิ่มเมนู "จัดการวันหยุด" ใน Sidebar
6. เพิ่ม section "วันหยุดประจำ" ใน Employee Profile
7. ปรับ Payroll/Leave/Reports ให้รับรู้วันหยุดส่วนบุคคล
8. เปิด realtime + ทดสอบ end-to-end

