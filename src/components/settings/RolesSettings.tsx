import { useState } from "react";
import { Plus, Edit, Trash2, Check, Users } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

// --- Types ---
type Scope = "self" | "department" | "all";

interface ModulePermission {
  view: boolean;
  add: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
  scope: Scope;
}

interface ModulePermissions {
  leave: ModulePermission;
  ot: ModulePermission;
  attendance: ModulePermission;
  employee: ModulePermission;
  organization: ModulePermission;
  shiftManagement: ModulePermission;
  payroll: ModulePermission;
  reports: ModulePermission;
  settings: ModulePermission;
}

interface Role {
  id: number;
  name: string;
  desc: string;
  users: number;
  permissions: ModulePermissions;
}

// --- Module config ---
type ModuleKey = keyof ModulePermissions;
type ActionKey = "view" | "add" | "edit" | "delete" | "approve";

interface ModuleConfig {
  key: ModuleKey;
  label: string;
  actions: ActionKey[];
  hasScope: boolean;
}

const moduleConfigs: ModuleConfig[] = [
  { key: "leave", label: "ระบบขอลางาน", actions: ["view", "add", "edit", "delete", "approve"], hasScope: true },
  { key: "ot", label: "ระบบขอโอที", actions: ["view", "add", "edit", "delete", "approve"], hasScope: true },
  { key: "attendance", label: "ระบบบันทึกเวลา", actions: ["view", "add", "edit", "delete", "approve"], hasScope: true },
  { key: "employee", label: "ระบบข้อมูลพนักงาน", actions: ["view", "add", "edit", "delete"], hasScope: true },
  { key: "organization", label: "ระบบโครงสร้างองค์กร", actions: ["view", "add", "edit", "delete"], hasScope: true },
  { key: "shiftManagement", label: "ระบบกะการทำงาน", actions: ["view", "add", "edit", "delete"], hasScope: true },
  { key: "payroll", label: "ระบบเงินเดือน", actions: ["view", "add", "edit", "delete"], hasScope: true },
  { key: "reports", label: "ระบบรายงาน", actions: ["view"], hasScope: true },
  { key: "settings", label: "การตั้งค่า", actions: ["view", "add", "edit", "delete"], hasScope: false },
];

const actionLabels: Record<ActionKey, string> = {
  view: "ดู",
  add: "เพิ่ม",
  edit: "แก้ไข",
  delete: "ลบ",
  approve: "อนุมัติ",
};

const scopeLabels: Record<Scope, string> = {
  self: "ตนเอง",
  department: "แผนก",
  all: "ทั้งหมด",
};

const allActions: ActionKey[] = ["view", "add", "edit", "delete", "approve"];

// --- Helpers ---
const makePerm = (flags: Partial<Record<ActionKey, boolean>>, scope: Scope = "self"): ModulePermission => ({
  view: false, add: false, edit: false, delete: false, approve: false,
  ...flags,
  scope,
});

const allTrue = (scope: Scope = "all"): ModulePermission => makePerm({ view: true, add: true, edit: true, delete: true, approve: true }, scope);

const defaultModulePermissions: ModulePermissions = {
  leave: makePerm({}),
  ot: makePerm({}),
  attendance: makePerm({}),
  employee: makePerm({}),
  organization: makePerm({}),
  shiftManagement: makePerm({}),
  payroll: makePerm({}),
  reports: makePerm({}),
  settings: makePerm({}),
};

