# แก้ปัญหาเครื่องสแกนหน้า (FaceScan) ยังซิงค์ไม่ติด

## สาเหตุที่ตรวจพบ
- Edge Function `facescan-adms` ทำงานปกติ (ทดสอบ ping ได้ `OK`)
- แต่ **ไม่เคยมีข้อมูลจากเครื่องสแกนส่งเข้ามาเลย** — ทั้ง 2 เครื่อง (Furnace, Station) มีค่า `เห็นล่าสุด = —`
- ต้นเหตุอยู่ "ก่อนถึง" backend 2 จุด:
  1. **ยังไม่ได้ deploy ตัว Relay จริง** — URL ที่กรอกเป็น URL ของ Edge Function โดยตรง ซึ่งเครื่อง HIP ใช้ไม่ได้ เพราะเครื่องยิงไป path ตายตัว `/iclock/*` เสมอ ขณะที่ Edge Function อยู่ใต้ `/functions/v1/...` จึงต้องมี relay มาคั่นเพื่อ forward
  2. **ยังไม่ได้ตั้งค่าตัวเครื่องสแกน** — เครื่องจึงไม่ได้ส่งข้อมูลไปที่ใดเลย

```text
[HIP CiF76S]  --push /iclock/*-->  [Relay (Deno)]  --forward-->  [facescan-adms]  -->  ตารางลงเวลา
   (ต้องตั้งค่า)                      (ต้อง deploy)                 (พร้อมแล้ว)
```

## ส่วนที่ 1 — ปรับโค้ดเพื่อช่วยวินิจฉัย (ผมทำให้)
ปัจจุบันถ้าเครื่องส่งเข้ามาแต่ SN ไม่ตรง ระบบจะเงียบ (ตอบ OK เฉย ๆ) ทำให้แยกไม่ออกว่า "เครื่องยังไม่ส่ง" หรือ "ส่งแล้วแต่ SN ผิด" จะปรับดังนี้:

1. **`supabase/functions/facescan-adms/index.ts`**
   - เมื่อมี request เข้ามาแต่ SN ไม่ตรง/เครื่องถูกปิด ให้บันทึกลง `face_scan_sync_logs` (เก็บ SN, action, path) แทนที่จะเงียบ — เพื่อให้เห็นหลักฐานในแท็บ Sync Logs ทันทีที่เครื่องเชื่อมเข้ามา
   - log ตอน handshake (`GET /cdata`) ด้วย เพื่อยืนยันว่าเครื่องคุยกับเราได้

2. **`src/components/settings/FaceScanConnectionSettings.tsx`** (แท็บ ADMS Push)
   - แก้ข้อความให้ชัดว่า URL ที่โชว์เป็น "ปลายทางที่ relay forward มา" **ไม่ใช่** ค่าที่กรอกในเครื่อง
   - เพิ่มกล่องสรุปขั้นตอนตั้งค่าเครื่อง + ช่องระบุโดเมน relay ของผู้ใช้ เพื่อกันความสับสน

> ส่วนนี้เป็นโค้ดล้วน deploy อัตโนมัติ ไม่ต้องตั้งค่าอะไรเพิ่ม

## ส่วนที่ 2 — ขั้นตอนที่ต้องทำเอง (ผมทำแทนไม่ได้)
1. **Deploy relay** บน Deno org `ense2026-oss` ที่มีอยู่แล้ว: dash.deno.com → New Playground → วางโค้ด relay (คัดลอกจากแท็บ "ADMS Push") → Save & Deploy → จะได้โดเมน เช่น `https://xxxx.deno.dev`
2. **ทดสอบ relay**: เปิด `https://<relay>.deno.dev/health` ต้องเห็นข้อความ `FaceScan ADMS relay OK`
3. **ตั้งค่าเครื่องสแกน** (Comm → Cloud Server Setting / ADMS):
   - Server Address = โดเมน relay (เช่น `xxxx.deno.dev` ไม่ต้องมี https:// และไม่ต้องมี /iclock)
   - Port = `443`, HTTPS = ON, Enable Domain Name = ON
   - บันทึก แล้ว **Reboot** เครื่อง
4. **ตรวจ SN ให้ตรง**: ในฐานข้อมูลมี `C2637C580F253D37` (Furnace) และ `C2637C580F223937` (Station) — ต้องตรงกับ SN จริงบนเครื่องเป๊ะ
5. ลองสแกน 1 ครั้ง → เปิดแท็บ **Sync Logs** จะเห็น record เข้ามาภายในไม่กี่วินาที และสถานะเครื่องเปลี่ยนเป็น "ออนไลน์ (ADMS)"

## ผลลัพธ์ที่คาดหวัง
- เมื่อ deploy relay + ตั้งค่าเครื่องเสร็จ ข้อมูลการสแกนจะไหลเข้าตารางลงเวลาอัตโนมัติ
- หาก SN ยังไม่ตรง จะเห็น log แจ้งเตือนในแอป (จากส่วนที่ 1) ทำให้แก้ได้ทันทีโดยไม่ต้องเดา

## รายละเอียดทางเทคนิค
- ทำไมต้องมี relay: firmware HIP/ZKTeco ส่งไป path `/iclock/cdata|getrequest|devicecmd` แบบ hardcode เปลี่ยนไม่ได้ จึงต้องมี relay รับ `/iclock/*` แล้ว forward ไป `/functions/v1/facescan-adms/<action>` พร้อม query string (`?SN=...&table=ATTLOG`)
- การยืนยันตัวตนใช้ SN จับคู่กับแถวใน `face_scan_devices` ที่ `enabled = true` และ `connection_mode = 'adms'`
