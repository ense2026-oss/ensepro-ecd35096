

## แผนเพิ่มระบบ Sub-Position (ตำแหน่งย่อย)

### สิ่งที่จะเปลี่ยน

#### 1. แก้ไข Type `Position` ใน `src/contexts/OrgContext.tsx`
- เพิ่ม field `children?: Position[]` เพื่อรองรับโครงสร้างแบบ tree
- อัปเดต demo data ให้มีตัวอย่าง sub-position (เช่น "วิศวกรระบบราง" มี sub เป็น "ช่างเทคนิคระบบราง")

#### 2. แก้ไข `PositionNode` ใน `src/pages/Organization.tsx`
- ปุ่ม **+** บน position node จะเปลี่ยนจาก "เพิ่มตำแหน่งในสังกัด" เป็น **"เพิ่ม sub-position ภายใต้ตำแหน่งนี้"**
- Render children ของแต่ละ position แบบ recursive พร้อมเยื้อง (indent) และเส้นเชื่อมเพิ่มขึ้นตาม level
- Drag & drop จะทำงานเฉพาะ sibling ในระดับเดียวกัน

#### 3. ปรับ Dialog เพิ่มตำแหน่ง
- เพิ่ม state `addParentPosId` เพื่อระบุว่ากำลังเพิ่ม sub ของ position ไหน
- แสดงชื่อ parent position ใน dialog เพื่อความชัดเจน
- ปุ่ม + ที่ root node ของสังกัด ยังคงเพิ่มตำแหน่งระดับบนสุด

#### 4. ปรับ handlers (Add/Edit/Delete)
- `handleAddSave` — ถ้ามี `parentPosId` จะ insert เข้า `children` ของ position นั้นแบบ recursive
- `handleDeleteConfirm` — ลบ position แบบ recursive (รวม children ทั้งหมด)
- `handleEditSave` — แก้ไขชื่อแบบ recursive find

### ไฟล์ที่แก้ไข
1. `src/contexts/OrgContext.tsx` — เพิ่ม `children` ใน Position type + demo data
2. `src/pages/Organization.tsx` — recursive render, ปรับ handlers, ปรับ dialog

### Technical Details
- ใช้ recursive component `PositionNode` ที่มีอยู่แล้ว โดยเพิ่มการ render `position.children` ด้านล่างของแต่ละ node
- Helper function `findAndUpdate(positions, targetId, updater)` สำหรับ recursive CRUD
- เส้นเชื่อมใช้ CSS border เดิม + indent เพิ่ม 32px ต่อ level

