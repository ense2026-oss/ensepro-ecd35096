import { useContracts } from "@/contexts/ContractContext";
import { useEmployees } from "@/contexts/EmployeeContext";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

const ContractSettings = () => {
  const { settings, updateSettings } = useContracts();
  const { employees } = useEmployees();
  const managers = employees.filter((e) => ["Admin", "Manager", "HR"].includes(e.role));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold font-display">ตั้งค่าสัญญาจ้าง</h3>
        <p className="text-sm text-muted-foreground mt-0.5">กำหนดค่าเริ่มต้นสำหรับระบบสัญญาจ้าง</p>
      </div>

      {/* Witness count */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">จำนวนพยานในการลงนาม</Label>
        <RadioGroup
          value={String(settings.witnessCount)}
          onValueChange={(v) => {
            updateSettings({ witnessCount: Number(v) as 1 | 2 });
            toast.success("บันทึกเรียบร้อย");
          }}
          className="flex gap-4"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="1" id="w1" />
            <Label htmlFor="w1">1 คน</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="2" id="w2" />
            <Label htmlFor="w2">2 คน</Label>
          </div>
        </RadioGroup>
      </div>

      {/* Default executive */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">ผู้บริหารเริ่มต้นสำหรับลงนาม</Label>
        <Select
          value={settings.defaultExecutiveId}
          onValueChange={(v) => {
            updateSettings({ defaultExecutiveId: v });
            toast.success("บันทึกเรียบร้อย");
          }}
        >
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue placeholder="เลือกผู้บริหาร" />
          </SelectTrigger>
          <SelectContent>
            {managers.map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName} — {e.position}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default ContractSettings;
