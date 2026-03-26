import { useState, useMemo } from "react"; // unified org tree
import { Plus, Edit, Trash2, Building2, Users, ChevronDown, ChevronRight, GripVertical, UserPlus, X, Crown, Network } from "lucide-react";
import { useOrg, type Affiliation, type Position, type OrgLevel } from "@/contexts/OrgContext";
import { useEmployees, type Employee } from "@/contexts/EmployeeContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import EmployeeAvatarShared from "@/components/ui/employee-avatar";

/* ═══════════════════ Helpers ═══════════════════ */
const countAllPositions = (positions: Position[]): number =>
  positions.reduce((s, p) => s + 1 + countAllPositions(p.children || []), 0);

/* ═══════════════════ Employee Avatar ═══════════════════ */
const OrgEmployeeAvatar = ({ emp, size = "sm" }: { emp: Employee; size?: "sm" | "md" }) => {
  const dim = size === "sm" ? "w-7 h-7" : "w-9 h-9";
  return (
    <div className={`${dim} border-2 border-background shadow-sm rounded-full overflow-hidden flex-shrink-0`}>
      <EmployeeAvatarShared photoUrl={emp.photoUrl} avatar={emp.avatar} avatarColor={emp.avatarColor} avatarTextColor={emp.avatarTextColor} firstName={emp.firstName} size={size === "sm" ? "xs" : "md"} rounded="full" className="w-full h-full" />
    </div>
  );
};

