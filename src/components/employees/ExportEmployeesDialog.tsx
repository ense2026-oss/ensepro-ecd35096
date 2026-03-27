import { useState } from "react";
import * as XLSX from "xlsx";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Download } from "lucide-react";
import { toast } from "sonner";
import type { Employee } from "@/contexts/EmployeeContext";

interface ColumnOption {
  key: string;
  label: string;
  checked: boolean;
  getValue: (emp: Employee) => string;
}

const DEFAULT_COLUMNS: ColumnOption[] = [
  { key: "prefix", label: "คำนำหน้า", checked: true, getValue: (e) => e.prefix },
  { key: "firstName", label: "ชื่อ", checked: true, getValue: (e) => e.firstName },
  { key: "lastName", label: "นามสกุล", checked: true, getValue: (e) => e.lastName },
  { key: "nickname", label: "ชื่อเล่น", checked: true, getValue: (e) => e.nickname },
  { key: "nationalId", label: "เลขบัตรประชาชน", checked: true, getValue: (e) => e.nationalId },
  { key: "dept", label: "แผนก", checked: true, getValue: (e) => e.dept },
  { key: "position", label: "ตำแหน่ง", checked: true, getValue: (e) => e.position },
  { key: "employeeType", label: "ประเภทพนักงาน", checked: true, getValue: (e) => e.employeeType },
  { key: "status", label: "สถานะ", checked: true, getValue: (e) => e.status === "active" ? "ทำงาน" : e.status === "leave" ? "ลางาน" : "ลาออก" },
  { key: "salary", label: "เงินเดือน", checked: false, getValue: (e) => e.salary },
  { key: "startDate", label: "วันเริ่มงาน", checked: true, getValue: (e) => e.startDate },
  { key: "phone", label: "เบอร์โทร", checked: true, getValue: (e) => e.phone },
  { key: "email", label: "อีเมล", checked: true, getValue: (e) => e.email },
  { key: "birthDate", label: "วันเกิด", checked: false, getValue: (e) => e.birthDate },
  { key: "address", label: "ที่อยู่ตามบัตร", checked: false, getValue: (e) => e.address },
  { key: "homeAddress", label: "ที่อยู่ปัจจุบัน", checked: false, getValue: (e) => e.homeAddress },
  { key: "shift", label: "กะทำงาน", checked: false, getValue: (e) => e.shift },
  { key: "emergencyName", label: "ผู้ติดต่อฉุกเฉิน", checked: false, getValue: (e) => e.emergencyName },
  { key: "emergencyPhone", label: "เบอร์ฉุกเฉิน", checked: false, getValue: (e) => e.emergencyPhone },
  { key: "initialPassword", label: "รหัสผ่าน", checked: false, getValue: (e) => e.initialPassword || "" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[];
}

export default function ExportEmployeesDialog({ open, onOpenChange, employees }: Props) {
  const [columns, setColumns] = useState<ColumnOption[]>(() => DEFAULT_COLUMNS.map((c) => ({ ...c })));

  const toggleColumn = (key: string) => {
    setColumns((prev) => prev.map((c) => c.key === key ? { ...c, checked: !c.checked } : c));
  };

  const selectAll = () => setColumns((prev) => prev.map((c) => ({ ...c, checked: true })));
  const deselectAll = () => setColumns((prev) => prev.map((c) => ({ ...c, checked: false })));

  const selectedCount = columns.filter((c) => c.checked).length;

  const handleExport = () => {
    const selected = columns.filter((c) => c.checked);
    if (selected.length === 0) {
      toast.error("กรุณาเลือกอย่างน้อย 1 คอลัมน์");
      return;
    }

    const rows = employees.map((emp) => {
      const row: Record<string, string> = {};
      selected.forEach((col) => {
        row[col.label] = col.getValue(emp);
      });
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = selected.map((col) => ({ wch: Math.max(col.label.length * 2, 12) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "พนักงาน");
    XLSX.writeFile(wb, `Employees_${new Date().toISOString().slice(0, 10)}.xlsx`);

    toast.success(`ส่งออกข้อมูลพนักงาน ${employees.length} คน สำเร็จ`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            ส่งออกข้อมูลพนักงาน
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">เลือกคอลัมน์ที่ต้องการ ({selectedCount}/{columns.length})</p>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs text-primary hover:underline">เลือกทั้งหมด</button>
              <button onClick={deselectAll} className="text-xs text-muted-foreground hover:underline">ยกเลิกทั้งหมด</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
            {columns.map((col) => (
              <label key={col.key} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                <Checkbox checked={col.checked} onCheckedChange={() => toggleColumn(col.key)} />
                <span className="text-sm">{col.label}</span>
              </label>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">จะส่งออกพนักงานที่กรองแล้ว {employees.length} คน</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={handleExport} disabled={selectedCount === 0}
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))" }}>
            <Download className="w-4 h-4 mr-2" /> ส่งออก Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
