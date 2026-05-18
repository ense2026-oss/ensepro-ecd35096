## ปัญหาปัจจุบัน

1. หน้า `/payroll` คำนวณสลิปแบบ on-the-fly จาก `employees.salary` + attendance ของเดือนที่เลือก → เลือกเดือนไหนก็เห็นตัวเลขเดียวกัน เพราะไม่มี snapshot รายเดือน
2. ไม่มีตาราง payslip ใน DB → ไม่มีประวัติ, แก้เงินเดือนวันนี้กระทบสลิปย้อนหลังทั้งหมด
3. ไม่มีปุ่ม "ออกสลิป / เผยแพร่ให้พนักงาน" (publish workflow)
4. พนักงานไม่มีหน้าดูสลิปของตัวเอง (icon ถูกซ่อนเฉพาะ accountant)
5. ไม่มี RLS ที่ผูกสลิปกับพนักงานรายคน

## เป้าหมาย

ระบบ Payslip ครบวงจร:
- Accountant คำนวณ → บันทึก snapshot รายเดือน → กดเผยแพร่ → พนักงานได้รับแจ้งเตือนและดาวน์โหลด PDF ของตัวเองได้

## โครงสร้างที่จะสร้าง

### 1. ตารางใหม่ใน DB

**`payroll_periods`** (รอบเงินเดือนรายเดือน)
- `year`, `month` (unique together)
- `status`: `draft` | `published`
- `published_at`, `published_by`
- `note`

**`payslips`** (สลิปต่อพนักงานต่อเดือน — snapshot ที่ freeze ไว้)
- `period_id` → payroll_periods
- `employee_id`
- snapshot ทุกตัวเลข: `base_salary`, `ot_pay`, `ot_hours`, `diligence`, `gross_pay`, `ssf`, `tax`, `total_deduct`, `net_pay`
- `attendance` (jsonb: workDays / lateDays / absentDays / leaveDays)
- `custom_items` (jsonb: รายการ income/deduction พิเศษพร้อมยอด)
- `tax_breakdown` (jsonb: annualIncome, deductions ฯลฯ สำหรับโชว์ในสลิป)
- unique (`period_id`, `employee_id`)

**RLS**:
- Accountant / Admin / HR: จัดการได้ทุกอย่าง
- Employee: SELECT ได้เฉพาะ `payslips` ของตัวเอง **และเฉพาะ period ที่ status = 'published'** เท่านั้น
- ใช้ security definer function `is_payslip_visible(period_id)` เพื่อเช็ค status โดยไม่ recursion

### 2. หน้า `/payroll` (Accountant/Admin/HR)

เพิ่มแถบสถานะรอบเดือน:
- ถ้ายังไม่มีแถวใน `payroll_periods` ของเดือนที่เลือก → ปุ่ม **"คำนวณและบันทึกสลิปเดือนนี้"** (สร้าง period draft + insert payslips ทุกคนจาก calcPayroll ปัจจุบัน)
- ถ้าเป็น draft → ตารางอ่านจาก `payslips` (snapshot), ปุ่ม **"คำนวณใหม่"** + ปุ่ม **"เผยแพร่ให้พนักงาน"**
- ถ้า published → ตารางอ่านจาก snapshot อย่างเดียว, badge "เผยแพร่แล้ว", ปุ่ม **"ยกเลิกการเผยแพร่"** (กลับเป็น draft) สำหรับ admin
- เมื่อเลือกเดือนที่ยังไม่มี snapshot → แสดง "ยังไม่ได้คำนวณ" แทนตัวเลขปัจจุบัน

ตอนเผยแพร่:
- update period.status = 'published'
- insert `app_notifications` ให้พนักงานทุกคนที่มีสลิปในรอบนั้น ("สลิปเงินเดือนเดือน X พร้อมให้ดาวน์โหลดแล้ว")

### 3. หน้าใหม่ `/my-payslips` (สำหรับพนักงานทุก role)

- เปิด icon "สลิปเงินเดือนของฉัน" ใน sidebar/mobile nav ให้ทุก role (employee/hr/manager/executive/admin/accountant)
- รายการสลิปของตัวเองเรียงตามเดือน (เฉพาะ published)
- กดดูรายละเอียด → reuse `PayslipDialog` เดิม แต่ป้อนข้อมูลจาก snapshot
- ปุ่มดาวน์โหลด PDF (เรียก `exportPayslipPdf` ด้วยข้อมูล snapshot + เดือน/ปี)

### 4. ปรับ exportPayslipPdf

รับ snapshot โดยตรงแทนการคำนวณจาก employee.salary ปัจจุบัน เพื่อให้ PDF ตรงกับสลิปที่ถูก freeze

## รายละเอียดทางเทคนิค

- Migration: สร้าง 2 ตาราง + RLS + function `is_payslip_published(period_id)` (security definer)
- หน้า Payroll: เพิ่ม hook `usePayrollPeriod(year, month)` → คืน `{ period, payslips, status, refetch }`
- การคำนวณ: เก็บ `calcPayroll` เดิมไว้สำหรับสร้าง snapshot, ไม่ใช้สำหรับแสดงผลโดยตรงอีกต่อไป
- Realtime: subscribe `payroll_periods` เพื่อให้พนักงานเห็นสลิปทันทีหลังเผยแพร่
- เมนู: เพิ่ม `/my-payslips` ใน Sidebar + MobileFooterNav, แสดงสำหรับทุก role

## ขอบเขตงาน (เรียงลำดับ)

1. Migration: `payroll_periods`, `payslips`, RLS, helper function
2. ปรับ `Payroll.tsx`: โหลด snapshot, ปุ่มคำนวณ/เผยแพร่/ยกเลิก
3. ปรับ `exportPayslipPdf` ให้รับ snapshot
4. สร้าง `MyPayslips.tsx` + route + เมนู
5. แจ้งเตือนพนักงานตอน publish
