import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployees } from "@/contexts/EmployeeContext";
import { Receipt, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatCurrency } from "@/utils/taxCalculation";
import { exportPayslipPdfFromSnapshot } from "@/utils/exportPayroll";
import type { PayslipRow } from "@/hooks/usePayrollPeriod";
import { toast } from "sonner";

const THAI_MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

interface PeriodInfo { id: string; year: number; month: number; published_at: string | null; }
interface PayslipWithPeriod extends PayslipRow { period: PeriodInfo; }

const MyPayslips = () => {
  const { user } = useAuth();
  const { employees } = useEmployees();
  const me = useMemo(() => employees.find((e) => e.userId === user?.id), [employees, user?.id]);

  const [rows, setRows] = useState<PayslipWithPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PayslipWithPeriod | null>(null);

  useEffect(() => {
    if (!me?.id) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("payslips")
        .select("*, period:payroll_periods!inner(id, year, month, status, published_at)")
        .eq("employee_id", me.id)
        .eq("payroll_periods.status", "published")
        .order("period(year)", { ascending: false })
        .order("period(month)", { ascending: false });
      if (error) {
        console.error(error);
        toast.error("โหลดสลิปไม่สำเร็จ");
      }
      if (mounted) {
        setRows((data as any) || []);
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [me?.id]);

  // Realtime: refresh when periods/payslips change
  useEffect(() => {
    if (!me?.id) return;
    const ch = supabase
      .channel("my-payslips")
      .on("postgres_changes", { event: "*", schema: "public", table: "payroll_periods" }, () => {
        // simple refetch trigger via state
        setLoading((l) => l);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me?.id]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold font-display">สลิปเงินเดือนของฉัน</h2>
        <p className="text-sm text-muted-foreground mt-0.5">รายการสลิปเงินเดือนที่บริษัทเผยแพร่แล้ว</p>
      </div>

      {loading && <p className="text-sm text-muted-foreground">กำลังโหลด...</p>}

      {!loading && rows.length === 0 && (
        <div className="card-base p-8 text-center text-muted-foreground">
          <Receipt className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>ยังไม่มีสลิปเงินเดือนที่เผยแพร่</p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="card-base overflow-hidden">
          <table className="w-full text-sm">
            <thead style={{ background: "hsl(var(--muted))" }}>
              <tr>
                <th className="text-left px-4 py-3 font-semibold">ประจำเดือน</th>
                <th className="text-right px-3 py-3 font-semibold">รายได้รวม</th>
                <th className="text-right px-3 py-3 font-semibold">รวมหัก</th>
                <th className="text-right px-3 py-3 font-semibold">เงินได้สุทธิ</th>
                <th className="text-center px-3 py-3 font-semibold w-32">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3">{THAI_MONTHS[r.period.month - 1]} {r.period.year + 543}</td>
                  <td className="text-right px-3 py-3 tabular-nums">{formatCurrency(Number(r.gross_pay))}</td>
                  <td className="text-right px-3 py-3 tabular-nums">{formatCurrency(Number(r.total_deduct))}</td>
                  <td className="text-right px-3 py-3 tabular-nums font-semibold" style={{ color: "hsl(var(--primary))" }}>
                    {formatCurrency(Number(r.net_pay))}
                  </td>
                  <td className="text-center px-3 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setSelected(r)} className="p-1.5 rounded-lg hover:bg-muted" title="ดู">
                        <Receipt className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          if (!me) return;
                          await exportPayslipPdfFromSnapshot(me, r, THAI_MONTHS[r.period.month - 1], r.period.year + 543);
                          toast.success("ดาวน์โหลดสลิปแล้ว");
                        }}
                        className="p-1.5 rounded-lg hover:bg-muted"
                        title="ดาวน์โหลด PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 pb-[10px]">
                <Receipt className="w-5 h-5" style={{ color: "hsl(var(--primary))" }} />
                สลิป {THAI_MONTHS[selected.period.month - 1]} {selected.period.year + 543}
              </DialogTitle>
              <DialogDescription className="sr-only">รายละเอียดสลิปเงินเดือน</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <Row label="เงินเดือน" value={formatCurrency(Number(selected.base_salary))} />
              <Row label={`ค่าล่วงเวลา (${selected.ot_hours} ชม.)`} value={formatCurrency(Number(selected.ot_pay))} />
              <Row label="เบี้ยขยัน" value={formatCurrency(Number(selected.diligence))} />
              {(selected.custom_items || []).filter((i) => i.type === "income").map((i) => (
                <Row key={i.id} label={i.name} value={formatCurrency(i.amount)} />
              ))}
              <div className="border-t pt-2"><Row label="รวมรายได้" value={formatCurrency(Number(selected.gross_pay))} bold /></div>
              <div className="border-t pt-2">
                <Row label="ประกันสังคม" value={formatCurrency(Number(selected.ssf))} />
                <Row label="ภาษีหัก ณ ที่จ่าย" value={formatCurrency(Number(selected.tax))} />
                {(selected.custom_items || []).filter((i) => i.type === "deduction").map((i) => (
                  <Row key={i.id} label={i.name} value={formatCurrency(i.amount)} />
                ))}
                <Row label="รวมหัก" value={formatCurrency(Number(selected.total_deduct))} bold />
              </div>
              <div className="p-3 rounded-xl flex justify-between items-center" style={{ background: "hsl(var(--primary) / 0.08)" }}>
                <span className="font-semibold" style={{ color: "hsl(var(--primary))" }}>เงินได้สุทธิ</span>
                <span className="text-xl font-bold" style={{ color: "hsl(var(--primary))" }}>฿{formatCurrency(Number(selected.net_pay))}</span>
              </div>
              <Button
                className="w-full"
                onClick={async () => {
                  if (!me) return;
                  await exportPayslipPdfFromSnapshot(me, selected, THAI_MONTHS[selected.period.month - 1], selected.period.year + 543);
                  toast.success("ดาวน์โหลดสลิปแล้ว");
                }}
              >
                <FileText className="w-4 h-4 mr-1.5" /> ดาวน์โหลด PDF
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

export default MyPayslips;
