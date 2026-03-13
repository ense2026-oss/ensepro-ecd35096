import { useState, useCallback } from "react";
import {
  Plus, ChevronRight, ChevronDown, Building2, Users, Phone, Mail,
  MapPin, Edit, Trash2, X, Save, Search, ZoomIn, ZoomOut, Maximize2,
  GripVertical, AlertCircle
} from "lucide-react";
import { useEmployees } from "@/contexts/EmployeeContext";
import { useOrg, genId, countNodes, countDepts, type OrgNode } from "@/contexts/OrgContext";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

/* ═══════════════════ Form Field Components ═══════════════════ */
const FormInput = ({ label, value, onChange, type = "text", placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean;
}) => (
  <div className="space-y-1.5">
    <label className="text-xs font-medium text-muted-foreground">
      {label} {required && <span className="text-destructive">*</span>}
    </label>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/30 outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
  </div>
);

/* ═══════════════════ Color Map ═══════════════════ */
const colorMap: Record<number, { bg: string; text: string; border: string }> = {
  0: { bg: "hsl(31 100% 95%)", text: "#FF870F", border: "#FF870F" },
  1: { bg: "hsl(0 0% 8%)", text: "#FFFFFF", border: "#FF870F" },
  2: { bg: "hsl(90 100% 92%)", text: "hsl(90 100% 30%)", border: "hsl(90 100% 50%)" },
  3: { bg: "hsl(var(--card))", text: "hsl(var(--foreground))", border: "hsl(var(--border))" },
};

