import { useState } from "react";
import { Plus, Edit, Trash2, Save, Building2, Users, ChevronDown, ChevronRight, AlertCircle, GripVertical } from "lucide-react";
import { useOrg, type Affiliation, type Position } from "@/contexts/OrgContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

/* ═══════════════════ Recursive Helpers ═══════════════════ */
const countAllPositions = (positions: Position[]): number =>
  positions.reduce((s, p) => s + 1 + countAllPositions(p.children || []), 0);

const findPositionById = (positions: Position[], id: number): Position | null => {
  for (const p of positions) {
    if (p.id === id) return p;
    const found = findPositionById(p.children || [], id);
    if (found) return found;
  }
  return null;
};

const addChildToPosition = (positions: Position[], parentId: number, child: Position): Position[] =>
  positions.map((p) =>
    p.id === parentId
      ? { ...p, children: [...(p.children || []), child] }
      : { ...p, children: addChildToPosition(p.children || [], parentId, child) }
  );

const updatePositionName = (positions: Position[], targetId: number, newName: string): Position[] =>
  positions.map((p) =>
    p.id === targetId
      ? { ...p, name: newName }
      : { ...p, children: updatePositionName(p.children || [], targetId, newName) }
  );

const removePosition = (positions: Position[], targetId: number): Position[] =>
  positions
    .filter((p) => p.id !== targetId)
    .map((p) => ({ ...p, children: removePosition(p.children || [], targetId) }));

const reorderSiblings = (positions: Position[], fromIdx: number, toIdx: number): Position[] => {
  const arr = [...positions];
  const [moved] = arr.splice(fromIdx, 1);
  arr.splice(toIdx, 0, moved);
  return arr;
};

const reorderInParent = (positions: Position[], parentId: number, fromIdx: number, toIdx: number): Position[] =>
  positions.map((p) =>
    p.id === parentId
      ? { ...p, children: reorderSiblings(p.children || [], fromIdx, toIdx) }
      : { ...p, children: reorderInParent(p.children || [], parentId, fromIdx, toIdx) }
  );

