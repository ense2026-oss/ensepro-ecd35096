import { Calendar } from "lucide-react";
import StatCarousel from "@/components/ui/stat-carousel";

export interface LeaveType {
  id: string;
  name: string;
  quota: number;
  used: number;
  color: string;
  requireDoc: boolean;
  docRequiredMinDays?: number;
}

interface LeaveQuotaCardsProps {
  leaveTypes: LeaveType[];
}

const LeaveQuotaCards = ({ leaveTypes }: LeaveQuotaCardsProps) => {
  return (
    <StatCarousel className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {leaveTypes.map((lt) => {
        const remaining = lt.quota - lt.used;
        const pct = lt.quota > 0 ? Math.round((lt.used / lt.quota) * 100) : 0;
        return (
          <div
            key={lt.id}
            className="card-base p-2.5"
            style={{ borderLeft: `4px solid ${lt.color}` }}
          >
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs font-semibold">{lt.name}</span>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `color-mix(in srgb, ${lt.color} 15%, white)` }}
              >
                <Calendar className="w-4 h-4" style={{ color: lt.color }} />
              </div>
            </div>
            <p className="text-xl font-bold font-display leading-tight" style={{ color: lt.color }}>{remaining}</p>
            <p className="text-[11px] text-muted-foreground leading-tight">วันคงเหลือ จาก {lt.quota} วัน</p>
            <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: lt.color }} />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 leading-tight">ใช้ไปแล้ว {lt.used} วัน ({pct}%)</p>
          </div>
        );
      })}
    </StatCarousel>
  );
};

export default LeaveQuotaCards;
