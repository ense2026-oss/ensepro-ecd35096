import { useState } from "react";
import { CheckCircle, XCircle, FileText, Pencil, Trash2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import EmployeeAvatar from "@/components/ui/employee-avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";

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
  const [detail, setDetail] = useState<LeaveRecord | null>(null);

  const handleViewFile = async (fileUrl: string) => {
    if (!fileUrl) return;
    const { data } = await supabase.storage.from("leave-attachments").createSignedUrl(fileUrl, 300);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  };

  return (
    <div className="card-base overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full md:min-w-[900px]" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr className="border-b" style={{ borderColor: "hsl(var(--border))" }}>
              {[
                { label: "พนักงาน", width: "w-[140px]" },
                { label: "ประเภท", width: "w-[110px]" },
                { label: "วันที่", width: "hidden md:table-cell w-[140px]" },
                { label: "จำนวนวัน", width: "hidden md:table-cell w-[70px]" },
                { label: "เหตุผล", width: "hidden md:table-cell w-[160px]" },
                { label: "เอกสาร", width: "hidden md:table-cell w-[60px]" },
                { label: "สถานะ", width: "hidden md:table-cell w-[120px]" },
                { label: "จัดการ", width: "w-[110px]" },
              ].map((h) => (
                <th key={h.label} className={`text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap ${h.width}`}>
                  {h.label}
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
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <EmployeeAvatar
                        photoUrl={row.photoUrl}
                        firstName={row.name}
                        size="sm"
                        rounded="lg"
                      />
                      <span className="text-sm font-semibold truncate" title={row.name}>{row.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-sm truncate" title={row.type}>{row.type}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{row.from} – {row.to}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-sm font-bold" style={{ color: "#FF870F" }}>{row.days}</span>
                    <span className="text-xs text-muted-foreground"> วัน</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground truncate" title={row.reason}>{row.reason || "-"}</td>
                  <td className="px-3 py-2.5">
                    {row.file && row.fileUrl ? (
                      <button
                        onClick={() => handleViewFile(row.fileUrl!)}
                        className="flex items-center justify-center gap-1 text-xs font-medium hover:underline w-full"
                        style={{ color: "#FF870F" }}
                        title="ดูไฟล์"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                    ) : row.file ? (
                      <span className="flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground w-full" title="มีไฟล์">
                        <FileText className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground w-full text-center block">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: conf.bg, color: conf.color }}>
                      {conf.label}
                    </span>
                    {row.status === "pending" && (row.totalTiers || 1) > 1 && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({row.approvedTiers || 0}/{row.totalTiers})
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-0.5">
                      <button onClick={() => setDetail(row)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground" title="ดูรายละเอียด">
                        <Eye className="w-4 h-4" />
                      </button>
                      {hasPending && row.status === "pending" && !hideActions && (
                        <>
                          <button onClick={() => onApprove(row.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" style={{ color: "hsl(90 100% 30%)" }} title="อนุมัติ">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button onClick={() => onReject(row.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-destructive" title="ไม่อนุมัติ">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!detail} onOpenChange={(v) => { if (!v) setDetail(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold pb-[10px]">
              <FileText className="w-5 h-5 text-primary" />
              รายละเอียดคำขอลา
            </DialogTitle>
            <DialogDescription className="sr-only">รายละเอียดคำขอลางาน</DialogDescription>
          </DialogHeader>
          {detail && (() => {
            const c = statusConf[detail.status] || statusConf.pending;
            return (
              <DialogBody className="space-y-4">
                <div className="flex items-center gap-3">
                  <EmployeeAvatar photoUrl={detail.photoUrl} firstName={detail.name} size="md" rounded="lg" />
                  <div>
                    <p className="text-sm font-semibold">{detail.name}</p>
                    {detail.dept && <p className="text-xs text-muted-foreground">{detail.dept}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-muted-foreground">ประเภทการลา</p><p className="text-sm font-semibold mt-0.5">{detail.type}</p></div>
                  <div><p className="text-xs text-muted-foreground">จำนวนวัน</p><p className="text-sm font-bold mt-0.5" style={{ color: "#FF870F" }}>{detail.days} วัน</p></div>
                </div>
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-muted/40">
                  <div><p className="text-xs text-muted-foreground mb-1">วันที่เริ่ม</p><p className="text-sm font-semibold">{detail.from}</p></div>
                  <div><p className="text-xs text-muted-foreground mb-1">วันที่สิ้นสุด</p><p className="text-sm font-semibold">{detail.to}</p></div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">เหตุผล</p>
                  <p className="text-sm p-3 rounded-xl bg-muted/40 whitespace-pre-wrap">{detail.reason || "-"}</p>
                </div>
                {detail.file && detail.fileUrl && (
                  <button
                    onClick={() => handleViewFile(detail.fileUrl!)}
                    className="flex items-center gap-1.5 text-sm font-medium hover:underline"
                    style={{ color: "#FF870F" }}
                  >
                    <FileText className="w-4 h-4" /> ดูเอกสารแนบ
                  </button>
                )}
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">สถานะ:</p>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: c.bg, color: c.color }}>
                    {c.label}
                  </span>
                  {detail.status === "pending" && (detail.totalTiers || 1) > 1 && (
                    <span className="text-xs text-muted-foreground">({detail.approvedTiers || 0}/{detail.totalTiers})</span>
                  )}
                </div>
              </DialogBody>
            );
          })()}
          <DialogFooter>
            {detail?.status === "pending" && !hideActions ? (
              <>
                <button onClick={() => { if (detail) onReject(detail.id); setDetail(null); }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background: "hsl(0 84% 50%)" }}>
                  <XCircle className="w-4 h-4" /> ไม่อนุมัติ
                </button>
                <button onClick={() => { if (detail) onApprove(detail.id); setDetail(null); }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background: "hsl(90 100% 30%)" }}>
                  <CheckCircle className="w-4 h-4" /> อนุมัติ
                </button>
              </>
            ) : (
              <button onClick={() => setDetail(null)} className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">ปิด</button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeaveTable;
