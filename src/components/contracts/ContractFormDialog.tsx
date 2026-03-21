import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useEmployees } from "@/contexts/EmployeeContext";
import { useContracts, Contract, ContractType } from "@/contexts/ContractContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editContract?: Contract | null;
}

const CONTRACT_TYPES: ContractType[] = ["จ้างงาน", "ทดลองงาน", "ต่อสัญญา"];

const ContractFormDialog = ({ open, onOpenChange, editContract }: Props) => {
  const { employees } = useEmployees();
  const { addContract, updateContract, settings } = useContracts();
  const activeEmployees = employees.filter((e) => e.status !== "inactive");
  const managers = employees.filter((e) => ["Admin", "Manager", "HR"].includes(e.role));

  const [form, setForm] = useState({
    employeeId: "",
    title: "",
    contractType: "จ้างงาน" as ContractType,
    startDate: "",
    endDate: "",
    salary: "",
    witness1Id: "",
    witness2Id: "",
    executiveId: settings.defaultExecutiveId,
    notes: "",
  });

  useEffect(() => {
    if (open) {
      if (editContract) {
        setForm({
          employeeId: editContract.employeeId,
          title: editContract.title,
          contractType: editContract.contractType,
          startDate: editContract.startDate,
          endDate: editContract.endDate,
          salary: String(editContract.salary),
          witness1Id: editContract.witness1Id || "",
          witness2Id: editContract.witness2Id || "",
          executiveId: editContract.executiveId,
          notes: editContract.details?.notes || "",
        });
      } else {
        setForm({
          employeeId: "",
          title: "",
          contractType: "จ้างงาน",
          startDate: "",
          endDate: "",
          salary: "",
          witness1Id: "",
          witness2Id: "",
          executiveId: settings.defaultExecutiveId,
          notes: "",
        });
      }
    }
  }, [open, editContract, settings.defaultExecutiveId]);

  const handleEmployeeChange = (id: string) => {
    const emp = employees.find((e) => e.id === id);
    setForm((f) => ({
      ...f,
      employeeId: id,
      title: emp ? `สัญญา${f.contractType} - ${emp.firstName} ${emp.lastName}` : f.title,
      salary: emp?.salary || f.salary,
    }));
  };

  const handleSubmit = () => {
    if (!form.employeeId || !form.startDate || !form.endDate) {
      toast.error("กรุณากรอกข้อมูลให้ครบ");
      return;
    }

    const contractNumber = `CT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, "0")}`;

    if (editContract) {
      updateContract(editContract.id, {
        employeeId: form.employeeId,
        title: form.title,
        contractType: form.contractType,
        startDate: form.startDate,
        endDate: form.endDate,
        salary: Number(form.salary),
        witness1Id: form.witness1Id || null,
        witness2Id: form.witness2Id || null,
        executiveId: form.executiveId,
        details: { notes: form.notes },
      });
      toast.success("แก้ไขสัญญาจ้างเรียบร้อย");
    } else {
      addContract({
        contractNumber,
        employeeId: form.employeeId,
        title: form.title,
        contractType: form.contractType,
        startDate: form.startDate,
        endDate: form.endDate,
        salary: Number(form.salary),
        details: { notes: form.notes },
        status: "draft",
        witness1Id: form.witness1Id || null,
        witness2Id: form.witness2Id || null,
        executiveId: form.executiveId,
        createdBy: "h0k8i9j1-8901-2345-67h2-345678901234",
      });
      toast.success("สร้างสัญญาจ้างเรียบร้อย");
    }
    onOpenChange(false);
  };

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editContract ? "แก้ไขสัญญาจ้าง" : "สร้างสัญญาจ้างใหม่"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Employee */}
          <div className="grid gap-1.5">
            <Label>พนักงาน *</Label>
            <Select value={form.employeeId} onValueChange={handleEmployeeChange}>
              <SelectTrigger><SelectValue placeholder="เลือกพนักงาน" /></SelectTrigger>
              <SelectContent>
                {activeEmployees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName} — {e.position}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Contract type */}
          <div className="grid gap-1.5">
            <Label>ประเภทสัญญา</Label>
            <Select value={form.contractType} onValueChange={(v) => set("contractType", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONTRACT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="grid gap-1.5">
            <Label>ชื่อสัญญา</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>วันที่เริ่มต้น *</Label>
              <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>วันที่สิ้นสุด *</Label>
              <Input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
            </div>
          </div>

          {/* Salary */}
          <div className="grid gap-1.5">
            <Label>เงินเดือน</Label>
            <Input type="number" value={form.salary} onChange={(e) => set("salary", e.target.value)} />
          </div>

          {/* Witness 1 */}
          <div className="grid gap-1.5">
            <Label>พยานคนที่ 1</Label>
            <Select value={form.witness1Id} onValueChange={(v) => set("witness1Id", v)}>
              <SelectTrigger><SelectValue placeholder="เลือกพยาน" /></SelectTrigger>
              <SelectContent>
                {managers.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Witness 2 — only show when settings require 2 witnesses */}
          {settings.witnessCount === 2 && (
            <div className="grid gap-1.5">
              <Label>พยานคนที่ 2</Label>
              <Select value={form.witness2Id} onValueChange={(v) => set("witness2Id", v)}>
                <SelectTrigger><SelectValue placeholder="เลือกพยาน" /></SelectTrigger>
                <SelectContent>
                  {managers.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Executive */}
          <div className="grid gap-1.5">
            <Label>ผู้บริหาร</Label>
            <Select value={form.executiveId} onValueChange={(v) => set("executiveId", v)}>
              <SelectTrigger><SelectValue placeholder="เลือกผู้บริหาร" /></SelectTrigger>
              <SelectContent>
                {managers.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="grid gap-1.5">
            <Label>หมายเหตุ</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={handleSubmit}>{editContract ? "บันทึก" : "สร้างสัญญา"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ContractFormDialog;
