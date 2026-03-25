import { useState } from "react";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface LeaveType {
  id: number;
  name: string;
  daysPerYear: number;
  requireDoc: boolean;
}

const initialData: LeaveType[] = [
  { id: 1, name: "ลาป่วย", daysPerYear: 30, requireDoc: true },
  { id: 2, name: "ลาพักร้อน", daysPerYear: 10, requireDoc: false },
  { id: 3, name: "ลากิจ", daysPerYear: 7, requireDoc: false },
  { id: 4, name: "ลาคลอด", daysPerYear: 98, requireDoc: true },
  { id: 5, name: "ลาบวช", daysPerYear: 15, requireDoc: false },
];

const emptyForm = { name: "", daysPerYear: 0, requireDoc: false };

const LeaveTypesSettings = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<LeaveType[]>(initialData);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (item: LeaveType) => {
    setEditingId(item.id);
    setForm({ name: item.name, daysPerYear: item.daysPerYear, requireDoc: item.requireDoc });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editingId !== null) {
      setItems((prev) => prev.map((i) => (i.id === editingId ? { ...i, ...form } : i)));
      toast({ title: "แก้ไขสำเร็จ", description: `ประเภทการลา "${form.name}" ถูกอัปเดตแล้ว` });
    } else {
      const newId = Math.max(0, ...items.map((i) => i.id)) + 1;
      setItems((prev) => [...prev, { id: newId, ...form }]);
      toast({ title: "เพิ่มสำเร็จ", description: `ประเภทการลา "${form.name}" ถูกเพิ่มแล้ว` });
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (deleteId === null) return;
    const item = items.find((i) => i.id === deleteId);
    setItems((prev) => prev.filter((i) => i.id !== deleteId));
    setDeleteId(null);
    toast({ title: "ลบสำเร็จ", description: `ประเภทการลา "${item?.name}" ถูกลบแล้ว`, variant: "destructive" });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-primary-foreground"
          style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}
        >
          <Plus className="w-4 h-4" />
          เพิ่มประเภทการลา
        </button>
      </div>

      <div className="card-base overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: "hsl(var(--border))" }}>
              {["ประเภทการลา", "จำนวนวันต่อปี", "ต้องแนบเอกสาร", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((lt) => (
              <tr key={lt.id} className="border-b hover:bg-muted/30" style={{ borderColor: "hsl(var(--border))" }}>
                <td className="px-4 py-3 text-sm font-semibold">{lt.name}</td>
                <td className="px-4 py-3">
                  <span className="text-lg font-bold font-display" style={{ color: "#FF870F" }}>{lt.daysPerYear}</span>
                  <span className="text-sm text-muted-foreground ml-1">วัน</span>
                </td>
                <td className="px-4 py-3">
                  <span className={lt.requireDoc ? "badge-late" : "badge-present"}>
                    {lt.requireDoc ? "บังคับ" : "ไม่บังคับ"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(lt)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteId(lt.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId !== null ? "แก้ไขประเภทการลา" : "เพิ่มประเภทการลา"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-semibold mb-1.5">ชื่อประเภทการลา</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="เช่น ลาป่วย"
                className="w-full px-3 py-2.5 text-sm rounded-xl border outline-none bg-muted/30"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">จำนวนวันต่อปี</label>
              <input
                type="number"
                value={form.daysPerYear}
                onChange={(e) => setForm((f) => ({ ...f, daysPerYear: Number(e.target.value) }))}
                min={0}
                className="w-full px-3 py-2.5 text-sm rounded-xl border outline-none bg-muted/30"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="requireDoc"
                checked={form.requireDoc}
                onChange={(e) => setForm((f) => ({ ...f, requireDoc: e.target.checked }))}
                className="w-4 h-4 rounded accent-[#FF870F]"
              />
              <label htmlFor="requireDoc" className="text-sm font-semibold cursor-pointer">ต้องแนบเอกสารประกอบ</label>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setDialogOpen(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted">
              ยกเลิก
            </button>
            <button
              onClick={handleSave}
              disabled={!form.name.trim()}
              className="px-6 py-2 rounded-xl text-sm font-bold text-primary-foreground disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))" }}
            >
              {editingId !== null ? "บันทึก" : "เพิ่ม"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบประเภทการลา</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบประเภทการลา "{items.find((i) => i.id === deleteId)?.name}" ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LeaveTypesSettings;