// --- Default roles ---
const defaultRoles: Role[] = [
  {
    id: 1, name: "Executive", desc: "กรรมการผู้จัดการ / ผู้บริหาร", users: 3,
    permissions: {
      leave: allTrue(), ot: allTrue(), attendance: allTrue(),
      employee: makePerm({ view: true, add: true, edit: true, delete: true }, "all"),
      organization: makePerm({ view: true, add: true, edit: true, delete: true }, "all"),
      shiftManagement: makePerm({ view: true, add: true, edit: true, delete: true }, "all"),
      payroll: makePerm({ view: true, add: true, edit: true, delete: true }, "all"),
      reports: makePerm({ view: true }, "all"),
      settings: makePerm({ view: true, add: true, edit: true, delete: true }, "all"),
    },
  },
  {
    id: 2, name: "Manager", desc: "ผู้จัดการ / หัวหน้าแผนก", users: 12,
    permissions: {
      leave: makePerm({ view: true, add: true, edit: true, approve: true }, "department"),
      ot: makePerm({ view: true, add: true, edit: true, approve: true }, "department"),
      attendance: makePerm({ view: true, edit: true, approve: true }, "department"),
      employee: makePerm({ view: true, edit: true }, "department"),
      organization: makePerm({ view: true }, "department"),
      shiftManagement: makePerm({ view: true, add: true, edit: true }, "department"),
      payroll: makePerm({}, "self"),
      reports: makePerm({ view: true }, "department"),
      settings: makePerm({ view: true }),
    },
  },
  {
    id: 3, name: "Admin", desc: "ผู้ดูแลระบบ", users: 2,
    permissions: {
      leave: makePerm({ view: true, add: true, edit: true, delete: true }, "all"),
      ot: makePerm({ view: true, add: true, edit: true, delete: true }, "all"),
      attendance: makePerm({ view: true, add: true, edit: true, delete: true }, "all"),
      employee: makePerm({ view: true, add: true, edit: true, delete: true }, "all"),
      organization: makePerm({ view: true, add: true, edit: true, delete: true }, "all"),
      shiftManagement: makePerm({ view: true, add: true, edit: true, delete: true }, "all"),
      payroll: makePerm({ view: true, add: true, edit: true, delete: true }, "all"),
      reports: makePerm({ view: true }, "all"),
      settings: makePerm({ view: true, add: true, edit: true, delete: true }, "all"),
    },
  },
  {
    id: 4, name: "HR", desc: "เจ้าหน้าที่ HR", users: 5,
    permissions: {
      leave: makePerm({ view: true, add: true, edit: true, approve: true }, "all"),
      ot: makePerm({ view: true, add: true, edit: true, approve: true }, "all"),
      attendance: makePerm({ view: true, edit: true, approve: true }, "all"),
      employee: makePerm({ view: true, add: true, edit: true }, "all"),
      organization: makePerm({ view: true }, "all"),
      shiftManagement: makePerm({ view: true, add: true, edit: true, delete: true }, "all"),
      payroll: makePerm({ view: true, add: true, edit: true, delete: true }, "all"),
      reports: makePerm({ view: true }, "all"),
      settings: makePerm({ view: true }),
    },
  },
  {
    id: 5, name: "Accountant", desc: "นักบัญชี", users: 8,
    permissions: {
      leave: makePerm({ view: true }, "self"),
      ot: makePerm({ view: true }, "self"),
      attendance: makePerm({ view: true }, "self"),
      employee: makePerm({ view: true }, "self"),
      organization: makePerm({ view: true }, "self"),
      shiftManagement: makePerm({ view: true }, "self"),
      payroll: makePerm({ view: true, add: true, edit: true, delete: true }, "all"),
      reports: makePerm({ view: true }, "department"),
      settings: makePerm({ view: true }),
    },
  },
  {
    id: 6, name: "Employee", desc: "พนักงานทั่วไป", users: 218,
    permissions: {
      leave: makePerm({ view: true, add: true }, "self"),
      ot: makePerm({ view: true, add: true }, "self"),
      attendance: makePerm({ view: true }, "self"),
      employee: makePerm({ view: true }, "self"),
      organization: makePerm({ view: true }, "self"),
      shiftManagement: makePerm({}, "self"),
      payroll: makePerm({}, "self"),
      reports: makePerm({}, "self"),
      settings: makePerm({}),
    },
  },
];

