# แผน: ทำให้ชั่วโมง OT แสดงในหน้า "บันทึกเวลา"

## ผลการตรวจสอบ (ยืนยันแล้ว)

1. **บันทึกลงฐานข้อมูลแล้ว** — OT ที่กดจากหน้าเช็คอินถูกเก็บใน `overtime_requests` จริง (status `pending`)
2. **มีผลต่อค่าตอบแทน OT เฉพาะเมื่ออนุมัติ** — หน้า Payroll ดึงเฉพาะ OT ที่ `status='approved'` มาคิดเงิน (ไม่แก้ส่วนนี้ตามที่ตกลง)
3. **ยังไม่แสดงในหน้าบันทึกเวลา** — คอลัมน์ "OT (ชม.)" อ่านจาก `attendance_records.ot_hours` ที่ถูกตั้งเป็น 0 เสมอ และค่าจาก `overtime_requests` ไม่เคยถูกรวมเข้าไป

## สิ่งที่จะแก้ (ตามคำตอบผู้ใช้)

- รวม OT **ทุกสถานะ** (pending + approved + rejected) เข้าหน้าบันทึกเวลา
- **ไม่แก้** เรตค่าตอบแทน OT ตอนนี้
- รวมข้อมูล **ฝั่งหน้าจอ** เท่านั้น — ไม่แตะ schema/trigger ฐานข้อมูล

## รายการแก้ไข (เฉพาะ `src/pages/Attendance.tsx`)

1. **ดึงข้อมูล OT เพิ่ม**
   - เพิ่มฟังก์ชัน `fetchOvertime()` ดึง `overtime_requests` (`employee_id, date, hours, status`)
   - สร้าง lookup รวมชั่วโมงต่อ `employee_id + date`:
     ```text
     otByKey[`${employee_id}|${date}`] += Number(hours) || 0
     ```
   - เก็บใน state `otMap`

2. **รวมค่าเข้าตารางบันทึกเวลา**
   - ตอน map ข้อมูล attendance (บรรทัด ~124) เปลี่ยน `ot` ให้ใช้ค่าจาก `otMap[employee_id|date]` แทนการอ่าน `r.ot_hours` ที่เป็น 0 เสมอ
   - คอลัมน์ "OT (ชม.)" และค่า `+{row.ot} ชม.` จะแสดงชั่วโมงจริงทันที

3. **Realtime อัปเดต**
   - เพิ่ม listener `postgres_changes` บนตาราง `overtime_requests` (ผ่าน debounce เดิม) เพื่อให้คอลัมน์ OT รีเฟรชเมื่อมีการบันทึก/อนุมัติ OT
   - เรียก `fetchOvertime()` ควบคู่ `fetchAttendance()` ใน effect เริ่มต้น

4. **คงเรื่องสิทธิ์เดิม**
   - OT map ถูกกรองผ่าน `scopedAttendance` ที่มีอยู่แล้ว (self/department/all) — พนักงานเห็นเฉพาะของตัวเอง ไม่ต้องแก้ logic สิทธิ์

## หมายเหตุทางเทคนิค

- รูปแบบวันที่: `overtime_requests.date` และ `attendance_records.date` เป็น Gregorian ตรงกัน (trigger normalize ให้แล้ว) — key รวมได้ตรง
- ไม่ต้องสร้าง migration / ไม่แตะ DB trigger
- ค่าตอบแทน OT ในหน้า Payroll ยังคงนับเฉพาะ approved เหมือนเดิม (ตามที่ผู้ใช้เลือก "ไม่ต้องแก้ตอนนี้")
