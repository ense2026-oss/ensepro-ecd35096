import { useState, useEffect, useCallback } from "react";
import { Plus, Edit, Trash2, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/components/ui/dialog";
import TimeInput24 from "@/components/ui/time-input-24";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  color: string;
  sort_order: number;
}

const SHIFT_COLORS = ["#22c55e", "#3b82f6", "#a855f7", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#14b8a6"];
const emptyForm = { name: "", start_time: "08:00", end_time: "17:00", break_minutes: 60, color: "#22c55e" };

const ShiftsSettings = () => {
  const { toast } = useToast();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchShifts = useCallback(async () => {
    const { data } = await supabase.from("shifts").select("*").order("sort_order");
    if (data) setShifts(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchShifts(); }, [fetchShifts]);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (shift: Shift) => {
    setEditingId(shift.id);
    setForm({ name: shift.name, start_time: shift.start_time, end_time: shift.end_time, break_minutes: shift.break_minutes, color: shift.color });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase.from("shifts").update({
          name: form.name, start_time: form.start_time, end_time: form.end_time,
          break_minutes: form.break_minutes, color: form.color,
        }).eq("id", editingId);
        if (error) throw error;
        toast({ title: "แก้ไขกะสำเร็จ", description: `กะ "${form.name}" ถูกอัปเดตแล้ว` });
      } else {
        const maxOrder = shifts.length > 0 ? Math.max(...shifts.map(s => s.sort_order)) + 1 : 0;
        const { error } = await supabase.from("shifts").insert({
          name: form.name, start_time: form.start_time, end_time: form.end_time,
          break_minutes: form.break_minutes, color: form.color, sort_order: maxOrder,
        });
        if (error) throw error;
        toast({ title: "เพิ่มกะสำเร็จ", description: `กะ "${form.name}" ถูกเพิ่มแล้ว` });
      }
      setDialogOpen(false);
      fetchShifts();
    } catch (e: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const shift = shifts.find(s => s.id === deleteId);
    const { error } = await supabase.from("shifts").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "ลบไม่สำเร็จ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "ลบกะสำเร็จ", description: `กะ "${shift?.name}" ถูกลบแล้ว`, variant: "destructive" });
      fetchShifts();
    }
    setDeleteId(null);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-primary-foreground" style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}>
          <Plus className="w-4 h-4" />
          เพิ่มกะ
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {shifts.map((shift) => (
          <div key={shift.id} className="card-base p-5 border-t-4" style={{ borderTopColor: shift.color }}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold font-display">{shift.name}</span>
              <div className="flex gap-1">
                <button onClick={() => openEdit(shift)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><Edit className="w-4 h-4" /></button>
                <button onClick={() => setDeleteId(shift.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">เวลาเข้างาน</span>
                <span className="font-semibold" style={{ color: "#87FF0F" }}>{shift.start_time} น.</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">เวลาออกงาน</span>
                <span className="font-semibold" style={{ color: "#FF870F" }}>{shift.end_time} น.</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">พักเที่ยง</span>
                <span className="font-semibold">{shift.break_minutes} นาที</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "แก้ไขกะการทำงาน" : "เพิ่มกะการทำงาน"}</DialogTitle>
            <DialogDescription className="sr-only">กรอกข้อมูลกะการทำงาน</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-semibold mb-1.5">ชื่อกะ</label>
              <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น กะเช้า" className="w-full px-3 py-2.5 text-sm rounded-xl border outline-none bg-muted/30" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5">เวลาเข้างาน</label>
                <TimeInput24 value={form.start_time} onChange={(v) => setForm(f => ({ ...f, start_time: v }))} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">เวลาออกงาน</label>
                <TimeInput24 value={form.end_time} onChange={(v) => setForm(f => ({ ...f, end_time: v }))} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">เวลาพัก (นาที)</label>
              <input type="number" value={form.break_minutes} onChange={(e) => setForm(f => ({ ...f, break_minutes: Number(e.target.value) }))} min={0} className="w-full px-3 py-2.5 text-sm rounded-xl border outline-none bg-muted/30" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">สีของกะ</label>
              <div className="flex items-center gap-2 flex-wrap">
                {SHIFT_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                    className="w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center"
                    style={{ background: c, borderColor: form.color === c ? "hsl(var(--foreground))" : "transparent", transform: form.color === c ? "scale(1.15)" : "scale(1)" }}>
                    {form.color === c && <Check className="w-4 h-4 text-white" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setDialogOpen(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted">ยกเลิก</button>
            <button onClick={handleSave} disabled={!form.name.trim() || saving} className="px-6 py-2 rounded-xl text-sm font-bold text-primary-foreground disabled:opacity-50" style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))" }}>
              {saving ? "กำลังบันทึก..." : editingId ? "บันทึก" : "เพิ่มกะ"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบกะ</AlertDialogTitle>
            <AlertDialogDescription>คุณต้องการลบกะ "{shifts.find(s => s.id === deleteId)?.name}" ใช่หรือไม่?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">ลบ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ShiftsSettings;
