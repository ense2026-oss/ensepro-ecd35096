# FaceScan ADMS Relay

ตัวรับ ADMS สาธารณะที่ส่งต่อ traffic จากเครื่องสแกนหน้า HIP CiF76S เข้าสู่ระบบ
(Edge Function `facescan-adms`) — รันบนบริการฟรี ไม่ต้องมี PC ใน LAN และไม่ต้องเปิดพอร์ตเราเตอร์

## ทำไมต้องมี relay
เครื่อง ADMS ส่งข้อมูลไปที่ path ตายตัว `/iclock/cdata`, `/iclock/getrequest`,
`/iclock/devicecmd` ตั้งได้แค่ "โดเมน + พอร์ต" ส่วน Edge Function อยู่ใต้
`/functions/v1/...` เครื่องจึงยิงตรงไม่ได้ relay นี้เปิด `/iclock/*` แล้ว forward ให้

## วิธี Deploy (Deno Deploy — แนะนำ ฟรี)
1. เข้า https://dash.deno.com → **New Project** → **Deploy from playground**
2. วางเนื้อหาไฟล์ `main.ts` ทั้งหมด → กด **Save & Deploy**
3. จะได้ URL สาธารณะ เช่น `https://your-name.deno.dev`
4. ทดสอบ: เปิด `https://your-name.deno.dev/health` ควรเห็นข้อความ `FaceScan ADMS relay OK`

## วิธี Deploy (Cloudflare Worker — ทางเลือก)
ใช้ไฟล์ `worker.js` สร้าง Worker ใหม่ที่ https://workers.cloudflare.com แล้ววางโค้ด

## ตั้งค่าที่ตัวเครื่อง HIP CiF76S
เมนู **Comm / Communication → Cloud Server Setting (ADMS)**
- **Server Address / Domain** = โดเมน relay (เช่น `your-name.deno.dev`) — ไม่ต้องใส่ `https://` หรือ `/iclock`
- **Server Port** = `443`
- **Enable HTTPS / Use HTTPS** = `ON`
- **Enable Domain Name** = `ON`
- บันทึก แล้ว **Reboot** เครื่อง

จากนั้นใส่ **Serial Number (SN)** ของเครื่องในหน้า ตั้งค่า → เครื่องสแกน ของระบบ
ให้ตรงกับ SN จริง แล้วลองสแกน — record จะเข้าหน้าลงเวลาภายในไม่กี่วินาที
