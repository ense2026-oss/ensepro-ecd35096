import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface LeaveType {
  id: string;
  name: string;
  quota: number;
  require_doc: boolean;
  doc_required_min_days: number;
  color: string;
  sort_order: number;
}

const emptyForm = { name: "", quota: 0, require_doc: false, doc_required_min_days: 1, color: "#6B7280" };

const LeaveTypesSettings = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from("leave_types")
      .select("*")
      .order("sort_order");
    if (!error && data) setItems(data);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (item: LeaveType) => {
    setEditingId(item.id);
    setForm({ name: item.name, quota: item.quota, require_doc: item.require_doc, color: item.color });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    if (editingId) {
      const { error } = await supabase
        .from("leave_types")
        .update({ name: form.name, quota: form.quota, require_doc: form.require_doc, color: form.color })
        .eq("id", editingId);
      if (error) {
        toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "แก้ไขสำเร็จ", description: `ประเภทการลา "${form.name}" ถูกอัปเดตแล้ว` });
      }
    } else {
      const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) + 1 : 0;
      const { error } = await supabase
        .from("leave_types")
        .insert({ name: form.name, quota: form.quota, require_doc: form.require_doc, color: form.color, sort_order: maxOrder });
      if (error) {
        toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "เพิ่มสำเร็จ", description: `ประเภทการลา "${form.name}" ถูกเพิ่มแล้ว` });
      }
    }
    setSaving(false);
    setDialogOpen(false);
    fetchItems();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const item = items.find(i => i.id === deleteId);
    const { error } = await supabase.from("leave_types").delete().eq("id", deleteId);
    setDeleteId(null);
    if (error) {
      toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "ลบสำเร็จ", description: `ประเภทการลา "${item?.name}" ถูกลบแล้ว`, variant: "destructive" });
      fetchItems();
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

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
                  <span className="text-lg font-bold font-display" style={{ color: "#FF870F" }}>{lt.quota}</span>
                  <span className="text-sm text-muted-foreground ml-1">วัน</span>
                </td>
                <td className="px-4 py-3">
                  <span className={lt.require_doc ? "badge-late" : "badge-present"}>
                    {lt.require_doc ? "บังคับ" : "ไม่บังคับ"}
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
            {items.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">ยังไม่มีประเภทการลา</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md p-5">
          <DialogHeader>
            <DialogTitle>{editingId ? "แก้ไขประเภทการลา" : "เพิ่มประเภทการลา"}</DialogTitle>
            <DialogDescription className="sr-only">กรอกข้อมูลประเภทการลา</DialogDescription>
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
                value={form.quota}
                onChange={(e) => setForm((f) => ({ ...f, quota: Number(e.target.value) }))}
                min={0}
                className="w-full px-3 py-2.5 text-sm rounded-xl border outline-none bg-muted/30"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="requireDoc"
                checked={form.require_doc}
                onChange={(e) => setForm((f) => ({ ...f, require_doc: e.target.checked }))}
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
              disabled={!form.name.trim() || saving}
              className="px-6 py-2 rounded-xl text-sm font-bold text-primary-foreground disabled:opacity-50 flex items-center gap-2"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))" }}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingId ? "บันทึก" : "เพิ่ม"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