/* ═══════════════════ Position Tree Node ═══════════════════ */
const PositionNode = ({
  position, index, total, level = 0,
  onEdit, onAddSub, onDelete, onAssign,
  isDraggingId, dragOverId,
  onDragStart, onDragOver, onDragEnd, onDrop,
  parentId = null,
  employeeMap,
  isHead,
  canManage = false,
}: {
  position: Position; index: number; total: number; level?: number;
  onEdit: (p: Position) => void;
  onAddSub: (parentPos: Position) => void;
  onDelete: (p: Position) => void;
  onAssign: (p: Position) => void;
  isDraggingId: string | null;
  dragOverId: string | null;
  onDragStart: (posId: string, parentId: string | null, idx: number) => void;
  onDragOver: (e: React.DragEvent, posId: string) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent, posId: string, parentId: string | null, idx: number) => void;
  parentId?: string | null;
  employeeMap: Map<string, Employee[]>;
  isHead: boolean;
  canManage?: boolean;
}) => {
  const isOver = dragOverId === position.id;
  const isDragging = isDraggingId === position.id;
  const children = position.children || [];
  const assignedEmployees = employeeMap.get(position.id) || [];
  const isLast = index === total - 1;

  return (
    <div className="relative">
      {!isLast && <div className="absolute left-[11px] top-0 bottom-0 w-0.5 bg-border" />}
      <div
        className={`relative flex items-center transition-opacity ${isDragging ? "opacity-40" : ""}`}
        draggable={canManage}
        onDragStart={canManage ? (e) => { e.stopPropagation(); onDragStart(position.id, parentId, index); } : undefined}
        onDragOver={canManage ? (e) => { e.preventDefault(); e.stopPropagation(); onDragOver(e, position.id); } : undefined}
        onDragEnd={canManage ? onDragEnd : undefined}
        onDrop={canManage ? (e) => { e.stopPropagation(); onDrop(e, position.id, parentId, index); } : undefined}
      >
        <div className="absolute left-[11px] top-0 h-1/2 w-0.5 bg-border" />
        <div className="absolute left-[11px] top-1/2 w-[13px] h-0.5 bg-border" />
        <div style={{ width: 24, flexShrink: 0 }} />

        <div className="flex items-center gap-3 py-2 flex-1 min-w-0 flex-wrap">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl bg-card border-2 shadow-sm min-w-[200px] max-w-sm transition-all hover:shadow-md ${canManage ? "cursor-grab active:cursor-grabbing" : ""} ${isOver ? "border-primary ring-2 ring-primary/20" : "border-border"}`}>
            {canManage && <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {isHead && <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                <span className="text-sm font-bold text-foreground truncate">{position.name}</span>
              </div>
              {assignedEmployees.length > 0 ? (
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  <div className="flex -space-x-1.5">
                    {assignedEmployees.slice(0, 4).map((emp) => (
                      <OrgEmployeeAvatar key={emp.id} emp={emp} size="sm" />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground ml-1.5 truncate">
                    {assignedEmployees.length <= 2
                      ? assignedEmployees.map(e => `${e.firstName} ${e.lastName?.charAt(0) || ""}.`).join(", ")
                      : `${assignedEmployees[0].firstName} +${assignedEmployees.length - 1}`}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground/60 mt-1">ยังไม่ระบุบุคคล</span>
              )}
            </div>
          </div>

          {canManage && (
            <div className="flex items-center gap-1.5">
              <button onClick={() => onAssign(position)} className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors" title="กำหนดบุคคล">
                <UserPlus className="w-4 h-4" />
              </button>
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
          )}
        </div>
      </div>

      {children.length > 0 && (
        <div className="relative ml-[35px]">
          {children.map((child, idx) => (
            <PositionNode
              key={child.id} position={child} index={idx} total={children.length} level={level + 1}
              onEdit={onEdit} onAddSub={onAddSub} onDelete={onDelete} onAssign={onAssign}
              isDraggingId={isDraggingId} dragOverId={dragOverId}
              onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDrop={onDrop}
              parentId={position.id}
              employeeMap={employeeMap}
              isHead={false}
              canManage={canManage}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════ OrgLevel Tree Node ═══════════════════ */
const OrgLevelNode = ({
  node, index, total, affiliations, canManage, canAdd,
  onEdit, onDelete, onAddChild,
  renderAffiliation,
}: {
  node: OrgLevel; index: number; total: number;
  affiliations: Affiliation[];
  canManage: boolean; canAdd: boolean;
  onEdit: (o: OrgLevel) => void;
  onDelete: (o: OrgLevel) => void;
  onAddChild: (parentId: string) => void;
  renderAffiliation: (aff: Affiliation) => React.ReactNode;
}) => {
  const children = node.children || [];
  const isLast = index === total - 1;
  // Find affiliations attached to this org_level
  const attachedAffs = affiliations.filter(a => a.parent_org_level_id === node.id);

  return (
    <div className="relative">
      {!isLast && <div className="absolute left-[11px] top-0 bottom-0 w-0.5 bg-border" />}
      <div className="relative flex items-center">
        <div className="absolute left-[11px] top-0 h-1/2 w-0.5 bg-border" />
        <div className="absolute left-[11px] top-1/2 w-[13px] h-0.5 bg-border" />
        <div style={{ width: 24, flexShrink: 0 }} />

        <div className="flex items-center gap-3 py-2 flex-1 min-w-0 flex-wrap">
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card border-2 border-primary/20 shadow-sm min-w-[200px] max-w-sm">
            <Network className="w-5 h-5 text-primary flex-shrink-0" />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-bold text-foreground truncate">{node.name}</span>
              <span className="text-xs text-muted-foreground">ระดับองค์กร</span>
            </div>
          </div>
          {canManage && (
            <div className="flex items-center gap-1.5">
              <button onClick={() => onAddChild(node.id)} className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="เพิ่มระดับย่อย">
                <Plus className="w-4 h-4" />
              </button>
              <button onClick={() => onEdit(node)} className="w-8 h-8 rounded-full flex items-center justify-center bg-accent text-accent-foreground hover:bg-accent/80 transition-colors" title="แก้ไข">
                <Edit className="w-4 h-4" />
              </button>
              <button onClick={() => onDelete(node)} className="w-8 h-8 rounded-full flex items-center justify-center bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors" title="ลบ">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Children: sub org levels + attached affiliations */}
      {(children.length > 0 || attachedAffs.length > 0) && (
        <div className="relative ml-[35px]">
          {children.map((child, idx) => (
            <OrgLevelNode
              key={child.id} node={child} index={idx} total={children.length + attachedAffs.length}
              affiliations={affiliations} canManage={canManage} canAdd={canAdd}
              onEdit={onEdit} onDelete={onDelete} onAddChild={onAddChild}
              renderAffiliation={renderAffiliation}
            />
          ))}
          {attachedAffs.map((aff, idx) => (
            <div key={aff.id} className="relative">
              {idx < attachedAffs.length - 1 && <div className="absolute left-[11px] top-0 bottom-0 w-0.5 bg-border" />}
              <div className="relative">
                <div className="absolute left-[11px] top-0 h-1/2 w-0.5 bg-border" />
                <div className="absolute left-[11px] top-1/2 w-[13px] h-0.5 bg-border" />
                <div style={{ width: 24, flexShrink: 0 }} />
                <div className="ml-6">
                  {renderAffiliation(aff)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════ Main Component ═══════════════════ */
const Organization = () => {
  const { affiliations, orgLevels, addPosition, updatePosition, deletePosition, reorderPositions, loading,
    addOrgLevel, updateOrgLevel, deleteOrgLevel } = useOrg();
  const { employees, updateEmployee } = useEmployees();
  const { canAction } = usePermissions();
  const { role } = useAuth();
  const { programName, updateProgramName } = useBranding();
  const canManage = canAction(role, "organization", "edit");
  const canAdd = canAction(role, "organization", "add");
  const canDelete = canAction(role, "organization", "delete");

  // Build position → employees map
  const positionEmployeeMap = useMemo(() => {
    const map = new Map<string, Employee[]>();
    employees.forEach((emp) => {
      if (emp.positionId) {
        const list = map.get(emp.positionId) || [];
        list.push(emp);
        map.set(emp.positionId, list);
      }
    });
    return map;
  }, [employees]);

  // Drag state
  const [dragInfo, setDragInfo] = useState<{ posId: string; parentId: string | null; idx: number; affId: string } | null>(null);
  const [dragOverPosId, setDragOverPosId] = useState<string | null>(null);

  const handleDragStart = (affId: string, posId: string, parentId: string | null, idx: number) => {
    setDragInfo({ posId, parentId, idx, affId });
  };
  const handleDragOver = (e: React.DragEvent, posId: string) => { e.preventDefault(); setDragOverPosId(posId); };
  const handleDrop = async (affId: string, _posId: string, parentId: string | null, toIdx: number) => {
    if (!dragInfo || dragInfo.affId !== affId || dragInfo.parentId !== parentId) { handleDragEnd(); return; }
    const fromIdx = dragInfo.idx;
    if (fromIdx === toIdx) { handleDragEnd(); return; }
    const aff = affiliations.find((a) => a.id === affId);
    if (!aff) { handleDragEnd(); return; }
    let siblings: Position[];
    if (parentId === null) { siblings = [...aff.positions]; }
    else {
      const findChildren = (positions: Position[], pid: string): Position[] | null => {
        for (const p of positions) {
          if (p.id === pid) return p.children || [];
          const found = findChildren(p.children || [], pid);
          if (found) return found;
        }
        return null;
      };
      siblings = [...(findChildren(aff.positions, parentId) || [])];
    }
    const [moved] = siblings.splice(fromIdx, 1);
    siblings.splice(toIdx, 0, moved);
    await reorderPositions(siblings.map((s) => s.id));
    handleDragEnd();
    toast.success("เรียงลำดับตำแหน่งสำเร็จ");
  };
  const handleDragEnd = () => { setDragInfo(null); setDragOverPosId(null); };

  // Expanded affiliations
  const [expandedAffs, setExpandedAffs] = useState<Record<string, boolean>>({});
  const toggleAff = (id: string) => setExpandedAffs((m) => ({ ...m, [id]: !m[id] }));

  // Position Dialogs
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editingPos, setEditingPos] = useState<Position | null>(null);
  const [deletingPos, setDeletingPos] = useState<Position | null>(null);
  const [assigningPos, setAssigningPos] = useState<Position | null>(null);
  const [addAffId, setAddAffId] = useState<string | null>(null);
  const [addParentPos, setAddParentPos] = useState<Position | null>(null);
  const [formName, setFormName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // OrgLevel Dialogs
  const [orgLevelDialogOpen, setOrgLevelDialogOpen] = useState(false);
  const [orgLevelDeleteOpen, setOrgLevelDeleteOpen] = useState(false);
  const [editingOrgLevel, setEditingOrgLevel] = useState<OrgLevel | null>(null);
  const [deletingOrgLevel, setDeletingOrgLevel] = useState<OrgLevel | null>(null);
  const [orgLevelFormName, setOrgLevelFormName] = useState("");
  const [orgLevelParentId, setOrgLevelParentId] = useState<string | null>(null);

  // Company rename dialog
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const totalPositions = affiliations.reduce((s, a) => s + countAllPositions(a.positions), 0);
  const totalAssigned = employees.filter(e => e.positionId).length;

  // Position handlers
  const handleAddRoot = (affId: string) => { setAddAffId(affId); setAddParentPos(null); setFormName(""); setAddOpen(true); };
  const handleAddSub = (parentPos: Position, affId: string) => { setAddAffId(affId); setAddParentPos(parentPos); setFormName(""); setAddOpen(true); };
  const handleAddSave = async () => {
    if (!formName.trim() || !addAffId) { toast.error("กรุณากรอกชื่อตำแหน่ง"); return; }
    setSaving(true);
    await addPosition(addAffId, addParentPos?.id || null, formName.trim());
    setSaving(false); setAddOpen(false);
    toast.success(`เพิ่มตำแหน่ง "${formName}" สำเร็จ`);
  };
  const handleEdit = (pos: Position) => { setEditingPos(pos); setFormName(pos.name); setEditOpen(true); };
  const handleEditSave = async () => {
    if (!formName.trim() || !editingPos) { toast.error("กรุณากรอกชื่อตำแหน่ง"); return; }
    setSaving(true);
    await updatePosition(editingPos.id, formName.trim());
    setSaving(false); setEditOpen(false);
    toast.success("แก้ไขตำแหน่งสำเร็จ");
  };
  const handleDeleteClick = (pos: Position) => { setDeletingPos(pos); setDeleteOpen(true); };
  const handleDeleteConfirm = async () => {
    if (!deletingPos) return;
    setSaving(true);
    await deletePosition(deletingPos.id);
    setSaving(false); setDeleteOpen(false);
    toast.success(`ลบตำแหน่ง "${deletingPos.name}" สำเร็จ`);
  };

  // Assign employee
  const handleAssignClick = (pos: Position) => { setAssigningPos(pos); setSearchTerm(""); setAssignOpen(true); };
  const assignedToThisPos = useMemo(() => {
    if (!assigningPos) return [];
    return positionEmployeeMap.get(assigningPos.id) || [];
  }, [assigningPos, positionEmployeeMap]);
  const availableEmployees = useMemo(() => {
    const assigned = assignedToThisPos.map(e => e.id);
    return employees
      .filter(e => e.status === "active" && !assigned.includes(e.id))
      .filter(e => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return `${e.firstName} ${e.lastName}`.toLowerCase().includes(term) || e.nickname.toLowerCase().includes(term);
      });
  }, [employees, assignedToThisPos, searchTerm]);
  const handleAssignEmployee = async (empId: string) => {
    if (!assigningPos) return;
    await updateEmployee(empId, { positionId: assigningPos.id } as any);
    toast.success("กำหนดบุคคลสำเร็จ");
  };
  const handleUnassignEmployee = async (empId: string) => {
    await updateEmployee(empId, { positionId: undefined } as any);
    toast.success("ยกเลิกการกำหนดบุคคลสำเร็จ");
  };

  // OrgLevel handlers
  const openAddOrgLevel = (parentId: string | null) => {
    setEditingOrgLevel(null); setOrgLevelFormName(""); setOrgLevelParentId(parentId); setOrgLevelDialogOpen(true);
  };
  const openEditOrgLevel = (o: OrgLevel) => {
    setEditingOrgLevel(o); setOrgLevelFormName(o.name); setOrgLevelDialogOpen(true);
  };
  const handleSaveOrgLevel = async () => {
    if (!orgLevelFormName.trim()) { toast.error("กรุณากรอกชื่อ"); return; }
    setSaving(true);
    if (editingOrgLevel) {
      await updateOrgLevel(editingOrgLevel.id, orgLevelFormName.trim());
      toast.success("แก้ไขระดับองค์กรสำเร็จ");
    } else {
      await addOrgLevel(orgLevelFormName.trim(), orgLevelParentId);
      toast.success("เพิ่มระดับองค์กรสำเร็จ");
    }
    setSaving(false); setOrgLevelDialogOpen(false);
  };
  const handleDeleteOrgLevel = async () => {
    if (!deletingOrgLevel) return;
    setSaving(true);
    await deleteOrgLevel(deletingOrgLevel.id);
    setSaving(false); setOrgLevelDeleteOpen(false);
    toast.success(`ลบ "${deletingOrgLevel.name}" สำเร็จ`);
  };

  const childrenCount = deletingPos?.children?.length || 0;

  // Render a single affiliation block (reused in tree)
  const renderAffiliation = (aff: Affiliation) => {
    const isExpanded = expandedAffs[aff.id] ?? true;
    return (
      <div className="card-base overflow-hidden my-2">
        <button onClick={() => toggleAff(aff.id)}
          className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/50 transition-colors text-left">
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
              {canAdd && (
                <button onClick={() => handleAddRoot(aff.id)}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  title="เพิ่มตำแหน่งหลัก">
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="relative ml-6">
              {aff.positions.length > 0 && <div className="absolute left-[11px] top-0 h-4 w-0.5 bg-border" />}
              <div className="pt-2">
                {aff.positions.map((pos, idx) => (
                  <PositionNode
                    key={pos.id} position={pos} index={idx} total={aff.positions.length} level={0}
                    onEdit={handleEdit}
                    onAddSub={(p) => handleAddSub(p, aff.id)}
                    onDelete={handleDeleteClick}
                    onAssign={handleAssignClick}
                    isDraggingId={dragInfo?.affId === aff.id ? dragInfo.posId : null}
                    dragOverId={dragInfo?.affId === aff.id ? dragOverPosId : null}
                    onDragStart={(posId, pId, i) => handleDragStart(aff.id, posId, pId, i)}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                    onDrop={(e, posId, pId, i) => handleDrop(aff.id, posId, pId, i)}
                    parentId={null}
                    employeeMap={positionEmployeeMap}
                    isHead={idx === 0}
                    canManage={canManage}
                  />
                ))}
              </div>
              {aff.positions.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 pl-8">ยังไม่มีตำแหน่ง — กดปุ่ม + เพื่อเพิ่ม</p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Affiliations without a parent org_level (shown at root level)
  const rootAffiliations = affiliations.filter(a => !a.parent_org_level_id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display">โครงสร้างองค์กร</h2>
          <p className="text-sm text-muted-foreground mt-0.5">แผนผังโครงสร้างองค์กรแบบรวมศูนย์</p>
        </div>
        {canAdd && (
          <button onClick={() => openAddOrgLevel(null)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-all">
            <Plus className="w-4 h-4" /> เพิ่มระดับองค์กร
          </button>
        )}
      </div>

      {/* Summary stats */}
      <div className="card-base p-4">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10">
              <Network className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">ระดับองค์กร</p>
              <p className="text-sm font-bold">{orgLevels.length}</p>
            </div>
          </div>
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
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/10">
              <UserPlus className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">กำหนดบุคคลแล้ว</p>
              <p className="text-sm font-bold">{totalAssigned} / {employees.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ Unified Org Tree ═══════════ */}
      <div className="card-base overflow-hidden p-5">
        {/* Company Root */}
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-primary/10 border-2 border-primary/30 min-w-[220px] max-w-md">
            <Building2 className="w-6 h-6 text-primary flex-shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-base font-bold text-foreground truncate">{programName || "บริษัท"}</span>
              <span className="text-xs text-muted-foreground">บริษัท / องค์กร</span>
            </div>
          </div>
        </div>

        {/* Org Levels tree */}
        <div className="relative ml-6">
          {(orgLevels.length > 0 || rootAffiliations.length > 0) && (
            <div className="absolute left-[11px] top-0 h-4 w-0.5 bg-border" />
          )}
          <div className="pt-2">
            {orgLevels.map((ol, idx) => (
              <OrgLevelNode
                key={ol.id} node={ol} index={idx} total={orgLevels.length + rootAffiliations.length}
                affiliations={affiliations} canManage={canManage} canAdd={canAdd}
                onEdit={openEditOrgLevel}
                onDelete={(o) => { setDeletingOrgLevel(o); setOrgLevelDeleteOpen(true); }}
                onAddChild={(parentId) => openAddOrgLevel(parentId)}
                renderAffiliation={renderAffiliation}
              />
            ))}
            {/* Root-level affiliations (no parent org_level) */}
            {rootAffiliations.map((aff, idx) => (
              <div key={aff.id} className="relative">
                {idx < rootAffiliations.length - 1 && <div className="absolute left-[11px] top-0 bottom-0 w-0.5 bg-border" />}
                <div className="relative">
                  <div className="absolute left-[11px] top-0 h-1/2 w-0.5 bg-border" />
                  <div className="absolute left-[11px] top-1/2 w-[13px] h-0.5 bg-border" />
                  <div style={{ width: 24, flexShrink: 0 }} />
                  <div className="ml-6">
                    {renderAffiliation(aff)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {orgLevels.length === 0 && affiliations.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">ยังไม่มีโครงสร้าง — เพิ่มระดับองค์กรหรือสังกัดในหน้าตั้งค่า</p>
        )}
      </div>

      {/* ═══════════ Dialogs ═══════════ */}
      {/* Add Position Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              {addParentPos ? "เพิ่มตำแหน่งย่อย" : "เพิ่มตำแหน่งใหม่"}
            </DialogTitle>
            <DialogDescription className="sr-only">กรอกข้อมูลตำแหน่งใหม่</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">สังกัด</label>
              <p className="text-sm font-semibold text-foreground">{affiliations.find((a) => a.id === addAffId)?.name}</p>
            </div>
            {addParentPos && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">ตำแหน่งหลัก</label>
                <p className="text-sm font-semibold text-primary">{addParentPos.name}</p>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">ชื่อตำแหน่ง{addParentPos ? "ย่อย" : ""} <span className="text-destructive">*</span></label>
              <input value={formName} onChange={(e) => setFormName(e.target.value)}
                placeholder={addParentPos ? "เช่น ช่างเทคนิค" : "เช่น เจ้าหน้าที่วิจัย"}
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/30 outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <button className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">ยกเลิก</button>
            </DialogClose>
            <button onClick={handleAddSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-all disabled:opacity-50">
              <Plus className="w-4 h-4" /> เพิ่ม
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Position Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit className="w-5 h-5 text-primary" /> แก้ไขตำแหน่ง</DialogTitle>
            <DialogDescription className="sr-only">แก้ไขข้อมูลตำแหน่ง</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">ชื่อตำแหน่ง <span className="text-destructive">*</span></label>
              <input value={formName} onChange={(e) => setFormName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/30 outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <button className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">ยกเลิก</button>
            </DialogClose>
            <button onClick={handleEditSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-all disabled:opacity-50">
              <Edit className="w-4 h-4" /> บันทึก
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Position Confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Trash2 className="w-5 h-5 text-destructive" /> ยืนยันการลบ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบตำแหน่ง <strong>"{deletingPos?.name}"</strong> หรือไม่?
              {childrenCount > 0 && (
                <span className="block mt-2 text-destructive font-semibold">⚠️ ตำแหน่งนี้มีตำแหน่งย่อย {childrenCount} ตำแหน่ง — จะถูกลบทั้งหมด</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={saving} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">ลบ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Employee Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5 text-blue-600" /> กำหนดบุคคลในตำแหน่ง</DialogTitle>
            <DialogDescription className="sr-only">เลือกพนักงานเพื่อกำหนดในตำแหน่ง</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="px-3 py-2 rounded-xl bg-primary/5 border border-primary/20">
              <p className="text-xs text-muted-foreground">ตำแหน่ง</p>
              <p className="text-sm font-bold text-foreground">{assigningPos?.name}</p>
            </div>
            {assignedToThisPos.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">บุคลากรในตำแหน่งนี้</p>
                <div className="space-y-1.5">
                  {assignedToThisPos.map((emp) => (
                    <div key={emp.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-card border border-border">
                      <OrgEmployeeAvatar emp={emp} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{emp.prefix}{emp.firstName} {emp.lastName}</p>
                        <p className="text-xs text-muted-foreground">{emp.dept} • {emp.position}</p>
                      </div>
                      <button onClick={() => handleUnassignEmployee(emp.id)}
                        className="w-7 h-7 rounded-full flex items-center justify-center bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors" title="ยกเลิก">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">เพิ่มบุคคล</p>
              <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหาชื่อพนักงาน..."
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/30 outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
              <div className="max-h-48 overflow-y-auto space-y-1">
                {availableEmployees.slice(0, 20).map((emp) => (
                  <button key={emp.id} onClick={() => handleAssignEmployee(emp.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted/50 transition-colors text-left">
                    <OrgEmployeeAvatar emp={emp} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{emp.prefix}{emp.firstName} {emp.lastName}</p>
                      <p className="text-xs text-muted-foreground">{emp.dept} • {emp.position}</p>
                    </div>
                    <Plus className="w-4 h-4 text-primary flex-shrink-0" />
                  </button>
                ))}
                {availableEmployees.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">ไม่พบพนักงาน</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <button className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">ปิด</button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OrgLevel Add/Edit Dialog */}
      <Dialog open={orgLevelDialogOpen} onOpenChange={setOrgLevelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Network className="w-5 h-5 text-primary" />
              {editingOrgLevel ? "แก้ไขระดับองค์กร" : "เพิ่มระดับองค์กร"}
            </DialogTitle>
            <DialogDescription className="sr-only">จัดการระดับองค์กร</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">ชื่อระดับ <span className="text-destructive">*</span></label>
              <input value={orgLevelFormName} onChange={(e) => setOrgLevelFormName(e.target.value)}
                placeholder="เช่น ผู้อำนวยการ, หัวหน้า"
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/30 outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <button className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">ยกเลิก</button>
            </DialogClose>
            <button onClick={handleSaveOrgLevel} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-all disabled:opacity-50">
              {editingOrgLevel ? <Edit className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editingOrgLevel ? "บันทึก" : "เพิ่ม"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OrgLevel Delete Confirm */}
      <AlertDialog open={orgLevelDeleteOpen} onOpenChange={setOrgLevelDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Trash2 className="w-5 h-5 text-destructive" /> ยืนยันการลบ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบระดับ <strong>"{deletingOrgLevel?.name}"</strong> หรือไม่? ระดับย่อยทั้งหมดจะถูกลบด้วย
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteOrgLevel} disabled={saving} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">ลบ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Organization;
