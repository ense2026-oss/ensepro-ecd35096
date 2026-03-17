import { useState, useRef, useCallback } from "react";
import { Plus, Edit, Trash2, Save, Building2, Users, ChevronDown, ChevronRight, AlertCircle, GripVertical } from "lucide-react";
import { useOrg, type Affiliation, type Position } from "@/contexts/OrgContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

/* ═══════════════════ Position Tree Node ═══════════════════ */
const PositionNode = ({
  position,
  index,
  total,
  level = 0,
  onEdit,
  onAdd,
  onDelete,
  isDragging,
  dragOverIndex,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: {
  position: Position;
  index: number;
  total: number;
  level?: number;
  onEdit: (p: Position) => void;
  onAdd: (afterLevel: number) => void;
  onDelete: (p: Position) => void;
  isDragging: boolean;
  dragOverIndex: number | null;
  onDragStart: (idx: number) => void;
  onDragOver: (e: React.DragEvent, idx: number) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent, idx: number) => void;
}) => {
  const code = `POS${String(position.id).padStart(5, "0")}`;
  const isOver = dragOverIndex === index;

  return (
    <div
      className={`relative flex items-start transition-opacity ${isDragging ? "opacity-40" : ""}`}
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
      onDrop={(e) => onDrop(e, index)}
    >
      {/* Vertical connector line */}
      <div className="flex flex-col items-center" style={{ width: 24, minHeight: "100%" }}>
        <div className="w-0.5 bg-border" style={{ height: 28 }} />
        <div className="flex items-center" style={{ height: 0 }}>
          <div className="h-0.5 bg-border" style={{ width: 20 }} />
        </div>
        {index < total - 1 && <div className="w-0.5 bg-border flex-1" />}
      </div>

      {level > 0 && <div style={{ width: level * 32 }} className="flex-shrink-0" />}

      {/* Node card */}
      <div className="flex items-center gap-3 py-2 flex-1 min-w-0">
        <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl bg-card border-2 shadow-sm min-w-[200px] max-w-xs transition-all hover:shadow-md cursor-grab active:cursor-grabbing ${isOver ? "border-primary ring-2 ring-primary/20" : "border-border"}`}>
          <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-foreground truncate">{position.name}</span>
            <span className="text-xs text-muted-foreground">({code})</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button onClick={() => onAdd(level)} className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="เพิ่มตำแหน่ง">
            <Plus className="w-4 h-4" />
          </button>
          <button onClick={() => onEdit(position)} className="w-8 h-8 rounded-full flex items-center justify-center bg-accent text-accent-foreground hover:bg-accent/80 transition-colors" title="แก้ไข">
            <Edit className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete(position)} className="w-8 h-8 rounded-full flex items-center justify-center bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors" title="ลบ">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════ Main Component ═══════════════════ */
const Organization = () => {
  const { affiliations, setAffiliations } = useOrg();

  // Expanded affiliations
  const [expandedAffs, setExpandedAffs] = useState<Record<number, boolean>>(
    () => Object.fromEntries(affiliations.map((a) => [a.id, true]))
  );

  const toggleAff = (id: number) =>
    setExpandedAffs((m) => ({ ...m, [id]: !m[id] }));

  // Dialog states
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [editingPos, setEditingPos] = useState<Position | null>(null);
  const [editingAffId, setEditingAffId] = useState<number | null>(null);
  const [deletingPos, setDeletingPos] = useState<{ pos: Position; affId: number } | null>(null);
  const [addAffId, setAddAffId] = useState<number | null>(null);

  const [formName, setFormName] = useState("");

  // Stats
  const totalPositions = affiliations.reduce((s, a) => s + a.positions.length, 0);

  // Handlers
  const handleAdd = (affId: number) => {
    setAddAffId(affId);
    setFormName("");
    setAddOpen(true);
  };

  const handleAddSave = () => {
    if (!formName.trim()) {
      toast.error("กรุณากรอกชื่อตำแหน่ง");
      return;
    }
    setAffiliations((prev) =>
      prev.map((a) =>
        a.id === addAffId
          ? {
              ...a,
              positions: [
                ...a.positions,
                { id: Date.now(), name: formName.trim() },
              ],
            }
          : a
      )
    );
    setAddOpen(false);
    toast.success(`เพิ่มตำแหน่ง "${formName}" สำเร็จ`);
  };

  const handleEdit = (pos: Position, affId: number) => {
    setEditingPos(pos);
    setEditingAffId(affId);
    setFormName(pos.name);
    setEditOpen(true);
  };

  const handleEditSave = () => {
    if (!formName.trim() || !editingPos) {
      toast.error("กรุณากรอกชื่อตำแหน่ง");
      return;
    }
    setAffiliations((prev) =>
      prev.map((a) =>
        a.id === editingAffId
          ? {
              ...a,
              positions: a.positions.map((p) =>
                p.id === editingPos.id ? { ...p, name: formName.trim() } : p
              ),
            }
          : a
      )
    );
    setEditOpen(false);
    toast.success(`แก้ไขตำแหน่งสำเร็จ`);
  };

  const handleDeleteClick = (pos: Position, affId: number) => {
    setDeletingPos({ pos, affId });
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!deletingPos) return;
    setAffiliations((prev) =>
      prev.map((a) =>
        a.id === deletingPos.affId
          ? { ...a, positions: a.positions.filter((p) => p.id !== deletingPos.pos.id) }
          : a
      )
    );
    setDeleteOpen(false);
    toast.success(`ลบตำแหน่ง "${deletingPos.pos.name}" สำเร็จ`);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display">โครงสร้างตำแหน่ง</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            จัดการโครงสร้างตำแหน่งงานตามสังกัด
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="card-base p-4">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">สังกัด</p>
              <p className="text-sm font-bold">{affiliations.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent">
              <Users className="w-4 h-4 text-accent-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">ตำแหน่งทั้งหมด</p>
              <p className="text-sm font-bold">{totalPositions}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Affiliation Trees */}
      {affiliations.map((aff) => {
        const isExpanded = expandedAffs[aff.id] ?? true;
        return (
          <div key={aff.id} className="card-base overflow-hidden">
            {/* Affiliation header */}
            <button
              onClick={() => toggleAff(aff.id)}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary text-primary-foreground font-bold text-sm">
                {aff.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{aff.name}</p>
                <p className="text-xs text-muted-foreground">{aff.positions.length} ตำแหน่ง</p>
              </div>
              {isExpanded ? (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              )}
            </button>

            {/* Position tree */}
            {isExpanded && (
              <div className="px-5 pb-4">
                {/* Root node label */}
                <div className="flex items-center gap-3 mb-1">
                  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-primary/5 border-2 border-primary/20 min-w-[200px] max-w-xs">
                    <Building2 className="w-5 h-5 text-primary flex-shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-bold text-foreground">โครงสร้างตำแหน่ง</span>
                      <span className="text-xs text-muted-foreground">{aff.name}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAdd(aff.id)}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    title="เพิ่มตำแหน่ง"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Position nodes */}
                <div className="ml-6">
                  {aff.positions.map((pos, idx) => (
                    <PositionNode
                      key={pos.id}
                      position={pos}
                      index={idx}
                      total={aff.positions.length}
                      level={0}
                      onEdit={(p) => handleEdit(p, aff.id)}
                      onAdd={() => handleAdd(aff.id)}
                      onDelete={(p) => handleDeleteClick(p, aff.id)}
                    />
                  ))}
                  {aff.positions.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4 pl-8">
                      ยังไม่มีตำแหน่ง — กดปุ่ม + เพื่อเพิ่ม
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {affiliations.length === 0 && (
        <div className="card-base p-8 text-center">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">ยังไม่มีสังกัด — กรุณาเพิ่มสังกัดในหน้าตั้งค่า</p>
        </div>
      )}

      {/* ═══ Add Position Dialog ═══ */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" /> เพิ่มตำแหน่งใหม่
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">สังกัด</label>
              <p className="text-sm font-semibold text-foreground">
                {affiliations.find((a) => a.id === addAffId)?.name}
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                ชื่อตำแหน่ง <span className="text-destructive">*</span>
              </label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="เช่น เจ้าหน้าที่วิจัย"
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/30 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <button className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">ยกเลิก</button>
            </DialogClose>
            <button
              onClick={handleAddSave}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-all"
            >
              <Plus className="w-4 h-4" /> เพิ่ม
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Edit Position Dialog ═══ */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-primary" /> แก้ไขตำแหน่ง
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                ชื่อตำแหน่ง <span className="text-destructive">*</span>
              </label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/30 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <button className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">ยกเลิก</button>
            </DialogClose>
            <button
              onClick={handleEditSave}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-all"
            >
              <Save className="w-4 h-4" /> บันทึก
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Delete Dialog ═══ */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" /> ยืนยันการลบ
            </AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบตำแหน่ง <strong>"{deletingPos?.pos.name}"</strong> หรือไม่?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Organization;
