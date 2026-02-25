import { Calendar } from "lucide-react";

export interface LeaveType {
  id: number;
  name: string;
  quota: number;
  used: number;
  color: string;
  requireDoc: boolean;
}

interface LeaveQuotaCardsProps {
  leaveTypes: LeaveType[];
}

const LeaveQuotaCards = ({ leaveTypes }: LeaveQuotaCardsProps) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {leaveTypes.map((lt) => {
        const remaining = lt.quota - lt.used;
        const pct = Math.round((lt.used / lt.quota) * 100);
        return (
          <div key={lt.id} className="card-base p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">{lt.name}</span>
              <Calendar className="w-4 h-4 text-muted-foreground" />
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
