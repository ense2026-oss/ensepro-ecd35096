

# แผนพัฒนาระบบจัดการสัญญาจ้าง (Contract Management)

## ภาพรวม

เพิ่มระบบจัดการสัญญาจ้างพนักงานที่มี workflow การลงนามแบบหลายขั้นตอน: HR สร้าง → พนักงานลงนาม → พยานลงนาม → ผู้บริหารลงนาม → HR รวมเอกสาร โดยมีระบบแจ้งเตือนทุกขั้นตอน

## Flow การทำงาน

```text
HR สร้างสัญญา → ส่งให้พนักงาน → พนักงานลงนาม → HR ตรวจสอบ
→ พยานคนที่ 1 ลงนาม → (พยานคนที่ 2 ลงนาม ถ้ามี)
→ ผู้บริหารลงนาม → HR ตรวจสอบ/รวมเอกสาร → เสร็จสิ้น
```

สถานะสัญญา: `draft` → `pending_employee` → `pending_hr_review` → `pending_witness_1` → `pending_witness_2` → `pending_executive` → `pending_final_review` → `completed`

## 1. Database (Lovable Cloud)

### ตาราง `contracts`
| คอลัมน์ | ชนิด | หมายเหตุ |
|---------|------|---------|
| id | uuid PK | |
| contract_number | text | เลขที่สัญญา |
| employee_id | text | รหัสพนักงาน |
| title | text | ชื่อสัญญา |
| contract_type | text | ประเภท (จ้างงาน/ทดลองงาน/ต่อสัญญา) |
| start_date, end_date | date | ระยะเวลา |
| salary | numeric | เงินเดือน |
| details | jsonb | รายละเอียดเพิ่มเติม |
| status | text | สถานะปัจจุบัน |
| witness_1_id, witness_2_id | text nullable | พยาน |
| executive_id | text | ผู้บริหาร |
| created_by | text | HR ผู้สร้าง |
| created_at, updated_at | timestamptz | |

### ตาราง `contract_signatures`
| คอลัมน์ | ชนิด | หมายเหตุ |
|---------|------|---------|
| id | uuid PK | |
| contract_id | uuid FK | |
| signer_id | text | ผู้ลงนาม |
| signer_role | text | employee/witness_1/witness_2/executive |
| signature_type | text | draw/upload |
| signature_data | text | base64 หรือ URL |
| signed_at | timestamptz | |

### ตาราง `contract_attachments`
| คอลัมน์ | ชนิด | หมายเหตุ |
|---------|------|---------|
| id | uuid PK | |
| contract_id | uuid FK | |
| file_name | text | |
| file_url | text | |
| file_type | text | |
| uploaded_by | text | |
| uploaded_at | timestamptz | |

### ตาราง `contract_notifications`
| คอลัมน์ | ชนิด | หมายเหตุ |
|---------|------|---------|
| id | uuid PK | |
| contract_id | uuid FK | |
| recipient_id | text | |
| message | text | |
| is_read | boolean default false | |
| created_at | timestamptz | |

**หมายเหตุ:** เนื่องจากระบบปัจจุบันใช้ mock data และ employee id เป็น text ไม่ได้ผูกกับ auth.users จึงใช้ text สำหรับ ID อ้างอิง เมื่อย้ายไป Supabase Auth จริงค่อยเปลี่ยนเป็น uuid FK

## 2. Settings: ตั้งค่าจำนวนพยาน

เพิ่มแท็บ **"สัญญาจ้าง"** ในหน้า `/settings` สำหรับ:
- กำหนดจำนวนพยาน (1 หรือ 2 คน)
- กำหนดผู้บริหารเริ่มต้นสำหรับลงนาม
- สร้างไฟล์ `src/components/settings/ContractSettings.tsx`

## 3. หน้า Contracts (`/contracts`)

### สิ่งที่ต้องสร้าง

| ไฟล์ | หน้าที่ |
|------|--------|
| `src/pages/Contracts.tsx` | หน้าหลัก: ตารางสัญญา + filter ตามสถานะ |
| `src/components/contracts/ContractFormDialog.tsx` | ฟอร์มสร้าง/แก้ไขสัญญา |
| `src/components/contracts/ContractDetailDialog.tsx` | ดูรายละเอียด + timeline สถานะ |
| `src/components/contracts/SignatureDialog.tsx` | ลงนาม: วาดลายเซ็น (canvas) หรืออัพโหลดไฟล์ |
| `src/components/contracts/ContractStatusBadge.tsx` | แสดงสถานะด้วยสี |
| `src/contexts/ContractContext.tsx` | จัดการ state + logic ทั้งหมด |

### การมองเห็นข้อมูล (Visibility)
- **HR**: เห็นทุกสัญญา สร้าง/แก้ไข/ส่งต่อ/รวมเอกสารได้
- **พนักงาน**: เห็นเฉพาะสัญญาของตนเอง ลงนามได้
- **พยาน/ผู้บริหาร**: เห็นเฉพาะสัญญาที่ต้องลงนาม

### ลายเซ็น
- **วาดลายเซ็น**: ใช้ HTML Canvas ให้วาดด้วยมือ/เมาส์ แปลงเป็น base64
- **อัพโหลด**: รับไฟล์ PNG/JPG ของลายเซ็น

### การรวมเอกสาร
- ใช้ `jspdf` (มีอยู่แล้ว) รวมสัญญา + เอกสารแนบเป็น PDF เดียว

## 4. การแจ้งเตือน

ต่อเข้ากับระบบแจ้งเตือนที่มีอยู่ใน `PendingCountsContext` และ `Notifications.tsx` เพิ่ม type `contract` สำหรับแจ้งเตือนเมื่อ:
- สัญญาถูกสร้างและส่งให้ลงนาม
- มีการลงนามแต่ละขั้นตอน
- สัญญาเสร็จสมบูรณ์

## 5. Navigation

- เพิ่มเมนู **"จัดการสัญญาจ้าง"** ใน Sidebar ต่อจาก "โครงสร้างองค์กร" (section "หลัก")
- ใช้ icon `FileSignature` จาก lucide-react
- เพิ่ม Route `/contracts` ใน `App.tsx`

## 6. ลำดับการพัฒนา

1. สร้าง ContractContext + mock data
2. สร้างหน้า Contracts.tsx + ตารางแสดงสัญญา
3. สร้าง ContractFormDialog (HR สร้างสัญญา)
4. สร้าง SignatureDialog (วาด + อัพโหลด)
5. สร้าง ContractDetailDialog + timeline
6. เพิ่ม ContractSettings ในหน้า Settings
7. เพิ่มระบบแจ้งเตือน
8. เพิ่มฟีเจอร์รวม PDF
9. เพิ่มเมนูใน Sidebar + Route

