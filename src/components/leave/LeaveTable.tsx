import { CheckCircle, XCircle, FileText, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import EmployeeAvatar from "@/components/ui/employee-avatar";

export interface LeaveRecord {
  id: string;
  employeeId?: string;
  name: string;
  photoUrl?: string;
  dept?: string;
  type: string;
  from: string;
  to: string;
  days: number;
  reason: string;
  status: string;
  file: boolean;
  fileUrl?: string;
  currentTier?: number;
  approvedTiers?: number;
  totalTiers?: number;
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
  currentEmployeeId?: string;
  onEdit?: (record: LeaveRecord) => void;
  onDelete?: (id: string) => void;
}

const LeaveTable = ({ records, onApprove, onReject, hideActions = false, currentEmployeeId, onEdit, onDelete }: LeaveTableProps) => {
  const hasPending = !hideActions && records.some((r) => r.status === "pending");
  const hasOwnActions = !!currentEmployeeId && (!!onEdit || !!onDelete);

  const handleViewFile = async (fileUrl: string) => {
    if (!fileUrl) return;
    const { data } = await supabase.storage.from("leave-attachments").createSignedUrl(fileUrl, 300);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  };

  const showActionsCol = hasPending || hasOwnActions;

  return (
    <div className="card-base overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: "hsl(var(--border))" }}>
              {["พนักงาน", "ประเภท", "วันที่", "จำนวนวัน", "เหตุผล", "เอกสาร", "สถานะ", ...(showActionsCol ? ["จัดการ"] : [])].map((h) => (
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
              const isOwnPending = row.employeeId === currentEmployeeId && row.status === "pending";
              return (
                <tr key={row.id} className="border-b hover:bg-muted/30 transition-colors" style={{ borderColor: "hsl(var(--border))" }}>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <EmployeeAvatar
                        photoUrl={row.photoUrl}
                        firstName={row.name}
                        size="sm"
                        rounded="lg"
                      />
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
                    {row.file && row.fileUrl ? (
                      <button
                        onClick={() => handleViewFile(row.fileUrl!)}
                        className="flex items-center gap-1 text-xs font-medium hover:underline"
                        style={{ color: "#FF870F" }}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        ดูไฟล์
                      </button>
                    ) : row.file ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <FileText className="w-3.5 h-3.5" />
                        มีไฟล์
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: conf.bg, color: conf.color }}>
                      {conf.label}
                    </span>
                    {row.status === "pending" && (row.totalTiers || 1) > 1 && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        ({row.approvedTiers || 0}/{row.totalTiers})
                      </span>
                    )}
                  </td>
                  {showActionsCol && (
                    <td className="px-4 py-3.5">
                      <div className="flex gap-1">
                        {/* Approve/Reject for managers */}
                        {hasPending && row.status === "pending" && !hideActions && (
                          <>
                            <button onClick={() => onApprove(row.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" style={{ color: "hsl(90 100% 30%)" }}>
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button onClick={() => onReject(row.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-destructive">
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {/* Edit/Delete for own pending */}
                        {isOwnPending && onEdit && (
                          <button onClick={() => onEdit(row)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-primary" title="แก้ไข">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {isOwnPending && onDelete && (
                          <button onClick={() => onDelete(row.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-destructive" title="ลบ">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
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