/* ═══════════════════ OrgNodeCard ═══════════════════ */
const OrgNodeCard = ({
  node, level = 0, onEdit, onAdd, onDelete, expandedMap, toggleExpand,
}: {
  node: OrgNode; level?: number;
  onEdit: (n: OrgNode) => void;
  onAdd: (parentId: string, parentDept: string) => void;
  onDelete: (n: OrgNode) => void;
  expandedMap: Record<string, boolean>;
  toggleExpand: (id: string) => void;
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const colors = colorMap[Math.min(level, 3)];
  const expanded = expandedMap[node.id] ?? level < 2;

  return (
    <div className="flex flex-col items-center">
      {/* Card */}
      <div
        className="relative w-56 rounded-2xl p-4 border-2 transition-all duration-200 hover:shadow-lg group"
        style={{ background: colors.bg, borderColor: colors.border, color: colors.text, boxShadow: "var(--shadow-card)" }}
      >
        {level === 1 && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ background: "#FF870F", color: "#fff" }}>
            CEO
          </div>
        )}

        {/* Header row */}
        <div className="flex items-start justify-between mb-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{
              background: level === 0 ? "#FF870F" : level === 1 ? "#FF870F" : "rgba(0,0,0,0.1)",
              color: level <= 1 ? "#fff" : colors.text,
            }}>
            {level === 0 ? <Building2 className="w-5 h-5" /> : node.name.charAt(0)}
          </div>
          <div className="flex items-center gap-1">
            {hasChildren && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(0,0,0,0.1)" }}>
                <Users className="w-3 h-3" /> {node.children!.length}
              </span>
            )}
            {hasChildren && (
              <button onClick={() => toggleExpand(node.id)}
                className="w-5 h-5 rounded-full flex items-center justify-center cursor-pointer" style={{ background: "rgba(0,0,0,0.1)" }}>
                {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>

        {/* Info */}
        <p className="text-xs font-bold leading-tight mb-0.5 truncate">{node.name}</p>
        <p className="text-xs leading-tight truncate opacity-70">{node.position}</p>
        <p className="text-xs font-medium mt-1 truncate" style={{ color: level === 1 ? "#FFFF0F" : "#FF870F" }}>
          {node.dept}
        </p>

        {/* Contact */}
        <div className="flex flex-col gap-0.5 mt-2 text-xs opacity-60">
          {node.email && (
            <div className="flex items-center gap-1 truncate"><Mail className="w-3 h-3 flex-shrink-0" /> {node.email}</div>
          )}
          {node.phone && (
            <div className="flex items-center gap-1 truncate"><Phone className="w-3 h-3 flex-shrink-0" /> {node.phone}</div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-1 mt-3 pt-2 border-t" style={{ borderColor: "rgba(0,0,0,0.1)" }}>
          <button onClick={() => onEdit(node)}
            className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-xs font-medium transition-colors hover:opacity-80"
            style={{ background: "rgba(0,0,0,0.08)" }}>
            <Edit className="w-3 h-3" /> แก้ไข
          </button>
          <button onClick={() => onAdd(node.id, node.dept)}
            className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-xs font-medium transition-colors hover:opacity-80"
            style={{ background: "rgba(0,0,0,0.08)" }}>
            <Plus className="w-3 h-3" /> เพิ่ม
          </button>
          {level > 0 && (
            <button onClick={() => onDelete(node)}
              className="flex items-center justify-center gap-1 py-1 px-2 rounded-lg text-xs font-medium transition-colors hover:opacity-80"
              style={{ background: "rgba(220,38,38,0.1)", color: level === 1 ? "#fca5a5" : "#dc2626" }}>
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div className="relative mt-6">
          <div className="absolute left-1/2 -translate-x-1/2 -top-6 w-0.5 h-6" style={{ background: "#FF870F" }} />
          <div className="flex gap-6 items-start">
            {node.children!.map((child, idx) => (
              <div key={child.id} className="relative flex flex-col items-center">
                {node.children!.length > 1 && (
                  <div className="absolute -top-3 h-0.5"
                    style={{
                      background: "hsl(var(--border))",
                      width: idx === 0 || idx === node.children!.length - 1 ? "50%" : "100%",
                      left: idx === 0 ? "50%" : "0",
                      right: idx === node.children!.length - 1 ? "50%" : "0",
                    }} />
                )}
                <div className="w-0.5 h-3" style={{ background: "hsl(var(--border))" }} />
                <OrgNodeCard node={child} level={level + 1}
                  onEdit={onEdit} onAdd={onAdd} onDelete={onDelete}
                  expandedMap={expandedMap} toggleExpand={toggleExpand} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════ Main Component ═══════════════════ */
const Organization = () => {
  const { employees } = useEmployees();
  const { orgTree, updateNode, addChild, removeNode, affiliations, affiliationNames } = useOrg();
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({ "1": true, "2": true });
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog states
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [editingNode, setEditingNode] = useState<OrgNode | null>(null);
  const [deletingNode, setDeletingNode] = useState<OrgNode | null>(null);
  const [addParentId, setAddParentId] = useState("");

  // Form state
  const emptyForm = { name: "", position: "", dept: "", email: "", phone: "", headCount: 0 };
  const [form, setForm] = useState(emptyForm);
  const setField = (key: string) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  // Toggle expand
  const toggleExpand = useCallback((id: string) => {
    setExpandedMap((m) => ({ ...m, [id]: m[id] === undefined ? false : !m[id] }));
  }, []);

  const expandAll = () => {
    const map: Record<string, boolean> = {};
    const walk = (node: OrgNode) => { map[node.id] = true; node.children?.forEach(walk); };
    walk(orgTree);
    setExpandedMap(map);
  };

  const collapseAll = () => {
    setExpandedMap({ "1": true });
  };

  // Collect all names already used in org tree
  const usedNames = new Set<string>();
  const collectNames = (node: OrgNode) => {
    if (node.name) usedNames.add(node.name);
    node.children?.forEach(collectNames);
  };
  collectNames(orgTree);

  const availableEmployees = employees.filter((emp) => {
    const fullName = `${emp.prefix || ""}${emp.firstName} ${emp.lastName}`;
    return !usedNames.has(fullName);
  });

  // CRUD handlers
  const handleEdit = (node: OrgNode) => {
    setEditingNode(node);
    setForm({ name: node.name, position: node.position, dept: node.dept, email: node.email, phone: node.phone, headCount: node.headCount });
    setEditOpen(true);
  };

  const handleEditSave = () => {
    if (!editingNode || !form.name.trim() || !form.position.trim()) {
      toast.error("กรุณากรอกชื่อและตำแหน่ง");
      return;
    }
    updateNode(editingNode.id, (n) => ({
      ...n, name: form.name, position: form.position, dept: form.dept,
      email: form.email, phone: form.phone, headCount: Number(form.headCount) || 0,
    }));
    setEditOpen(false);
    toast.success(`แก้ไขข้อมูล "${form.name}" สำเร็จ`);
  };

  const handleAdd = (parentId: string, parentDept: string) => {
    setAddParentId(parentId);
    setForm({ ...emptyForm, dept: parentDept });
    setAddOpen(true);
  };

  const handleAddSave = () => {
    if (!form.name.trim() || !form.position.trim()) {
      toast.error("กรุณากรอกชื่อและตำแหน่ง");
      return;
    }
    const newNode: OrgNode = {
      id: genId(), name: form.name, position: form.position, dept: form.dept,
      email: form.email, phone: form.phone, headCount: Number(form.headCount) || 0,
    };
    addChild(addParentId, newNode);
    setExpandedMap((m) => ({ ...m, [addParentId]: true }));
    setAddOpen(false);
    toast.success(`เพิ่ม "${form.name}" สำเร็จ`);
  };

  const handleDeleteClick = (node: OrgNode) => {
    setDeletingNode(node);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!deletingNode) return;
    removeNode(deletingNode.id);
    setDeleteOpen(false);
    toast.success(`ลบ "${deletingNode.name}" สำเร็จ`);
  };

  // Search highlight - flatten tree for search
  const searchResults: OrgNode[] = [];
  if (searchTerm.trim()) {
    const walk = (node: OrgNode) => {
      const q = searchTerm.toLowerCase();
      if (node.name.toLowerCase().includes(q) || node.position.toLowerCase().includes(q) || node.dept.toLowerCase().includes(q)) {
        searchResults.push(node);
      }
      node.children?.forEach(walk);
    };
    walk(orgTree);
  }

  const totalNodes = countNodes(orgTree);
  const totalDepts = countDepts(orgTree);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display">โครงสร้างองค์กร</h2>
          <p className="text-sm text-muted-foreground mt-0.5">แผนผังลำดับชั้นและโครงสร้างการบริหาร</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleAdd(orgTree.id, orgTree.dept)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-primary-foreground transition-all"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}>
            <Plus className="w-4 h-4" /> เพิ่มหน่วยงาน
          </button>
        </div>
      </div>

      {/* Stats + Search + Controls */}
      <div className="card-base p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Stats */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "hsl(31 100% 93%)" }}>
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">หน่วยงาน</p>
                <p className="text-sm font-bold">{totalDepts}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "hsl(90 100% 92%)" }}>
                <Users className="w-4 h-4" style={{ color: "hsl(90 100% 30%)" }} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ตำแหน่งทั้งหมด</p>
                <p className="text-sm font-bold">{totalNodes}</p>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="ค้นหาตำแหน่ง..."
                className="pl-9 pr-3 py-2 text-sm rounded-xl border border-border bg-muted/30 outline-none focus:ring-2 focus:ring-primary/30 transition-all w-48" />
            </div>
            <button onClick={expandAll} className="flex items-center gap-1 px-3 py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted transition-colors">
              <ZoomIn className="w-3.5 h-3.5" /> ขยายทั้งหมด
            </button>
            <button onClick={collapseAll} className="flex items-center gap-1 px-3 py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted transition-colors">
              <ZoomOut className="w-3.5 h-3.5" /> ย่อทั้งหมด
            </button>
          </div>
        </div>
      </div>

      {/* Search Results */}
      {searchTerm.trim() && (
        <div className="card-base p-4">
          <p className="text-sm font-semibold mb-3">ผลการค้นหา "{searchTerm}" ({searchResults.length} รายการ)</p>
          {searchResults.length === 0 ? (
            <p className="text-sm text-muted-foreground">ไม่พบข้อมูลที่ตรงกัน</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {searchResults.map((r) => (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleEdit(r)}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-primary-foreground" style={{ background: "hsl(var(--primary))" }}>
                    {r.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.position} — {r.dept}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="card-base p-4">
        <div className="flex items-center gap-6 flex-wrap">
          <p className="text-sm font-semibold">คำอธิบาย:</p>
          {[
            { color: "hsl(var(--primary))", label: "บริษัท / สำนักงานใหญ่" },
            { color: "hsl(0 0% 8%)", label: "ระดับผู้บริหาร" },
            { color: "hsl(90 100% 50%)", label: "ระดับผู้จัดการ" },
            { color: "hsl(0 0% 75%)", label: "พนักงาน" },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-md border-2" style={{ background: l.color, borderColor: l.color }} />
              <span className="text-xs text-muted-foreground">{l.label}</span>
            </div>
          ))}
          <div className="ml-auto text-xs text-muted-foreground">คลิกที่ลูกศรเพื่อ Expand/Collapse</div>
        </div>
      </div>

      {/* Tree */}
      <div className="card-base p-6 overflow-x-auto">
        <div className="min-w-max">
          <OrgNodeCard node={orgTree} level={0}
            onEdit={handleEdit} onAdd={handleAdd} onDelete={handleDeleteClick}
            expandedMap={expandedMap} toggleExpand={toggleExpand} />
        </div>
      </div>

      {/* ═══ Edit Dialog ═══ */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-primary" /> แก้ไขข้อมูล
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">ชื่อพนักงาน <span className="text-destructive">*</span></label>
              <Select value={form.name} onValueChange={setField("name")}>
                <SelectTrigger className="rounded-xl border-border bg-muted/30">
                  <SelectValue placeholder="เลือกพนักงาน" />
                </SelectTrigger>
                <SelectContent>
                  {employees.filter((emp) => {
                    const fullName = `${emp.prefix || ""}${emp.firstName} ${emp.lastName}`;
                    return fullName === form.name || !usedNames.has(fullName);
                  }).map((emp) => (
                    <SelectItem key={emp.id} value={`${emp.prefix || ""}${emp.firstName} ${emp.lastName}`}>
                      {emp.prefix || ""}{emp.firstName} {emp.lastName} — {emp.position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">ตำแหน่ง <span className="text-destructive">*</span></label>
              <Select value={form.position} onValueChange={setField("position")}>
                <SelectTrigger className="rounded-xl border-border bg-muted/30"><SelectValue placeholder="เลือกตำแหน่ง" /></SelectTrigger>
                <SelectContent>
                  {(affiliations.find((a) => a.name === form.dept)?.positions || affiliations.flatMap((a) => a.positions))
                    .filter((p, i, arr) => arr.findIndex((x) => x.name === p.name) === i)
                    .map((p) => <SelectItem key={p.id + "-" + p.name} value={p.name}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">สังกัด (แผนก/หน่วยงาน)</label>
              <Select value={form.dept} onValueChange={setField("dept")}>
                <SelectTrigger className="rounded-xl border-border bg-muted/30"><SelectValue placeholder="เลือกสังกัด" /></SelectTrigger>
                <SelectContent>
                  {affiliationNames.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <FormInput label="อีเมล" value={form.email} onChange={setField("email")} type="email" />
            <FormInput label="เบอร์โทร" value={form.phone} onChange={setField("phone")} />
            <FormInput label="จำนวนคนในทีม" value={String(form.headCount)} onChange={(v) => setForm((f) => ({ ...f, headCount: Number(v) || 0 }))} type="number" />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <button className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">ยกเลิก</button>
            </DialogClose>
            <button onClick={handleEditSave}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-primary-foreground transition-all"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))" }}>
              <Save className="w-4 h-4" /> บันทึก
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Add Dialog ═══ */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" /> เพิ่มตำแหน่งใหม่
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">ชื่อพนักงาน <span className="text-destructive">*</span></label>
              <Select value={form.name} onValueChange={(val) => {
                setField("name")(val);
                const emp = employees.find((e) => `${e.prefix || ""}${e.firstName} ${e.lastName}` === val);
                if (emp) {
                  setForm((f) => ({ ...f, name: val, position: emp.position, email: emp.email || "", phone: emp.phone || "" }));
                }
              }}>
                <SelectTrigger className="rounded-xl border-border bg-muted/30">
                  <SelectValue placeholder="เลือกพนักงาน" />
                </SelectTrigger>
                <SelectContent>
                  {availableEmployees.map((emp) => (
                    <SelectItem key={emp.id} value={`${emp.prefix || ""}${emp.firstName} ${emp.lastName}`}>
                      {emp.prefix || ""}{emp.firstName} {emp.lastName} — {emp.position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">ตำแหน่ง <span className="text-destructive">*</span></label>
              <Select value={form.position} onValueChange={setField("position")}>
                <SelectTrigger className="rounded-xl border-border bg-muted/30"><SelectValue placeholder="เลือกตำแหน่ง" /></SelectTrigger>
                <SelectContent>
                  {(affiliations.find((a) => a.name === form.dept)?.positions || affiliations.flatMap((a) => a.positions))
                    .filter((p, i, arr) => arr.findIndex((x) => x.name === p.name) === i)
                    .map((p) => <SelectItem key={p.id + "-" + p.name} value={p.name}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">สังกัด (แผนก/หน่วยงาน)</label>
              <Select value={form.dept} onValueChange={setField("dept")}>
                <SelectTrigger className="rounded-xl border-border bg-muted/30"><SelectValue placeholder="เลือกสังกัด" /></SelectTrigger>
                <SelectContent>
                  {affiliationNames.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <FormInput label="อีเมล" value={form.email} onChange={setField("email")} type="email" />
            <FormInput label="เบอร์โทร" value={form.phone} onChange={setField("phone")} />
            <FormInput label="จำนวนคนในทีม" value={String(form.headCount)} onChange={(v) => setForm((f) => ({ ...f, headCount: Number(v) || 0 }))} type="number" />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <button className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">ยกเลิก</button>
            </DialogClose>
            <button onClick={handleAddSave}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-primary-foreground transition-all"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))" }}>
              <Plus className="w-4 h-4" /> เพิ่ม
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
              คุณต้องการลบ <strong>"{deletingNode?.name}"</strong> ({deletingNode?.position}) ออกจากโครงสร้างองค์กรหรือไม่?
              {deletingNode?.children && deletingNode.children.length > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  ⚠️ ตำแหน่งนี้มีผู้ใต้บังคับบัญชา {deletingNode.children.length} คน ซึ่งจะถูกลบไปด้วย
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Organization;
