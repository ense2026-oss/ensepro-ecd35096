## เป้าหมาย
ในหน้า `/dashboard` เฉพาะมุมมองมือถือ (< 768px) ให้แสดงการ์ดสถิติ (StatCard widgets) เป็น **carousel แบบลากซ้าย-ขวาด้วยนิ้ว** แทน grid 2 คอลัมน์ปัจจุบัน บนเดสก์ท็อป/แท็บเล็ตคงเป็น grid เหมือนเดิม

## ขอบเขต (เฉพาะ frontend)
ไฟล์เดียว: `src/pages/Dashboard.tsx`

มีกลุ่มการ์ดสถิติ 3 จุดที่จะถูกแปลงเป็น carousel บนมือถือ:
1. มุมมอง Employee — leave quota + OT card (บรรทัด ~456-461)
2. มุมมอง Admin/HR/Manager แถวที่ 1 — พนักงาน/มาทำงาน/ลา/มาสาย (บรรทัด ~520-525)
3. มุมมอง Admin/HR/Manager แถวที่ 2 — OT/รออนุมัติ/อนุมัติแล้ว/พนักงานใหม่ (บรรทัด ~527-532)

ส่วนอื่น (กราฟ, recent activity, dept status) ไม่เปลี่ยน

## วิธีการ
ใช้ shadcn `Carousel` component (`src/components/ui/carousel.tsx`) ซึ่งมาพร้อม embla-carousel-react อยู่แล้ว — รองรับ touch swipe ลื่นไหลในตัว

สร้าง wrapper component ภายในไฟล์:

```tsx
const StatCarousel = ({ children }: { children: React.ReactNode }) => {
  const isMobile = useIsMobile();
  if (!isMobile) {
    return <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{children}</div>;
  }
  return (
    <Carousel opts={{ align: "start", dragFree: true }} className="-mx-4 px-4">
      <CarouselContent className="-ml-3">
        {React.Children.map(children, (child, i) => (
          <CarouselItem key={i} className="pl-3 basis-[70%]">
            {child}
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
};
```

จากนั้นแทน `<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">…</div>` ทั้ง 3 จุดด้วย `<StatCarousel>…</StatCarousel>`

## รายละเอียดเชิงเทคนิค
- `basis-[70%]` ทำให้เห็นการ์ดถัดไปโผล่เป็น peek ~30% บอกใบ้ว่าลากต่อได้
- `dragFree: true` ให้ลากอิสระเหมือน native scroll ไม่ snap แข็ง
- ใช้ `useIsMobile()` (มีอยู่แล้วใน `src/hooks/use-mobile.tsx`, breakpoint 768px) ตัดสินใจ render
- ไม่ต้องโชว์ปุ่ม Prev/Next (เพราะมือถือใช้ลากนิ้วอย่างเดียว)
- ไม่กระทบ desktop layout, ไม่กระทบ data fetching, ไม่กระทบ logic อื่น
