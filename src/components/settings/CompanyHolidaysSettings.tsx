import { useEffect, useState } from "react";
import { Plus, Edit, Trash2, Loader2, CalendarPlus, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ThaiDatePicker } from "@/components/ui/thai-date-picker";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Holiday {
  id: string;
  date: string;
  name: string;
  is_paid: boolean;
}

const THAI_HOLIDAYS_TEMPLATE: { md: string; name: string }[] = [
  { md: "01-01", name: "วันขึ้นปีใหม่" },
  { md: "04-06", name: "วันจักรี" },
  { md: "04-13", name: "วันสงกรานต์" },
  { md: "04-14", name: "วันสงกรานต์" },
  { md: "04-15", name: "วันสงกรานต์" },
  { md: "05-01", name: "วันแรงงานแห่งชาติ" },
  { md: "05-04", name: "วันฉัตรมงคล" },
  { md: "06-03", name: "วันเฉลิมพระชนมพรรษาพระราชินี" },
  { md: "07-28", name: "วันเฉลิมพระชนมพรรษา ร.10" },
  { md: "08-12", name: "วันแม่แห่งชาติ" },
  { md: "10-13", name: "วันคล้ายวันสวรรคต ร.9" },
  { md: "10-23", name: "วันปิยมหาราช" },
  { md: "12-05", name: "วันพ่อแห่งชาติ" },
  { md: "12-10", name: "วันรัฐธรรมนูญ" },
  { md: "12-31", name: "วันสิ้นปี" },
];

const formatThai = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const months = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  return `${parseInt(d)} ${months[parseInt(m)-1]} ${parseInt(y)+543}`;
};

const CompanyHolidaysSettings = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ date: "", name: "", is_paid: true });

  const fetchItems = async () => {
    const { data } = await supabase.from("company_holidays").select("*").order("date");
    setItems((data as Holiday[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm({ date: "", name: "", is_paid: true });
    setDialogOpen(true);
  };

  const openEdit = (h: Holiday) => {
    setEditingId(h.id);
    setForm({ date: h.date, name: h.name, is_paid: h.is_paid });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.date || !form.name.trim()) return;
    setSaving(true);
    if (editingId) {
      const { error } = await supabase.from("company_holidays").update({
        date: form.date, name: form.name, is_paid: form.is_paid,
      }).eq("id", editingId);
      if (error) toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
      else toast({ title: "แก้ไขสำเร็จ", description: form.name });
    } else {
      const { error } = await supabase.from("company_holidays").insert({
        date: form.date, name: form.name, is_paid: form.is_paid,
      });
      if (error) toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
      else toast({ title: "เพิ่มวันหยุดสำเร็จ", description: form.name });
    }
    setSaving(false);
    setDialogOpen(false);
    fetchItems();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("company_holidays").delete().eq("id", deleteId);
    setDeleteId(null);
    if (error) toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
    else { toast({ title: "ลบสำเร็จ", variant: "destructive" }); fetchItems(); }
  };

  const importThaiHolidays = async () => {
    setImporting(true);
    const year = new Date().getFullYear();
    const rows: { date: string; name: string; is_paid: boolean }[] = [];
    [year, year + 1].forEach((y) => {
      THAI_HOLIDAYS_TEMPLATE.forEach((t) => {
        rows.push({ date: `${y}-${t.md}`, name: t.name, is_paid: true });
      });
    });
    // Filter out existing dates
    const existing = new Set(items.map((i) => i.date));
    const toInsert = rows.filter((r) => !existing.has(r.date));
    if (toInsert.length === 0) {
      toast({ title: "วันหยุดถูกนำเข้าเรียบร้อยแล้ว", description: `ปี ${year}-${year+1}` });
      setImporting(false);
      return;
    }
    const { error } = await supabase.from("company_holidays").insert(toInsert);
    setImporting(false);
    if (error) toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
    else { toast({ title: `นำเข้าสำเร็จ ${toInsert.length} วัน`, description: `ปี ${year}-${year+1}` }); fetchItems(); }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold font-display">วันหยุดบริษัท</h3>
          <p className="text-sm text-muted-foreground mt-0.5">วันหยุดประจำปี / นักขัตฤกษ์ ที่มีผลกับพนักงานทุกคน</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={importThaiHolidays}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border bg-muted/30 hover:bg-muted disabled:opacity-50"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            นำเข้าวันหยุดราชการไทย
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-primary-foreground"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}
          >
            <Plus className="w-4 h-4" />
            เพิ่ม
          </button>
        </div>
      </div>

      <div className="card-base overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: "hsl(var(--border))" }}>
              {["วันที่", "ชื่อวันหยุด", "ได้รับค่าจ้าง", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((h) => (
              <tr key={h.id} className="border-b hover:bg-muted/30" style={{ borderColor: "hsl(var(--border))" }}>
                <td className="px-4 py-3 text-sm font-semibold">{formatThai(h.date)}</td>
                <td className="px-4 py-3 text-sm">{h.name}</td>
                <td className="px-4 py-3">
                  <span className={h.is_paid ? "badge-present" : "badge-late"}>
                    {h.is_paid ? "จ่าย" : "ไม่จ่าย"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(h)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteId(h.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                <CalendarPlus className="w-10 h-10 mx-auto mb-2 opacity-40" />
                ยังไม่มีวันหยุดบริษัท · กดปุ่ม "นำเข้าวันหยุดราชการไทย" เพื่อเริ่มต้น
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "แก้ไขวันหยุด" : "เพิ่มวันหยุดบริษัท"}</DialogTitle>
            <DialogDescription className="sr-only">กรอกข้อมูลวันหยุด</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 px-6">
            <div>
              <label className="block text-sm font-semibold mb-1.5">วันที่</label>
              <ThaiDatePicker value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">ชื่อวันหยุด</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="เช่น วันสงกรานต์"
                className="w-full px-3 py-2.5 text-sm rounded-xl border outline-none bg-muted/30"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox" id="isPaid"
                checked={form.is_paid}
                onChange={(e) => setForm((f) => ({ ...f, is_paid: e.target.checked }))}
                className="w-4 h-4 rounded accent-[#FF870F]"
              />
              <label htmlFor="isPaid" className="text-sm font-semibold cursor-pointer">ได้รับค่าจ้างในวันหยุดนี้</label>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setDialogOpen(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted">ยกเลิก</button>
            <button
              onClick={handleSave}
              disabled={!form.date || !form.name.trim() || saving}
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
            <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
            <AlertDialogDescription>
              ลบวันหยุด "{items.find((i) => i.id === deleteId)?.name}" ใช่หรือไม่?
            </AlertDialogDescription>
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

export default CompanyHolidaysSettings;
