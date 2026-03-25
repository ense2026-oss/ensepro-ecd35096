import { useState } from "react";
import { Plus, Edit, Trash2, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import TimeInput24 from "@/components/ui/time-input-24";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface Shift {
  id: number;
  name: string;
  start: string;
  end: string;
  breakTime: number;
  color: string;
}

const initialShifts: Shift[] = [
  { id: 1, name: "กะเช้า", start: "08:00", end: "17:00", breakTime: 60, color: "#22c55e" },
  { id: 2, name: "กะบ่าย", start: "14:00", end: "23:00", breakTime: 60, color: "#3b82f6" },
  { id: 3, name: "กะดึก", start: "22:00", end: "07:00", breakTime: 60, color: "#a855f7" },
];

const SHIFT_COLORS = ["#22c55e", "#3b82f6", "#a855f7", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#14b8a6"];
const emptyForm = { name: "", start: "08:00", end: "17:00", breakTime: 60, color: "#22c55e" };

const ShiftsSettings = () => {
  const { toast } = useToast();

  const [shifts, setShifts] = useState<Shift[]>(initialShifts);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (shift: Shift) => { setEditingId(shift.id); setForm({ name: shift.name, start: shift.start, end: shift.end, breakTime: shift.breakTime, color: shift.color }); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editingId !== null) {
      setShifts((prev) => prev.map((s) => (s.id === editingId ? { ...s, ...form } : s)));
      toast({ title: "แก้ไขกะสำเร็จ", description: `กะ "${form.name}" ถูกอัปเดตแล้ว` });
    } else {
      const newId = Math.max(0, ...shifts.map((s) => s.id)) + 1;
      setShifts((prev) => [...prev, { id: newId, ...form }]);
      toast({ title: "เพิ่มกะสำเร็จ", description: `กะ "${form.name}" ถูกเพิ่มแล้ว` });
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (deleteId === null) return;
    const shift = shifts.find((s) => s.id === deleteId);
    setShifts((prev) => prev.filter((s) => s.id !== deleteId));
    setDeleteId(null);
    toast({ title: "ลบกะสำเร็จ", description: `กะ "${shift?.name}" ถูกลบแล้ว`, variant: "destructive" });
  };

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
                <span className="font-semibold" style={{ color: "#87FF0F" }}>{shift.start} น.</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">เวลาออกงาน</span>
                <span className="font-semibold" style={{ color: "#FF870F" }}>{shift.end} น.</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">พักเที่ยง</span>
                <span className="font-semibold">{shift.breakTime} นาที</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Shift CRUD Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId !== null ? "แก้ไขกะการทำงาน" : "เพิ่มกะการทำงาน"}</DialogTitle>
            <DialogDescription className="sr-only">กรอกข้อมูลกะการทำงาน</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-semibold mb-1.5">ชื่อกะ</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="เช่น กะเช้า" className="w-full px-3 py-2.5 text-sm rounded-xl border outline-none bg-muted/30" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5">เวลาเข้างาน</label>
                <TimeInput24 value={form.start} onChange={(v) => setForm((f) => ({ ...f, start: v }))} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">เวลาออกงาน</label>
                <TimeInput24 value={form.end} onChange={(v) => setForm((f) => ({ ...f, end: v }))} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">เวลาพัก (นาที)</label>
              <input type="number" value={form.breakTime} onChange={(e) => setForm((f) => ({ ...f, breakTime: Number(e.target.value) }))} min={0} className="w-full px-3 py-2.5 text-sm rounded-xl border outline-none bg-muted/30" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">สีของกะ</label>
              <div className="flex items-center gap-2 flex-wrap">
                {SHIFT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className="w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center"
                    style={{ background: c, borderColor: form.color === c ? "hsl(var(--foreground))" : "transparent", transform: form.color === c ? "scale(1.15)" : "scale(1)" }}
                  >
                    {form.color === c && <Check className="w-4 h-4 text-white" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setDialogOpen(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted">ยกเลิก</button>
            <button onClick={handleSave} disabled={!form.name.trim()} className="px-6 py-2 rounded-xl text-sm font-bold text-primary-foreground disabled:opacity-50" style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))" }}>
              {editingId !== null ? "บันทึก" : "เพิ่มกะ"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Shift Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบกะ</AlertDialogTitle>
            <AlertDialogDescription>คุณต้องการลบกะ "{shifts.find((s) => s.id === deleteId)?.name}" ใช่หรือไม่?</AlertDialogDescription>
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
