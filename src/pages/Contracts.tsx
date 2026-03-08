import { useState } from "react";
import { Plus, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useContracts, ContractStatus, STATUS_LABELS, Contract } from "@/contexts/ContractContext";
import { useEmployees } from "@/contexts/EmployeeContext";
import ContractStatusBadge from "@/components/contracts/ContractStatusBadge";
import ContractFormDialog from "@/components/contracts/ContractFormDialog";
import { useNavigate } from "react-router-dom";

const ALL_STATUSES: ContractStatus[] = ["draft", "pending_employee", "pending_hr_review", "pending_witness_1", "pending_witness_2", "pending_executive", "pending_final_review", "completed"];

const Contracts = () => {
  const { contracts } = useContracts();
  const { employees } = useEmployees();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editContract, setEditContract] = useState<Contract | null>(null);

  const emp = (id: string) => {
    const e = employees.find((x) => x.id === id);
    return e ? `${e.firstName} ${e.lastName}` : id;
  };

  const filtered = contracts.filter((c) => {
    const matchSearch = !search || c.title.includes(search) || c.contractNumber.includes(search) || emp(c.employeeId).includes(search);
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold font-display">จัดการสัญญาจ้าง</h2>
          <p className="text-sm text-muted-foreground mt-0.5">สร้าง ติดตาม และลงนามสัญญาจ้างพนักงาน</p>
        </div>
        <Button onClick={() => { setEditContract(null); setFormOpen(true); }} className="gap-1.5">
          <Plus className="w-4 h-4" />สร้างสัญญาใหม่
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="ค้นหาสัญญา..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <Filter className="w-4 h-4 mr-1.5" />
            <SelectValue placeholder="สถานะทั้งหมด" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทั้งหมด</SelectItem>
            {ALL_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "ทั้งหมด", count: contracts.length, color: "hsl(var(--primary))" },
          { label: "แบบร่าง", count: contracts.filter((c) => c.status === "draft").length, color: "hsl(var(--muted-foreground))" },
          { label: "กำลังดำเนินการ", count: contracts.filter((c) => !["draft", "completed"].includes(c.status)).length, color: "hsl(30 100% 50%)" },
          { label: "เสร็จสิ้น", count: contracts.filter((c) => c.status === "completed").length, color: "hsl(142 70% 45%)" },
        ].map((s) => (
          <div key={s.label} className="card-base p-4 text-center">
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.count}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card-base overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>เลขที่สัญญา</TableHead>
                <TableHead>ชื่อสัญญา</TableHead>
                <TableHead>พนักงาน</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>ระยะเวลา</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">ไม่พบสัญญาจ้าง</TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/contracts/${c.id}`)}>
                    <TableCell className="font-mono text-xs">{c.contractNumber}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">{c.title}</TableCell>
                    <TableCell>{emp(c.employeeId)}</TableCell>
                    <TableCell>{c.contractType}</TableCell>
                    <TableCell className="text-xs">{c.startDate} — {c.endDate}</TableCell>
                    <TableCell><ContractStatusBadge status={c.status} /></TableCell>
                    <TableCell className="text-right">
                      {c.status === "draft" && (
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditContract(c); setFormOpen(true); }}>แก้ไข</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Dialogs */}
      <ContractFormDialog open={formOpen} onOpenChange={setFormOpen} editContract={editContract} />
      {detailContract && (
        <ContractDetailDialog
          open={!!detailContract}
          onOpenChange={(open) => !open && setDetailContract(null)}
          contract={detailContract}
        />
      )}
    </div>
  );
};

export default Contracts;