// --- Component ---
const RolesSettings = () => {
  const [roles, setRoles] = useState<Role[]>(defaultRoles);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", desc: "", permissions: structuredClone(defaultModulePermissions) });

  const openAdd = () => {
    setEditingId(null);
    setForm({ name: "", desc: "", permissions: structuredClone(defaultModulePermissions) });
    setDialogOpen(true);
  };

  const openEdit = (role: Role) => {
    setEditingId(role.id);
    setForm({ name: role.name, desc: role.desc, permissions: structuredClone(role.permissions) });
    setDialogOpen(true);
  };

  const toggleAction = (mod: ModuleKey, action: ActionKey) => {
    setForm((f) => ({
      ...f,
      permissions: {
        ...f.permissions,
        [mod]: { ...f.permissions[mod], [action]: !f.permissions[mod][action] },
      },
    }));
  };

  const setScope = (mod: ModuleKey, scope: Scope) => {
    setForm((f) => ({
      ...f,
      permissions: {
        ...f.permissions,
        [mod]: { ...f.permissions[mod], scope },
      },
    }));
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ title: "กรุณากรอกชื่อ Role", variant: "destructive" });
      return;
    }
    if (editingId !== null) {
      setRoles((prev) =>
        prev.map((r) => (r.id === editingId ? { ...r, name: form.name, desc: form.desc, permissions: structuredClone(form.permissions) } : r))
      );
      toast({ title: "แก้ไข Role สำเร็จ", description: form.name });
    } else {
      const newId = Math.max(0, ...roles.map((r) => r.id)) + 1;
      setRoles((prev) => [...prev, { id: newId, name: form.name, desc: form.desc, users: 0, permissions: structuredClone(form.permissions) }]);
      toast({ title: "เพิ่ม Role สำเร็จ", description: form.name });
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (deleteId === null) return;
    const role = roles.find((r) => r.id === deleteId);
    if (role && role.users > 0) {
      toast({ title: "ไม่สามารถลบได้", description: `มีผู้ใช้งาน ${role.users} คนที่ใช้ Role นี้อยู่`, variant: "destructive" });
      setDeleteId(null);
      return;
    }
    setRoles((prev) => prev.filter((r) => r.id !== deleteId));
    setDeleteId(null);
    toast({ title: "ลบ Role สำเร็จ", description: role?.name });
  };

  const countModules = (perms: ModulePermissions) => {
    return moduleConfigs.filter((m) => perms[m.key].view).length;
  };

  const totalUsers = roles.reduce((sum, r) => sum + r.users, 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{roles.length} Role | {totalUsers} ผู้ใช้ทั้งหมด</p>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-primary-foreground"
          style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}
        >
          <Plus className="w-4 h-4" />
          เพิ่ม Role
        </button>
      </div>

      {/* Roles summary table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: "hsl(var(--border))" }}>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Role</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">คำอธิบาย</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">ผู้ใช้</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">ระบบที่เข้าถึง</th>
              <th className="text-left px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id} className="border-b hover:bg-muted/30 transition-colors" style={{ borderColor: "hsl(var(--border))" }}>
                <td className="px-4 py-3">
                  <span className="px-3 py-1 rounded-lg text-xs font-bold" style={{ background: "hsl(var(--primary-light))", color: "hsl(var(--primary))" }}>
                    {role.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground max-w-[180px] truncate">{role.desc}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm font-semibold">{role.users}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm font-semibold">{countModules(role.permissions)}/{moduleConfigs.length} ระบบ</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(role)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteId(role.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "แก้ไข Role" : "เพิ่ม Role ใหม่"}</DialogTitle>
            <DialogDescription>กำหนดชื่อ คำอธิบาย และสิทธิ์การใช้งานรายระบบ</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1.5">ชื่อ Role</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="เช่น Manager"
                  className="w-full px-3 py-2.5 text-sm rounded-xl border outline-none bg-muted/30 focus:ring-2 focus:ring-primary/30 transition-shadow"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">คำอธิบาย</label>
                <input
                  value={form.desc}
                  onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))}
                  placeholder="เช่น ผู้จัดการแผนก"
                  className="w-full px-3 py-2.5 text-sm rounded-xl border outline-none bg-muted/30 focus:ring-2 focus:ring-primary/30 transition-shadow"
                />
              </div>
            </div>

            {/* Permission matrix */}
            <div>
              <label className="block text-sm font-semibold mb-3">สิทธิ์การใช้งาน</label>
              <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "hsl(var(--border))" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40">
                      <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">ระบบ</th>
                      {allActions.map((a) => (
                        <th key={a} className="text-center px-2 py-2.5 font-semibold text-muted-foreground whitespace-nowrap">{actionLabels[a]}</th>
                      ))}
                      <th className="text-center px-2 py-2.5 font-semibold text-muted-foreground whitespace-nowrap">ขอบเขต</th>
                    </tr>
                  </thead>
                  <tbody>
                    {moduleConfigs.map((mod) => (
                      <tr key={mod.key} className="border-t" style={{ borderColor: "hsl(var(--border))" }}>
                        <td className="px-4 py-2.5 font-medium whitespace-nowrap">- {mod.label}</td>
                        {allActions.map((action) => {
                          const enabled = mod.actions.includes(action);
                          if (!enabled) {
                            return <td key={action} className="text-center px-2 py-2.5"><span className="text-muted-foreground/30">—</span></td>;
                          }
                          const checked = form.permissions[mod.key][action];
                          return (
                            <td key={action} className="text-center px-2 py-2.5">
                              <button
                                type="button"
                                onClick={() => toggleAction(mod.key, action)}
                                className="w-6 h-6 rounded-full border-2 flex items-center justify-center mx-auto transition-all"
                                style={{
                                  borderColor: checked ? "hsl(var(--primary))" : "hsl(var(--border))",
                                  background: checked ? "hsl(var(--primary))" : "transparent",
                                }}
                              >
                                {checked && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                              </button>
                            </td>
                          );
                        })}
                        <td className="text-center px-2 py-2.5">
                          {mod.hasScope ? (
                            <Select value={form.permissions[mod.key].scope} onValueChange={(v) => setScope(mod.key, v as Scope)}>
                              <SelectTrigger className="h-8 w-24 mx-auto text-xs rounded-lg">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="self">ตนเอง</SelectItem>
                                <SelectItem value="department">แผนก</SelectItem>
                                <SelectItem value="all">ทั้งหมด</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                {editingId ? "บันทึกการแก้ไข" : "เพิ่ม Role"}
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
            <AlertDialogTitle className="text-center">ยืนยันการลบ Role</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {(() => {
                const role = roles.find((r) => r.id === deleteId);
                if (role && role.users > 0) {
                  return <>Role "<span className="font-semibold text-foreground">{role.name}</span>" มีผู้ใช้งาน {role.users} คน<br />จะต้องย้ายผู้ใช้ไปยัง Role อื่นก่อนลบ</>;
                }
                return <>คุณต้องการลบ Role "<span className="font-semibold text-foreground">{role?.name}</span>" หรือไม่?<br />การดำเนินการนี้ไม่สามารถย้อนกลับได้</>;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-2">
            <AlertDialogCancel className="rounded-xl">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
              ลบ Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RolesSettings;
