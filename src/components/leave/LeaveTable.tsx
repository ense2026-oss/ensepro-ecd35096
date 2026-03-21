import { CheckCircle, XCircle, FileText } from "lucide-react";

export interface LeaveRecord {
  id: string;
  name: string;
  type: string;
  from: string;
  to: string;
  days: number;
  reason: string;
  status: string;
  file: boolean;
}

const statusConf: Record<string, { label: string; color: string; bg: string }> = {
  approved: { label: "อนุมัติแล้ว", color: "hsl(90 100% 30%)", bg: "hsl(90 100% 92%)" },
  pending: { label: "รออนุมัติ", color: "#FF870F", bg: "hsl(31 100% 93%)" },
  rejected: { label: "ไม่อนุมัติ", color: "hsl(0 84% 50%)", bg: "hsl(0 84% 95%)" },
};

interface LeaveTableProps {
  records: LeaveRecord[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  hideActions?: boolean;
}

const LeaveTable = ({ records, onApprove, onReject, hideActions = false }: LeaveTableProps) => {
  const hasPending = !hideActions && records.some((r) => r.status === "pending");

  return (
    <div className="card-base overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: "hsl(var(--border))" }}>
              {["พนักงาน", "ประเภท", "วันที่", "จำนวนวัน", "เหตุผล", "เอกสาร", "สถานะ", ...(hasPending ? ["จัดการ"] : [])].map((h) => (
                <th key={h} className="text-left px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-sm text-muted-foreground">ไม่พบข้อมูล</td>
              </tr>
            )}
            {records.map((row) => {
              const conf = statusConf[row.status] || statusConf.pending;
              return (
                <tr key={row.id} className="border-b hover:bg-muted/30 transition-colors" style={{ borderColor: "hsl(var(--border))" }}>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: "hsl(31 100% 93%)", color: "#FF870F" }}>
                        {row.name.charAt(0)}
                      </div>
                      <span className="text-sm font-semibold">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm">{row.type}</td>
                  <td className="px-4 py-3.5 text-sm text-muted-foreground whitespace-nowrap">{row.from} – {row.to}</td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm font-bold" style={{ color: "#FF870F" }}>{row.days}</span>
                    <span className="text-sm text-muted-foreground"> วัน</span>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-muted-foreground max-w-32 truncate">{row.reason}</td>
                  <td className="px-4 py-3.5">
                    {row.file ? (
                      <button className="flex items-center gap-1 text-xs font-medium" style={{ color: "#FF870F" }}>
                        <FileText className="w-3.5 h-3.5" />
                        ดูไฟล์
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: conf.bg, color: conf.color }}>
                      {conf.label}
                    </span>
                  </td>
                  {hasPending && (
                    <td className="px-4 py-3.5">
                      {row.status === "pending" && (
                        <div className="flex gap-1">
                          <button onClick={() => onApprove(row.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" style={{ color: "hsl(90 100% 30%)" }}>
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button onClick={() => onReject(row.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-destructive">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LeaveTable;
