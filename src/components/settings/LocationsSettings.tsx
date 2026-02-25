import { useState } from "react";
import { MapPin, Plus, Edit, Trash2, X, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";

interface Location {
  id: number;
  name: string;
  lat: string;
  lng: string;
  radius: number;
  active: boolean;
}

const defaultLocations: Location[] = [
  { id: 1, name: "สำนักงานใหญ่ กรุงเทพ", lat: "13.7563", lng: "100.5018", radius: 200, active: true },
  { id: 2, name: "สาขาเชียงใหม่", lat: "18.7883", lng: "98.9853", radius: 150, active: true },
  { id: 3, name: "สาขาภูเก็ต", lat: "7.8804", lng: "98.3923", radius: 100, active: false },
];

const emptyForm = { name: "", lat: "", lng: "", radius: 100, active: true };

const LocationsSettings = () => {
  const [locations, setLocations] = useState<Location[]>(defaultLocations);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (loc: Location) => {
    setEditingId(loc.id);
    setForm({ name: loc.name, lat: loc.lat, lng: loc.lng, radius: loc.radius, active: loc.active });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.lat.trim() || !form.lng.trim()) {
      toast({ title: "กรุณากรอกข้อมูลให้ครบถ้วน", variant: "destructive" });
      return;
    }
    if (editingId !== null) {
      setLocations((prev) =>
        prev.map((l) => (l.id === editingId ? { ...l, ...form } : l))
      );
      toast({ title: "แก้ไขพื้นที่สำเร็จ", description: form.name });
    } else {
      const newId = Math.max(0, ...locations.map((l) => l.id)) + 1;
      setLocations((prev) => [...prev, { id: newId, ...form }]);
      toast({ title: "เพิ่มพื้นที่สำเร็จ", description: form.name });
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (deleteId === null) return;
    const loc = locations.find((l) => l.id === deleteId);
    setLocations((prev) => prev.filter((l) => l.id !== deleteId));
    setDeleteId(null);
    toast({ title: "ลบพื้นที่สำเร็จ", description: loc?.name });
  };

  const toggleActive = (id: number) => {
    setLocations((prev) =>
      prev.map((l) => (l.id === id ? { ...l, active: !l.active } : l))
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{locations.length} พื้นที่ที่กำหนดไว้</p>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-primary-foreground"
          style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}
        >
          <Plus className="w-4 h-4" />
          เพิ่มพื้นที่
        </button>
      </div>

      <div className="space-y-3">
        {locations.map((loc) => (
          <div key={loc.id} className="card-base p-4 flex items-center gap-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: loc.active ? "hsl(var(--accent) / 0.15)" : "hsl(var(--muted))" }}
            >
              <MapPin className="w-5 h-5" style={{ color: loc.active ? "hsl(90 100% 30%)" : "hsl(var(--muted-foreground))" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm truncate">{loc.name}</p>
                <button
                  onClick={() => toggleActive(loc.id)}
                  className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer transition-colors ${loc.active ? "badge-present" : "badge-absent"}`}
                >
                  {loc.active ? "เปิดใช้" : "ปิดใช้"}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Lat: {loc.lat}, Lng: {loc.lng} | รัศมี: {loc.radius} เมตร
              </p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => openEdit(loc)} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                <Edit className="w-4 h-4" />
              </button>
              <button onClick={() => setDeleteId(loc.id)} className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-destructive">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {locations.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm">ยังไม่มีพื้นที่เข้างาน</div>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "แก้ไขพื้นที่เข้างาน" : "เพิ่มพื้นที่เข้างานใหม่"}</DialogTitle>
            <DialogDescription>กรอกข้อมูลพิกัดและรัศมีของพื้นที่เข้างาน</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-sm font-semibold mb-1.5">ชื่อพื้นที่</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="เช่น สำนักงานใหญ่ กรุงเทพ"
                className="w-full px-3 py-2.5 text-sm rounded-xl border outline-none bg-muted/30 focus:ring-2 focus:ring-primary/30 transition-shadow"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1.5">Latitude</label>
                <input
                  value={form.lat}
                  onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
                  placeholder="13.7563"
                  className="w-full px-3 py-2.5 text-sm rounded-xl border outline-none bg-muted/30 focus:ring-2 focus:ring-primary/30 transition-shadow"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Longitude</label>
                <input
                  value={form.lng}
                  onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
                  placeholder="100.5018"
                  className="w-full px-3 py-2.5 text-sm rounded-xl border outline-none bg-muted/30 focus:ring-2 focus:ring-primary/30 transition-shadow"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">รัศมี (เมตร)</label>
              <input
                type="number"
                value={form.radius}
                onChange={(e) => setForm((f) => ({ ...f, radius: Number(e.target.value) }))}
                placeholder="200"
                className="w-full px-3 py-2.5 text-sm rounded-xl border outline-none bg-muted/30 focus:ring-2 focus:ring-primary/30 transition-shadow"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold">เปิดใช้งาน</label>
              <button
                onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
                className={`w-11 h-6 rounded-full relative transition-colors ${form.active ? "bg-accent" : "bg-muted"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.active ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDialogOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-primary-foreground"
                style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}
              >
                <Check className="w-4 h-4" />
                {editingId ? "บันทึกการแก้ไข" : "เพิ่มพื้นที่"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
              <Trash2 className="w-6 h-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center">ยืนยันการลบพื้นที่</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              คุณต้องการลบ "<span className="font-semibold text-foreground">{locations.find((l) => l.id === deleteId)?.name}</span>" หรือไม่?
              <br />การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-2">
            <AlertDialogCancel className="rounded-xl">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              ลบพื้นที่
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LocationsSettings;
