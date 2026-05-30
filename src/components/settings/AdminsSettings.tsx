import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Eye, Edit, Trash2, ShieldCheck, Phone, Mail } from "lucide-react";
import { useEmployees } from "@/contexts/EmployeeContext";
import type { Employee } from "@/contexts/EmployeeContext";
import EmployeeFormDialog from "@/components/employees/EmployeeFormDialog";
import DeleteEmployeeDialog from "@/components/employees/DeleteEmployeeDialog";
import EmployeeAvatar from "@/components/ui/employee-avatar";
import { toast } from "sonner";

const AdminsSettings = () => {
  const navigate = useNavigate();
  const { employees, addEmployee, updateEmployee, deleteEmployee } = useEmployees();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<Employee | null>(null);

  const admins = useMemo(
    () => employees.filter((e) => (e.role || "").toLowerCase() === "admin"),
    [employees]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return admins;
    const q = search.toLowerCase();
    return admins.filter((e) => {
      const name = `${e.prefix}${e.firstName} ${e.lastName}`.toLowerCase();
      return name.includes(q) || e.email.toLowerCase().includes(q) || e.username.toLowerCase().includes(q);
    });
  }, [admins, search]);

  const handleAdd = () => { setEditing(null); setFormOpen(true); };
  const handleEdit = (emp: Employee) => { setEditing(emp); setFormOpen(true); };
  const handleDeleteClick = (emp: Employee) => { setDeleting(emp); setDeleteOpen(true); };

  const handleFormSave = async (data: Omit<Employee, "id" | "education" | "workHistory">) => {
    if (editing) {
      // Respect the role chosen in the form (allows demoting an admin to HR, etc.)
      await updateEmployee(editing.id, data);
      toast.success("แก้ไขผู้ดูแลระบบสำเร็จ");
    } else {
      // New entries in this tab default to Admin
      const payload = { ...data, role: data.role || "Admin" };
      await addEmployee({ ...payload, education: [], workHistory: [] } as Omit<Employee, "id">);
      toast.success("เพิ่มผู้ดูแลระบบสำเร็จ");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleting) return;
    try {
      await deleteEmployee(deleting.id);
      toast.success("ลบผู้ดูแลระบบสำเร็จ");
    } catch (err: any) {
      toast.error("ลบไม่สำเร็จ: " + (err?.message || "เกิดข้อผิดพลาด"));
    } finally {
      setDeleteOpen(false);
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold font-display flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" style={{ color: "hsl(var(--primary))" }} />
            ผู้ดูแลระบบ
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            จัดการบัญชีผู้ดูแลระบบทั้งหมด {admins.length} คน
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all"
          style={{
            background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))",
            color: "hsl(var(--primary-foreground))",
            boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)",
          }}
        >
          + เพิ่มผู้ดูแลระบบ
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="ค้นหาชื่อ, อีเมล, username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border bg-muted/30 outline-none focus:ring-2"
        />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            ไม่พบผู้ดูแลระบบ
          </div>
        ) : (
          filtered.map((emp) => {
            const displayName = `${emp.prefix}${emp.firstName} ${emp.lastName}`;
            return (
              <div
                key={emp.id}
                className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/30 transition-colors"
              >
                <EmployeeAvatar
                  photoUrl={emp.photoUrl}
                  avatar={emp.avatar}
                  avatarColor={emp.avatarColor}
                  avatarTextColor={emp.avatarTextColor}
                  firstName={emp.firstName}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold">{displayName}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-bold"
                      style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))" }}>
                      ADMIN
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    {emp.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{emp.email}</span>}
                    {emp.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{emp.phone}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => navigate(`/employees/${emp.id}`)}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleEdit(emp)}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteClick(emp)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <EmployeeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        employee={editing}
        onSave={handleFormSave}
      />
      <DeleteEmployeeDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        employeeName={deleting ? `${deleting.prefix}${deleting.firstName} ${deleting.lastName}` : ""}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
};

export default AdminsSettings;
