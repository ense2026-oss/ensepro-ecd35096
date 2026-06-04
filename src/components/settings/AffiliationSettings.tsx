import { useState } from "react";
import { Building2, Plus, Edit, Trash2, Check, Briefcase, ChevronDown, ChevronRight } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { useOrg } from "@/contexts/OrgContext";
import PositionCombobox from "@/components/ui/position-combobox";

const AffiliationSettings = () => {
  const { affiliations, addAffiliation, updateAffiliation, deleteAffiliation, addPosition, updatePosition, deletePosition, orgLevelsFlat } = useOrg();

  const [affDialogOpen, setAffDialogOpen] = useState(false);
  const [posDialogOpen, setPosDialogOpen] = useState(false);
  const [deleteAffId, setDeleteAffId] = useState<string | null>(null);
  const [deletePosId, setDeletePosId] = useState<string | null>(null);
  const [editingAffId, setEditingAffId] = useState<string | null>(null);
  const [editingPosId, setEditingPosId] = useState<string | null>(null);
  const [affForm, setAffForm] = useState({ name: "", parentOrgLevelId: "" });
  const [posForm, setPosForm] = useState({ name: "", affiliationId: "" });
  const [expandedAffs, setExpandedAffs] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const toggleExpand = (id: string) => setExpandedAffs((m) => ({ ...m, [id]: !m[id] }));

  // Affiliation CRUD
  const openAddAff = () => { setEditingAffId(null); setAffForm({ name: "", parentOrgLevelId: "" }); setAffDialogOpen(true); };
  const openEditAff = (aff: { id: string; name: string; parent_org_level_id?: string | null }) => { setEditingAffId(aff.id); setAffForm({ name: aff.name, parentOrgLevelId: aff.parent_org_level_id || "" }); setAffDialogOpen(true); };

  const handleSaveAff = async () => {
    if (!affForm.name.trim()) { toast({ title: "กรุณากรอกชื่อสังกัด", variant: "destructive" }); return; }
    setSaving(true);
    try {
      if (editingAffId) {
        await updateAffiliation(editingAffId, affForm.name, affForm.parentOrgLevelId || null);
        toast({ title: "แก้ไขสังกัดสำเร็จ", description: affForm.name });
      } else {
        await addAffiliation(affForm.name, affForm.parentOrgLevelId || null);
        toast({ title: "เพิ่มสังกัดสำเร็จ", description: affForm.name });
      }
      setAffDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "ไม่สามารถบันทึกสังกัดได้";
      toast({ title: "บันทึกสังกัดไม่สำเร็จ", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAff = async () => {
    if (!deleteAffId) return;
    const aff = affiliations.find((a) => a.id === deleteAffId);
    try {
      await deleteAffiliation(deleteAffId);
      toast({ title: "ลบสังกัดสำเร็จ", description: aff?.name });
      setDeleteAffId(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "ไม่สามารถลบสังกัดได้";
      toast({ title: "ลบสังกัดไม่สำเร็จ", description: message, variant: "destructive" });
    }
  };

  // Position CRUD
  const openAddPos = (affId: string) => { setEditingPosId(null); setPosForm({ name: "", affiliationId: affId }); setPosDialogOpen(true); };
  const openAddPosGlobal = () => { setEditingPosId(null); setPosForm({ name: "", affiliationId: affiliations[0]?.id || "" }); setPosDialogOpen(true); };
  const openEditPos = (posId: string, name: string, affId: string) => {
    setEditingPosId(posId); setPosForm({ name, affiliationId: affId }); setPosDialogOpen(true);
  };

  const handleSavePos = async () => {
    if (!posForm.name.trim()) { toast({ title: "กรุณากรอกชื่อตำแหน่ง", variant: "destructive" }); return; }
    if (!posForm.affiliationId) { toast({ title: "กรุณาเลือกสังกัด", variant: "destructive" }); return; }
    setSaving(true);
    try {
      if (editingPosId) {
        await updatePosition(editingPosId, posForm.name);
        toast({ title: "แก้ไขตำแหน่งสำเร็จ", description: posForm.name });
      } else {
        await addPosition(posForm.affiliationId, null, posForm.name);
        toast({ title: "เพิ่มตำแหน่งสำเร็จ", description: posForm.name });
      }
      setPosDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "ไม่สามารถบันทึกตำแหน่งได้";
      toast({ title: "บันทึกตำแหน่งไม่สำเร็จ", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePos = async () => {
    if (!deletePosId) return;
    try {
      await deletePosition(deletePosId);
      toast({ title: "ลบตำแหน่งสำเร็จ" });
      setDeletePosId(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "ไม่สามารถลบตำแหน่งได้";
      toast({ title: "ลบตำแหน่งไม่สำเร็จ", description: message, variant: "destructive" });
    }
  };

  const totalPositions = affiliations.reduce((sum, a) => sum + a.positions.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{affiliations.length} สังกัด, {totalPositions} ตำแหน่ง</p>
        <div className="flex items-center gap-2">
          <button onClick={openAddPosGlobal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border-2 border-primary text-primary hover:bg-primary/10 transition-colors">
            <Briefcase className="w-4 h-4" /> เพิ่มตำแหน่งงาน
          </button>
          <button onClick={openAddAff}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-primary-foreground"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}>
            <Plus className="w-4 h-4" /> เพิ่มสังกัด
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {affiliations.map((aff) => {
          const isExpanded = expandedAffs[aff.id] ?? true;
          return (
            <div key={aff.id} className="card-base overflow-hidden">
              <div className="p-4 flex items-center gap-4">
                <button onClick={() => toggleExpand(aff.id)} className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "hsl(var(--primary) / 0.12)" }}>
                  <Building2 className="w-5 h-5 text-primary" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">{aff.name}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
                      {aff.positions.length} ตำแหน่ง
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openAddPos(aff.id)} className="p-2 rounded-lg hover:bg-muted transition-colors text-primary" title="เพิ่มตำแหน่ง">
                    <Plus className="w-4 h-4" />
                  </button>
                  <button onClick={() => openEditAff(aff)} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteAffId(aff.id)} className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => toggleExpand(aff.id)} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {isExpanded && aff.positions.length > 0 && (
                <div className="px-4 pb-4 pt-0">
                  <div className="border-t border-border pt-3 space-y-2">
                    {aff.positions.map((pos) => (
                      <div key={pos.id} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-muted/40">
                        <Briefcase className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm flex-1 truncate">{pos.name}</span>
                        <button onClick={() => openEditPos(pos.id, pos.name, aff.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeletePosId(pos.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {isExpanded && aff.positions.length === 0 && (
                <div className="px-4 pb-4 pt-0">
                  <div className="border-t border-border pt-3 text-center text-sm text-muted-foreground py-4">
                    ยังไม่มีตำแหน่ง —{" "}
                    <button onClick={() => openAddPos(aff.id)} className="text-primary font-medium hover:underline">เพิ่มตำแหน่ง</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {affiliations.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm">ยังไม่มีสังกัด</div>
        )}
      </div>

      {/* Affiliation Dialog */}
      <Dialog open={affDialogOpen} onOpenChange={setAffDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAffId ? "แก้ไขสังกัด" : "เพิ่มสังกัดใหม่"}</DialogTitle>
            <DialogDescription>กรอกชื่อสังกัด (แผนก/หน่วยงาน)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-sm font-semibold mb-1.5">ชื่อสังกัด</label>
              <input value={affForm.name} onChange={(e) => setAffForm((f) => ({ ...f, name: e.target.value }))} placeholder="เช่น รถไฟฟ้าขสมช"
                className="w-full px-3 py-2.5 text-sm rounded-xl border outline-none bg-muted/30 focus:ring-2 focus:ring-primary/30 transition-shadow" />
            </div>
            {orgLevelsFlat.length > 0 && (
              <div>
                <label className="block text-sm font-semibold mb-1.5">อยู่ภายใต้ระดับองค์กร</label>
                <select
                  value={affForm.parentOrgLevelId}
                  onChange={(e) => setAffForm((f) => ({ ...f, parentOrgLevelId: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border outline-none bg-muted/30 focus:ring-2 focus:ring-primary/30 transition-shadow"
                >
                  <option value="">— ไม่ระบุ (แสดงที่ระดับบนสุด) —</option>
                  {orgLevelsFlat.map((ol) => (
                    <option key={ol.id} value={ol.id}>{ol.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setAffDialogOpen(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">ยกเลิก</button>
              <button onClick={handleSaveAff} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-primary-foreground disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}>
                <Check className="w-4 h-4" /> {editingAffId ? "บันทึก" : "เพิ่มสังกัด"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Position Dialog */}
      <Dialog open={posDialogOpen} onOpenChange={setPosDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPosId ? "แก้ไขตำแหน่ง" : "เพิ่มตำแหน่งใหม่"}</DialogTitle>
            <DialogDescription>กรอกชื่อตำแหน่งงาน</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-sm font-semibold mb-1.5">สังกัด</label>
              <select
                value={posForm.affiliationId}
                onChange={(e) => setPosForm((f) => ({ ...f, affiliationId: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm rounded-xl border outline-none bg-muted/30 focus:ring-2 focus:ring-primary/30 transition-shadow"
                disabled={!!editingPosId}
              >
                {affiliations.map((aff) => (
                  <option key={aff.id} value={aff.id}>{aff.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">ชื่อตำแหน่ง</label>
              <input value={posForm.name} onChange={(e) => setPosForm((f) => ({ ...f, name: e.target.value }))} placeholder="เช่น เจ้าหน้าที่วิจัย"
                className="w-full px-3 py-2.5 text-sm rounded-xl border outline-none bg-muted/30 focus:ring-2 focus:ring-primary/30 transition-shadow" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setPosDialogOpen(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">ยกเลิก</button>
              <button onClick={handleSavePos} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-primary-foreground disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}>
                <Check className="w-4 h-4" /> {editingPosId ? "บันทึก" : "เพิ่มตำแหน่ง"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Affiliation */}
      <AlertDialog open={deleteAffId !== null} onOpenChange={(open) => !open && setDeleteAffId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
              <Trash2 className="w-6 h-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center">ยืนยันการลบสังกัด</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              คุณต้องการลบ "<span className="font-semibold text-foreground">{affiliations.find((a) => a.id === deleteAffId)?.name}</span>" และตำแหน่งทั้งหมดภายใน หรือไม่?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-2">
            <AlertDialogCancel className="rounded-xl">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAff} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">ลบสังกัด</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Position */}
      <AlertDialog open={deletePosId !== null} onOpenChange={(open) => !open && setDeletePosId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
              <Trash2 className="w-6 h-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center">ยืนยันการลบตำแหน่ง</AlertDialogTitle>
            <AlertDialogDescription className="text-center">คุณต้องการลบตำแหน่งนี้หรือไม่?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-2">
            <AlertDialogCancel className="rounded-xl">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePos} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">ลบตำแหน่ง</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AffiliationSettings;
