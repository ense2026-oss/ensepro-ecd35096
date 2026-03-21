

## แก้ไข: Console Errors + Dashboard โหลดไม่ได้

### สาเหตุหลัก

จากภาพ console มี 3 ปัญหาที่เชื่อมโยงกัน:

1. **WebSocket connection failed × 20+ ครั้ง → "Max reconnect attempts exceeded"**
   - Contexts ทั้งหมด (PendingCounts, TimeEdit, Dashboard) สร้าง Realtime channel ทันทีที่ app โหลด แม้ยังไม่ login
   - Channel ต้องการ authenticated session → ไม่มี token → WebSocket fail → reconnect วนซ้ำ 20 ครั้ง

2. **406 Error บน company_settings** 
   - BrandingProvider อยู่นอก AuthProvider → query ก่อนมี session
   - Migration ที่เพิ่ม anon policy อาจยังไม่ apply หรือมีปัญหา — ต้องตรวจสอบ

3. **"Throttling navigation to prevent browser from hanging"**
   - เป็นผลพวงจาก error ข้างต้นที่ทำให้ auth state ไม่เสถียร → redirect loop

### แผนแก้ไข

#### 1. ย้าย Providers ที่ต้องการ auth ไปอยู่ใน ProtectedRoute (`src/App.tsx`)
- ย้าย OrgProvider, EmployeeProvider, PendingCountsProvider, ContractProvider, TimeEditProvider **ออกจาก** root level
- ไปอยู่ **ภายใน** ProtectedRoute เพื่อไม่ให้ทำงานตอนอยู่หน้า login
- คงเฉพาะ BrandingProvider + AuthProvider ไว้ที่ root

```
BrowserRouter
  └── BrandingProvider
    └── AuthProvider
      └── Routes
        ├── /login → LoginRoute
        └── ProtectedRoute
          └── OrgProvider
            └── EmployeeProvider
              └── PendingCountsProvider
                └── ContractProvider
                  └── TimeEditProvider
                    └── MainLayout + Routes
```

#### 2. แก้ BrandingProvider ให้ handle error gracefully (`src/contexts/BrandingContext.tsx`)
- เพิ่ม try-catch รอบ query company_settings
- ถ้า error ใช้ defaults แทน (ไม่ crash)

#### 3. Guard realtime channels ใน Dashboard (`src/pages/Dashboard.tsx`)
- ตรวจสอบว่า `user` มีค่าก่อนสร้าง channel
- ถ้าไม่มี user ไม่ต้อง subscribe

### ไฟล์ที่แก้ไข
1. `src/App.tsx` — ย้าย Providers เข้าไปใน ProtectedRoute
2. `src/contexts/BrandingContext.tsx` — เพิ่ม error handling
3. `src/pages/Dashboard.tsx` — guard realtime subscription ด้วย user check

