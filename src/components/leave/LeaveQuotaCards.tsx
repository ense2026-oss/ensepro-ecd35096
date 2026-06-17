import { Calendar } from "lucide-react";

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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {leaveTypes.map((lt) => {
        const remaining = lt.quota - lt.used;
        const pct = lt.quota > 0 ? Math.round((lt.used / lt.quota) * 100) : 0;
        return (
          <div
            key={lt.id}
            className="card-base p-4"
            style={{ borderLeft: `4px solid ${lt.color}` }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">{lt.name}</span>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `color-mix(in srgb, ${lt.color} 15%, white)` }}
              >
                <Calendar className="w-5 h-5" style={{ color: lt.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold font-display" style={{ color: lt.color }}>{remaining}</p>
            <p className="text-xs text-muted-foreground mt-0.5">วันคงเหลือ จาก {lt.quota} วัน</p>
            <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: lt.color }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">ใช้ไปแล้ว {lt.used} วัน ({pct}%)</p>
          </div>
        );
      })}
    </div>
  );
};

export default LeaveQuotaCards;
