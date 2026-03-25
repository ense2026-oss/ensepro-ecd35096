import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Check, Users, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/contexts/PermissionsContext";
import type { RolePermission, ModuleKey, ActionKey, Scope } from "@/contexts/PermissionsContext";

// --- Module config ---
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
  { key: "contracts", label: "ระบบสัญญาจ้าง", actions: ["view", "add", "edit", "delete"], hasScope: true },
];

const actionLabels: Record<ActionKey, string> = {
  view: "ดู", add: "เพิ่ม", edit: "แก้ไข", delete: "ลบ", approve: "อนุมัติ",
};

const allActions: ActionKey[] = ["view", "add", "edit", "delete", "approve"];

// --- Types for local form state ---
interface ModulePermission {
  view: boolean; add: boolean; edit: boolean; delete: boolean; approve: boolean; scope: Scope;
}

type ModulePermissions = Record<ModuleKey, ModulePermission>;

interface RoleData {
  name: string;
  desc: string;
  users: number;
  permissions: ModulePermissions;
}

const emptyPerm = (): ModulePermission => ({ view: false, add: false, edit: false, delete: false, approve: false, scope: "self" });

const emptyPermissions = (): ModulePermissions => {
  const p = {} as ModulePermissions;
  moduleConfigs.forEach((m) => { p[m.key] = emptyPerm(); });
  return p;
};

// Convert DB records to local form
function dbToLocal(records: RolePermission[]): ModulePermissions {
  const perms = emptyPermissions();
  records.forEach((r) => {
    const key = r.module as ModuleKey;
    if (perms[key]) {
      perms[key] = {
        view: r.can_view, add: r.can_add, edit: r.can_edit,
        delete: r.can_delete, approve: r.can_approve, scope: r.scope as Scope,
      };
    }
  });
  return perms;
}

// --- Component ---
const RolesSettings = () => {
  const { permissions: allPermissions, refreshPermissions } = usePermissions();
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});
  const [dbLoading, setDbLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteRole, setDeleteRole] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", desc: "", permissions: emptyPermissions() });

  // Load roles from permissions context + count users
  useEffect(() => {
    const loadData = async () => {
      setDbLoading(true);
      // Build roles from permissions
      const roleMap = new Map<string, { desc: string; perms: RolePermission[] }>();
      allPermissions.forEach((p) => {
        if (!roleMap.has(p.role_name)) {
          roleMap.set(p.role_name, { desc: p.role_description, perms: [] });
        }
        roleMap.get(p.role_name)!.perms.push(p);
      });

      // Count users per role
      const { data: userRoles } = await supabase.from("user_roles").select("role");
      const counts: Record<string, number> = {};
      (userRoles || []).forEach((ur: any) => {
        const r = ur.role?.toLowerCase() || "";
        counts[r] = (counts[r] || 0) + 1;
      });
      setUserCounts(counts);

      const roleList: RoleData[] = [];
      roleMap.forEach((val, key) => {
        roleList.push({
          name: key,
          desc: val.desc,
          users: counts[key] || 0,
          permissions: dbToLocal(val.perms),
        });
      });
      setRoles(roleList);
      setDbLoading(false);
    };
    if (allPermissions.length > 0) loadData();
    else setDbLoading(false);
  }, [allPermissions]);

  // Known app_role enum values that can actually be assigned to users
  const knownRoles = ["admin", "hr", "manager", "employee", "accountant", "executive"];

  const openAdd = () => {
    setEditingRole(null);
    setForm({ name: "", desc: "", permissions: emptyPermissions() });
    setDialogOpen(true);
  };

  const openEdit = (role: RoleData) => {
    setEditingRole(role.name);
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
      permissions: { ...f.permissions, [mod]: { ...f.permissions[mod], scope } },
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "กรุณากรอกชื่อ Role", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const roleName = form.name.toLowerCase();
      // Delete old records for this role then insert new
      if (editingRole) {
        await supabase.from("role_permissions").delete().eq("role_name", editingRole);
      }
      const rows = moduleConfigs.map((mod) => ({
        role_name: roleName,
        role_description: form.desc,
        module: mod.key,
        can_view: form.permissions[mod.key].view,
        can_add: form.permissions[mod.key].add,
        can_edit: form.permissions[mod.key].edit,
        can_delete: form.permissions[mod.key].delete,
        can_approve: form.permissions[mod.key].approve,
        scope: form.permissions[mod.key].scope,
      }));
      const { error } = await supabase.from("role_permissions").insert(rows);
      if (error) throw error;
      await refreshPermissions();
      toast({ title: editingRole ? "แก้ไข Role สำเร็จ" : "เพิ่ม Role สำเร็จ", description: form.name });
      setDialogOpen(false);
    } catch (e: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteRole) return;
    const role = roles.find((r) => r.name === deleteRole);
    if (role && role.users > 0) {
      toast({ title: "ไม่สามารถลบได้", description: `มีผู้ใช้งาน ${role.users} คนที่ใช้ Role นี้อยู่`, variant: "destructive" });
      setDeleteRole(null);
      return;
    }
    try {
      const { error } = await supabase.from("role_permissions").delete().eq("role_name", deleteRole);
      if (error) throw error;
      await refreshPermissions();
      toast({ title: "ลบ Role สำเร็จ", description: role?.name });
    } catch (e: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: e.message, variant: "destructive" });
    }
    setDeleteRole(null);
  };

  const countModules = (perms: ModulePermissions) =>
    moduleConfigs.filter((m) => perms[m.key].view).length;

  const totalUsers = roles.reduce((sum, r) => sum + r.users, 0);

  if (dbLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">กำลังโหลดข้อมูลสิทธิ์...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{roles.length} Role | {totalUsers} ผู้ใช้ทั้งหมด</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">จัดการเฉพาะ Role ที่รองรับในระบบ</span>
        </div>
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
              <tr key={role.name} className="border-b hover:bg-muted/30 transition-colors" style={{ borderColor: "hsl(var(--border))" }}>
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
                    <button onClick={() => setDeleteRole(role.name)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-destructive">
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
            <DialogTitle>{editingRole ? "แก้ไข Role" : "เพิ่ม Role ใหม่"}</DialogTitle>
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
                  disabled={!!editingRole}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border outline-none bg-muted/30 focus:ring-2 focus:ring-primary/30 transition-shadow disabled:opacity-50"
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
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-primary-foreground disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editingRole ? "บันทึกการแก้ไข" : "เพิ่ม Role"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteRole !== null} onOpenChange={(open) => !open && setDeleteRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
              <Trash2 className="w-6 h-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center">ยืนยันการลบ Role</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {(() => {
                const role = roles.find((r) => r.name === deleteRole);
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
