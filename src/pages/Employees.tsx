import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Plus, Filter, Download, MoreHorizontal, Eye, Edit, Trash2,
  ChevronLeft, ChevronRight, Phone, Mail, MapPin,
} from "lucide-react";
import { useEmployees } from "@/contexts/EmployeeContext";
import type { Employee } from "@/contexts/EmployeeContext";
import EmployeeFormDialog from "@/components/employees/EmployeeFormDialog";
import DeleteEmployeeDialog from "@/components/employees/DeleteEmployeeDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "ทำงาน", className: "badge-present" },
  leave: { label: "ลางาน", className: "badge-leave" },
  inactive: { label: "ลาออก", className: "badge-absent" },
};

const Employees = () => {
  const navigate = useNavigate();
  const { employees, addEmployee, updateEmployee, deleteEmployee } = useEmployees();
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "card">("table");

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);

  const depts = ["all", ...Array.from(new Set(employees.map((e) => e.dept)))];

  const filtered = employees.filter((e) => {
    const name = `${e.prefix}${e.firstName} ${e.lastName}`;
    const matchSearch =
      name.includes(search) ||
      e.position.includes(search) ||
      e.email.includes(search);
    const matchDept = selectedDept === "all" || e.dept === selectedDept;
    return matchSearch && matchDept;
  });

  const handleAdd = () => { setEditingEmployee(null); setFormOpen(true); };
  const handleEdit = (emp: Employee) => { setEditingEmployee(emp); setFormOpen(true); };
  const handleDeleteClick = (emp: Employee) => { setDeletingEmployee(emp); setDeleteOpen(true); };

  const handleFormSave = (data: Omit<Employee, "id" | "education" | "workHistory">) => {
    if (editingEmployee) {
      updateEmployee(editingEmployee.id, data);
      toast.success("แก้ไขข้อมูลพนักงานสำเร็จ");
    } else {
      addEmployee({ ...data, education: [], workHistory: [] } as Omit<Employee, "id">);
      toast.success("เพิ่มพนักงานสำเร็จ");
    }
  };

  const handleDeleteConfirm = () => {
    if (deletingEmployee) {
      deleteEmployee(deletingEmployee.id);
      toast.success("ลบพนักงานสำเร็จ");
      setDeleteOpen(false);
      setDeletingEmployee(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display">รายชื่อพนักงาน</h2>
          <p className="text-sm text-muted-foreground mt-0.5">พนักงานทั้งหมด {employees.length} คน</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">
            <Download className="w-4 h-4" /> Export
          </button>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", color: "hsl(var(--primary-foreground))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}
          >
            <Plus className="w-4 h-4" /> เพิ่มพนักงาน
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card-base p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="ค้นหาชื่อ, ตำแหน่ง, อีเมล..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border bg-muted/30 outline-none focus:ring-2 transition-all" />
          </div>
          <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-2.5 text-sm rounded-xl border bg-muted/30 outline-none cursor-pointer">
            {depts.map((d) => <option key={d} value={d}>{d === "all" ? "ทุกแผนก" : d}</option>)}
          </select>
          <div className="flex items-center gap-1 border rounded-xl p-1">
            <button onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${viewMode === "table" ? "text-primary-foreground" : "text-muted-foreground"}`}
              style={{ background: viewMode === "table" ? "hsl(var(--primary))" : "transparent" }}>ตาราง</button>
            <button onClick={() => setViewMode("card")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${viewMode === "card" ? "text-primary-foreground" : "text-muted-foreground"}`}
              style={{ background: viewMode === "card" ? "hsl(var(--primary))" : "transparent" }}>การ์ด</button>
          </div>
        </div>
      </div>

      {/* Table View */}
      {viewMode === "table" && (
        <div className="card-base overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: "hsl(var(--border))" }}>
                  {["พนักงาน", "UUID", "แผนก / ตำแหน่ง", "ประเภท", "เริ่มงาน", "สถานะ", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp, idx) => {
                  const sc = statusConfig[emp.status];
                  const displayName = `${emp.firstName} ${emp.lastName}`;
                  return (
                    <tr key={emp.id} className="border-b hover:bg-muted/30 transition-colors" style={{ borderColor: "hsl(var(--border))" }}>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                            style={{ background: emp.avatarColor, color: emp.avatarTextColor }}>{emp.avatar}</div>
                          <div>
                            <p className="text-sm font-semibold">{displayName}</p>
                            <p className="text-xs text-muted-foreground">({emp.nickname})</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <code className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded-md">{emp.id.slice(0, 8)}...</code>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-sm font-medium">{emp.dept}</p>
                        <p className="text-xs text-muted-foreground">{emp.position}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs px-2 py-1 rounded-lg font-medium" style={{ background: "hsl(var(--muted))" }}>{emp.employeeType}</span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-muted-foreground whitespace-nowrap">{emp.startDate}</td>
                      <td className="px-4 py-3.5"><span className={sc.className}>{sc.label}</span></td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => navigate(`/employees/${emp.id}`)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleEdit(emp)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteClick(emp)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: "hsl(var(--border))" }}>
            <p className="text-sm text-muted-foreground">แสดง {filtered.length} จาก {employees.length} รายการ</p>
          </div>
        </div>
      )}

      {/* Card View */}
      {viewMode === "card" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((emp) => {
            const sc = statusConfig[emp.status];
            const displayName = `${emp.firstName} ${emp.lastName}`;
            return (
              <div key={emp.id} className="card-base p-5 flex flex-col gap-3 animate-fade-in">
                <div className="flex items-start justify-between">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold"
                    style={{ background: emp.avatarColor, color: emp.avatarTextColor }}>{emp.avatar}</div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/employees/${emp.id}`)}>
                        <Eye className="w-4 h-4 mr-2" /> ดูข้อมูล
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(emp)}>
                        <Edit className="w-4 h-4 mr-2" /> แก้ไข
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteClick(emp)} className="text-destructive focus:text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" /> ลบ
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm">{displayName}</p>
                    <span className={sc.className}>{sc.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{emp.position}</p>
                  <p className="text-xs font-medium mt-0.5" style={{ color: "hsl(var(--primary))" }}>{emp.dept}</p>
                </div>
                <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: "hsl(var(--border))" }}>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><Phone className="w-3.5 h-3.5" />{emp.phone}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><Mail className="w-3.5 h-3.5" /><span className="truncate">{emp.email}</span></div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="w-3.5 h-3.5" />เริ่มงาน {emp.startDate}</div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => navigate(`/employees/${emp.id}`)}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold transition-colors border"
                    style={{ borderColor: "hsl(var(--primary))", color: "hsl(var(--primary))" }}>ดูข้อมูล</button>
                  <button onClick={() => handleEdit(emp)}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", color: "hsl(var(--primary-foreground))" }}>แก้ไข</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <EmployeeFormDialog open={formOpen} onOpenChange={setFormOpen} employee={editingEmployee} onSave={handleFormSave} />
      <DeleteEmployeeDialog
        open={deleteOpen} onOpenChange={setDeleteOpen}
        employeeName={deletingEmployee ? `${deletingEmployee.prefix}${deletingEmployee.firstName} ${deletingEmployee.lastName}` : ""}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
};

export default Employees;
