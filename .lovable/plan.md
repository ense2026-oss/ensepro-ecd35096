

## ผลการตรวจสอบ: ระบบยังไม่มีฟังก์ชัน Compress/Optimize ไฟล์

จากการตรวจสอบโค้ดทั้งหมด พบว่า:

- **ไม่มี** การบีบอัดรูปภาพ (image compression/resize) ก่อนอัปโหลด — ทุกจุดใช้ `FileReader.readAsDataURL()` แล้วเก็บเป็น base64 ขนาดเต็ม
- **ไม่มี** การสร้าง thumbnail สำหรับแสดงผลเร็ว
- **ไม่มี** การบีบอัด PDF หรือลดขนาดเอกสารแนบ

### จุดที่ได้รับผลกระทบ (6 จุด)
1. **รูปโปรไฟล์พนักงาน** — EmployeeFormDialog, EmployeeProfile
2. **โลโก้บริษัท** — CompanySettings (2 จุด)
3. **ลายเซ็น** — SignatureDialog (อัปโหลดรูปลายเซ็น)
4. **เอกสารแนบสัญญา** — ContractDetail, ContractDetailDialog

### แผนที่จะทำ

#### 1. สร้าง utility `src/utils/fileCompression.ts`
- **`compressImage(file, options)`** — ใช้ Canvas API resize รูปภาพ + ปรับ quality (JPEG 0.7-0.8) ให้ได้ขนาดไม่เกิน maxWidth/maxHeight ที่กำหนด แล้ว return เป็น base64
- **`createThumbnail(file, size)`** — สร้าง thumbnail ขนาดเล็ก (เช่น 150x150) สำหรับแสดงผลในรายการ
- **`compressPDF(file)`** — สำหรับ PDF ขอบเขตที่ทำได้ฝั่ง client คือจำกัดขนาดไฟล์ที่รับ (เช่น ≤5MB) และแสดง warning ถ้าไฟล์ใหญ่เกินไป เนื่องจากการ compress PDF จริงจัง ต้องใช้ backend — จะเพิ่ม validation ขนาดไฟล์ก่อน
- ใช้ Canvas API ล้วน ไม่ต้องติดตั้ง library เพิ่ม

#### 2. ปรับจุดอัปโหลดทั้ง 6 จุด
เรียก `compressImage()` ก่อน `readAsDataURL` ทุกจุดที่รับรูปภาพ พร้อมตั้ง max size ที่เหมาะสม:
- รูปโปรไฟล์: max 400x400, quality 0.8
- โลโก้: max 300x300, quality 0.8
- ลายเซ็น: max 440x200, quality 0.9
- เอกสารแนบ (รูป): max 1200px, quality 0.7

#### 3. เพิ่ม file size validation
- รูปภาพ: จำกัด ≤5MB ก่อน compress
- PDF: จำกัด ≤10MB พร้อมแสดง warning
- แสดง toast error ถ้าไฟล์เกินขนาด