/* ═══════════════════ Position Tree Node ═══════════════════ */
const PositionNode = ({
  position,
  index,
  total,
  level = 0,
  onEdit,
  onAddSub,
  onDelete,
  isDraggingId,
  dragOverId,
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
  onAddSub: (parentPos: Position) => void;
  onDelete: (p: Position) => void;
  isDraggingId: number | null;
  dragOverId: number | null;
  onDragStart: (posId: number, parentId: number | null, idx: number) => void;
  onDragOver: (e: React.DragEvent, posId: number) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent, posId: number, parentId: number | null, idx: number) => void;
  parentId?: number | null;
}) => {
  const code = `POS${String(position.id).padStart(5, "0")}`;
  const isOver = dragOverId === position.id;
  const isDragging = isDraggingId === position.id;
  const children = position.children || [];
  const parentId = (arguments[0] as any).parentId ?? null;

  return (
    <div className="relative">
      <div
        className={`relative flex items-start transition-opacity ${isDragging ? "opacity-40" : ""}`}
        draggable
        onDragStart={(e) => { e.stopPropagation(); onDragStart(position.id, parentId, index); }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); onDragOver(e, position.id); }}
        onDragEnd={onDragEnd}
        onDrop={(e) => { e.stopPropagation(); onDrop(e, position.id, parentId, index); }}
      >
        {/* Connector lines */}
        <div className="flex flex-col items-center" style={{ width: 24, minHeight: "100%" }}>
          <div className="w-0.5 bg-border" style={{ height: 28 }} />
          <div className="flex items-center" style={{ height: 0 }}>
            <div className="h-0.5 bg-border" style={{ width: 20 }} />
          </div>
          {(index < total - 1 || children.length > 0) && <div className="w-0.5 bg-border flex-1" />}
        </div>

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
            <button onClick={() => onAddSub(position)} className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="เพิ่มตำแหน่งย่อย">
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

      {/* Render children recursively */}
      {children.length > 0 && (
        <div className="ml-10">
          {children.map((child, idx) => (
            <PositionNode
              key={child.id}
              position={child}
              index={idx}
              total={children.length}
              level={level + 1}
              onEdit={onEdit}
              onAddSub={onAddSub}
              onDelete={onDelete}
              isDraggingId={isDraggingId}
              dragOverId={dragOverId}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
              onDrop={onDrop}
              parentId={position.id}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════ Main Component ═══════════════════ */
const Organization = () => {
  const { affiliations, setAffiliations } = useOrg();

  // Drag & drop state — track by position id + parent context
  const [dragInfo, setDragInfo] = useState<{ posId: number; parentId: number | null; idx: number; affId: number } | null>(null);
  const [dragOverPosId, setDragOverPosId] = useState<number | null>(null);

  const handleDragStart = (affId: number, posId: number, parentId: number | null, idx: number) => {
    setDragInfo({ posId, parentId, idx, affId });
  };

  const handleDragOver = (e: React.DragEvent, posId: number) => {
    e.preventDefault();
    setDragOverPosId(posId);
  };

  const handleDrop = (affId: number, _posId: number, parentId: number | null, toIdx: number) => {
    if (!dragInfo || dragInfo.affId !== affId || dragInfo.parentId !== parentId) {
      handleDragEnd();
      return;
    }
    const fromIdx = dragInfo.idx;
    if (fromIdx === toIdx) { handleDragEnd(); return; }

    setAffiliations((prev) =>
      prev.map((a) => {
        if (a.id !== affId) return a;
        if (parentId === null) {
          return { ...a, positions: reorderSiblings(a.positions, fromIdx, toIdx) };
        }
        return { ...a, positions: reorderInParent(a.positions, parentId, fromIdx, toIdx) };
      })
    );
    handleDragEnd();
    toast.success("เรียงลำดับตำแหน่งสำเร็จ");
  };

  const handleDragEnd = () => {
    setDragInfo(null);
    setDragOverPosId(null);
  };

  // Expanded affiliations
  const [expandedAffs, setExpandedAffs] = useState<Record<number, boolean>>(
    () => Object.fromEntries(affiliations.map((a) => [a.id, true]))
  );
  const toggleAff = (id: number) => setExpandedAffs((m) => ({ ...m, [id]: !m[id] }));

  // Dialog states
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [editingPos, setEditingPos] = useState<Position | null>(null);
  const [editingAffId, setEditingAffId] = useState<number | null>(null);
  const [deletingPos, setDeletingPos] = useState<{ pos: Position; affId: number } | null>(null);
  const [addAffId, setAddAffId] = useState<number | null>(null);
  const [addParentPos, setAddParentPos] = useState<Position | null>(null);

  const [formName, setFormName] = useState("");

  // Stats
  const totalPositions = affiliations.reduce((s, a) => s + countAllPositions(a.positions), 0);

  // Handlers
  const handleAddRoot = (affId: number) => {
    setAddAffId(affId);
    setAddParentPos(null);
    setFormName("");
    setAddOpen(true);
  };

  const handleAddSub = (parentPos: Position, affId: number) => {
    setAddAffId(affId);
    setAddParentPos(parentPos);
    setFormName("");
    setAddOpen(true);
  };

  const handleAddSave = () => {
    if (!formName.trim()) { toast.error("กรุณากรอกชื่อตำแหน่ง"); return; }
    const newPos: Position = { id: Date.now(), name: formName.trim() };

    setAffiliations((prev) =>
      prev.map((a) => {
        if (a.id !== addAffId) return a;
        if (!addParentPos) {
          return { ...a, positions: [...a.positions, newPos] };
        }
        return { ...a, positions: addChildToPosition(a.positions, addParentPos.id, newPos) };
      })
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
    if (!formName.trim() || !editingPos) { toast.error("กรุณากรอกชื่อตำแหน่ง"); return; }
    setAffiliations((prev) =>
      prev.map((a) =>
        a.id === editingAffId
          ? { ...a, positions: updatePositionName(a.positions, editingPos.id, formName.trim()) }
          : a
      )
    );
    setEditOpen(false);
    toast.success("แก้ไขตำแหน่งสำเร็จ");
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
          ? { ...a, positions: removePosition(a.positions, deletingPos.pos.id) }
          : a
      )
    );
    setDeleteOpen(false);
    toast.success(`ลบตำแหน่ง "${deletingPos.pos.name}" สำเร็จ`);
  };

  const childrenCount = (deletingPos?.pos.children?.length || 0);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display">โครงสร้างตำแหน่ง</h2>
          <p className="text-sm text-muted-foreground mt-0.5">จัดการโครงสร้างตำแหน่งงานตามสังกัด</p>
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
            <button
              onClick={() => toggleAff(aff.id)}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary text-primary-foreground font-bold text-sm">
                {aff.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{aff.name}</p>
                <p className="text-xs text-muted-foreground">{countAllPositions(aff.positions)} ตำแหน่ง</p>
              </div>
              {isExpanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
            </button>

            {isExpanded && (
              <div className="px-5 pb-4">
                <div className="flex items-center gap-3 mb-1">
                  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-primary/5 border-2 border-primary/20 min-w-[200px] max-w-xs">
                    <Building2 className="w-5 h-5 text-primary flex-shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-bold text-foreground">โครงสร้างตำแหน่ง</span>
                      <span className="text-xs text-muted-foreground">{aff.name}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddRoot(aff.id)}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    title="เพิ่มตำแหน่งหลัก"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="ml-6">
                  {aff.positions.map((pos, idx) => (
                    <PositionNode
                      key={pos.id}
                      position={pos}
                      index={idx}
                      total={aff.positions.length}
                      level={0}
                      onEdit={(p) => handleEdit(p, aff.id)}
                      onAddSub={(p) => handleAddSub(p, aff.id)}
                      onDelete={(p) => handleDeleteClick(p, aff.id)}
                      isDraggingId={dragInfo?.affId === aff.id ? dragInfo.posId : null}
                      dragOverId={dragInfo?.affId === aff.id ? dragOverPosId : null}
                      onDragStart={(posId, parentId, i) => handleDragStart(aff.id, posId, parentId, i)}
                      onDragOver={handleDragOver}
                      onDragEnd={handleDragEnd}
                      onDrop={(e, posId, parentId, i) => handleDrop(aff.id, posId, parentId, i)}
                      parentId={null}
                    />
                  ))}
                  {aff.positions.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4 pl-8">ยังไม่มีตำแหน่ง — กดปุ่ม + เพื่อเพิ่ม</p>
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
              <Plus className="w-5 h-5 text-primary" />
              {addParentPos ? "เพิ่มตำแหน่งย่อย" : "เพิ่มตำแหน่งใหม่"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">สังกัด</label>
              <p className="text-sm font-semibold text-foreground">
                {affiliations.find((a) => a.id === addAffId)?.name}
              </p>
            </div>
            {addParentPos && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">ตำแหน่งหลัก</label>
                <p className="text-sm font-semibold text-primary">{addParentPos.name}</p>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                ชื่อตำแหน่ง{addParentPos ? "ย่อย" : ""} <span className="text-destructive">*</span>
              </label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={addParentPos ? "เช่น ช่างเทคนิค" : "เช่น เจ้าหน้าที่วิจัย"}
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
              {childrenCount > 0 && (
                <span className="block mt-1 text-destructive font-medium">
                  ⚠️ ตำแหน่งนี้มีตำแหน่งย่อย {childrenCount} รายการ ซึ่งจะถูกลบทั้งหมด
                </span>
              )}
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
