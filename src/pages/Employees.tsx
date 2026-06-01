import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Plus, Download, Upload, MoreHorizontal, Eye, Edit, Trash2,
  Phone, Mail, MapPin, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useEmployees } from "@/contexts/EmployeeContext";
import type { Employee } from "@/contexts/EmployeeContext";
import EmployeeFormDialog from "@/components/employees/EmployeeFormDialog";
import DeleteEmployeeDialog from "@/components/employees/DeleteEmployeeDialog";
import ImportEmployeesDialog from "@/components/employees/ImportEmployeesDialog";
import ExportEmployeesDialog from "@/components/employees/ExportEmployeesDialog";
import EmployeeStatsCards from "@/components/employees/EmployeeStatsCards";
import EmployeeAvatar from "@/components/ui/employee-avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "ทำงานปกติ", className: "badge-present" },
  leave: { label: "ลาพัก", className: "badge-leave" },
  inactive: { label: "พ้นสภาพ", className: "badge-absent" },
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const Employees = () => {
  const navigate = useNavigate();
  const { employees, addEmployee, updateEmployee, deleteEmployee } = useEmployees();
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");
  const [selectedPosition, setSelectedPosition] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("active");
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  // Exclude admins — they are managed in Settings → ผู้ดูแลระบบ
  const nonAdmins = useMemo(
    () => employees.filter((e) => (e.role || "").toLowerCase() !== "admin"),
    [employees]
  );
  const depts = ["all", ...Array.from(new Set(nonAdmins.map((e) => e.dept).filter(Boolean)))];
  const positions = useMemo(() => {
    const src = selectedDept === "all" ? nonAdmins : nonAdmins.filter((e) => e.dept === selectedDept);
    return ["all", ...Array.from(new Set(src.map((e) => e.position).filter(Boolean)))];
  }, [nonAdmins, selectedDept]);
  const filtered = useMemo(() => nonAdmins.filter((e) => {
    const name = `${e.prefix}${e.firstName} ${e.lastName}`;
    const matchSearch =
      name.includes(search) ||
      e.position.includes(search) ||
      e.email.includes(search);
    const matchDept = selectedDept === "all" || e.dept === selectedDept;
    const matchPos = selectedPosition === "all" || e.position === selectedPosition;
    const matchStatus = selectedStatus === "all" || e.status === selectedStatus;
    return matchSearch && matchDept && matchPos && matchStatus;
  }), [nonAdmins, search, selectedDept, selectedPosition, selectedStatus]);

  // Stats
  const stats = useMemo(() => ({
    total: nonAdmins.length,
    active: nonAdmins.filter((e) => e.status === "active").length,
    onLeave: nonAdmins.filter((e) => e.status === "leave").length,
    inactive: nonAdmins.filter((e) => e.status === "inactive").length,
    departments: new Set(nonAdmins.map((e) => e.dept).filter(Boolean)).size,
  }), [nonAdmins]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedData = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Reset page on filter change
  const handleSearch = (val: string) => { setSearch(val); setCurrentPage(1); };
  const handleDeptChange = (val: string) => { setSelectedDept(val); setSelectedPosition("all"); setCurrentPage(1); };
  const handlePositionChange = (val: string) => { setSelectedPosition(val); setCurrentPage(1); };
  const handleStatusChange = (val: string) => { setSelectedStatus(val); setCurrentPage(1); };
  const handlePageSizeChange = (val: string) => { setPageSize(Number(val)); setCurrentPage(1); };

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

  const handleDeleteConfirm = async () => {
    if (deletingEmployee) {
      try {
        await deleteEmployee(deletingEmployee.id);
        toast.success("ลบพนักงานสำเร็จ");
      } catch (err: any) {
        toast.error("ลบพนักงานไม่สำเร็จ: " + (err?.message || "เกิดข้อผิดพลาด"));
      } finally {
        setDeleteOpen(false);
        setDeletingEmployee(null);
      }
    }
  };

  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push("...");
      for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pages.push(i);
      if (safePage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display">รายชื่อพนักงาน</h2>
          <p className="text-sm text-muted-foreground mt-0.5">พนักงานทั้งหมด {nonAdmins.length} คน</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setImportOpen(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">
            <Upload className="w-4 h-4" /> นำเข้า
          </button>
          <button onClick={() => setExportOpen(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={handleAdd} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", color: "hsl(var(--primary-foreground))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}>
            <Plus className="w-4 h-4" /> เพิ่มพนักงาน
          </button>
        </div>
      </div>

      {/* Stats */}
      <EmployeeStatsCards {...stats} />

      {/* Filters */}
      <div className="card-base p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="ค้นหาชื่อ, ตำแหน่ง, อีเมล..." value={search} onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border bg-muted/30 outline-none focus:ring-2 transition-all" />
          </div>
          <select value={selectedDept} onChange={(e) => handleDeptChange(e.target.value)}
            className="px-3 py-2.5 text-sm rounded-xl border bg-muted/30 outline-none cursor-pointer">
            {depts.map((d) => <option key={d} value={d}>{d === "all" ? "ทุกแผนก" : d}</option>)}
          </select>
          <select value={selectedPosition} onChange={(e) => handlePositionChange(e.target.value)}
            className="px-3 py-2.5 text-sm rounded-xl border bg-muted/30 outline-none cursor-pointer">
            {positions.map((p) => <option key={p} value={p}>{p === "all" ? "ทุกตำแหน่ง" : p}</option>)}
          </select>
          <select value={selectedStatus} onChange={(e) => handleStatusChange(e.target.value)}
            className="px-3 py-2.5 text-sm rounded-xl border bg-muted/30 outline-none cursor-pointer">
            <option value="all">ทุกสถานะ</option>
            <option value="active">ทำงานปกติ</option>
            <option value="leave">ลาพัก</option>
            <option value="inactive">พ้นสภาพ</option>
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
                  {["พนักงาน", "แผนก / ตำแหน่ง", "ประเภท", "เริ่มงาน", "สถานะ", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((emp) => {
                  const sc = statusConfig[emp.status];
                  const displayName = `${emp.prefix}${emp.firstName} ${emp.lastName}`;
                  return (
                    <tr key={emp.id} className="border-b hover:bg-muted/30 transition-colors" style={{ borderColor: "hsl(var(--border))" }}>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <EmployeeAvatar photoUrl={emp.photoUrl} avatar={emp.avatar} avatarColor={emp.avatarColor} avatarTextColor={emp.avatarTextColor} firstName={emp.firstName} size="md" />
                          <div>
                            <p className="text-sm font-semibold">{displayName}</p>
                            <p className="text-xs text-muted-foreground">({emp.nickname})</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-sm font-medium">{emp.dept}</p>
                        <p className="text-xs text-muted-foreground">{emp.position}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs px-2 py-1 rounded-lg font-medium" style={{ background: "hsl(var(--muted))" }}>{emp.employeeType}</span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-muted-foreground whitespace-nowrap">{emp.startDate}</td>
                      <td className="px-4 py-3.5"><span className={sc?.className}>{sc?.label}</span></td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => navigate(`/employees/${emp.id}`)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"><Eye className="w-4 h-4" /></button>
                          <button onClick={() => handleEdit(emp)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteClick(emp)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 gap-3 border-t" style={{ borderColor: "hsl(var(--border))" }}>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>แสดง</span>
              <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                <SelectTrigger className="w-[70px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>จาก {filtered.length} รายการ</span>
            </div>

            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}
                className="p-1.5 rounded-lg border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {getPageNumbers().map((pg, i) =>
                pg === "..." ? (
                  <span key={`e${i}`} className="px-2 text-muted-foreground text-sm">...</span>
                ) : (
                  <button key={pg} onClick={() => setCurrentPage(pg as number)}
                    className={`min-w-[32px] h-8 rounded-lg text-xs font-medium transition-colors ${
                      safePage === pg
                        ? "text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                    style={safePage === pg ? { background: "hsl(var(--primary))" } : undefined}>
                    {pg}
                  </button>
                )
              )}
              <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
                className="p-1.5 rounded-lg border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Card View */}
      {viewMode === "card" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedData.map((emp) => {
              const sc = statusConfig[emp.status];
              const displayName = `${emp.firstName} ${emp.lastName}`;
              return (
                <div key={emp.id} className="card-base p-5 flex flex-col gap-3 animate-fade-in">
                  <div className="flex items-start justify-between">
                    <EmployeeAvatar photoUrl={emp.photoUrl} avatar={emp.avatar} avatarColor={emp.avatarColor} avatarTextColor={emp.avatarTextColor} firstName={emp.firstName} size="xl" rounded="2xl" />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"><MoreHorizontal className="w-4 h-4" /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/employees/${emp.id}`)}><Eye className="w-4 h-4 mr-2" /> ดูข้อมูล</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(emp)}><Edit className="w-4 h-4 mr-2" /> แก้ไข</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteClick(emp)} className="text-destructive focus:text-destructive"><Trash2 className="w-4 h-4 mr-2" /> ลบ</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm">{displayName}</p>
                      <span className={sc?.className}>{sc?.label}</span>
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

          {/* Card view pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>แสดง</span>
              <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                <SelectTrigger className="w-[70px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>จาก {filtered.length} รายการ</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}
                className="p-1.5 rounded-lg border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {getPageNumbers().map((pg, i) =>
                pg === "..." ? (
                  <span key={`e${i}`} className="px-2 text-muted-foreground text-sm">...</span>
                ) : (
                  <button key={pg} onClick={() => setCurrentPage(pg as number)}
                    className={`min-w-[32px] h-8 rounded-lg text-xs font-medium transition-colors ${
                      safePage === pg ? "text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                    }`}
                    style={safePage === pg ? { background: "hsl(var(--primary))" } : undefined}>
                    {pg}
                  </button>
                )
              )}
              <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
                className="p-1.5 rounded-lg border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Dialogs */}
      <EmployeeFormDialog open={formOpen} onOpenChange={setFormOpen} employee={editingEmployee} onSave={handleFormSave} />
      <DeleteEmployeeDialog open={deleteOpen} onOpenChange={setDeleteOpen}
        employeeName={deletingEmployee ? `${deletingEmployee.prefix}${deletingEmployee.firstName} ${deletingEmployee.lastName}` : ""}
        onConfirm={handleDeleteConfirm} />
      <ImportEmployeesDialog open={importOpen} onOpenChange={setImportOpen} />
      <ExportEmployeesDialog open={exportOpen} onOpenChange={setExportOpen} employees={filtered} />
    </div>
  );
};

export default Employees;
