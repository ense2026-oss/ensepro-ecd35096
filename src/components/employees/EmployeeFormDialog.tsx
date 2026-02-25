import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, X, ScanFace, Upload, Camera } from "lucide-react";
import type { Employee } from "@/contexts/EmployeeContext";
import { useOrg } from "@/contexts/OrgContext";

interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Employee | null;
  onSave: (data: Omit<Employee, "id" | "education" | "workHistory">) => void;
}

const EMPTY: Omit<Employee, "id" | "education" | "workHistory"> = {
  avatar: "", avatarColor: "", avatarTextColor: "", photoUrl: "",
  prefix: "นาย", firstName: "", lastName: "", nickname: "",
  birthDate: "", nationalId: "", nationality: "ไทย", religion: "พุทธ", bloodGroup: "A",
  idIssueDate: "", idExpireDate: "",
  phone: "", email: "", address: "",
  dept: "", position: "", employeeType: "พนักงานประจำ",
  startDate: "", shift: "กะเช้า 08:00-17:00", faceScanId: "", salary: "", status: "active",
  homeAddress: "", maritalStatus: "โสด",
  spouseName: "", spousePhone: "",
  fatherName: "", fatherPhone: "", motherName: "", motherPhone: "",
  emergencyName: "", emergencyRelation: "", emergencyPhone: "",
  username: "", role: "Employee",
};

const InputField = ({ label, value, onChange, type = "text", placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean;
}) => (
  <div className="space-y-1.5">
    <label className="text-xs font-medium text-muted-foreground">
      {label} {required && <span className="text-destructive">*</span>}
    </label>
    <input
      type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/30 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
    />
  </div>
);

const SelectField = ({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) => (
  <div className="space-y-1.5">
    <label className="text-xs font-medium text-muted-foreground">{label}</label>
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/30 outline-none focus:ring-2 focus:ring-primary/30 transition-all cursor-pointer">
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
  </div>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 mt-5 first:mt-0">{children}</p>
);

const EmployeeFormDialog = ({ open, onOpenChange, employee, onSave }: EmployeeFormDialogProps) => {
  const isEdit = !!employee;
  const { departments } = useOrg();
  const [form, setForm] = useState<Omit<Employee, "id" | "education" | "workHistory">>(EMPTY);
  const [errors, setErrors] = useState<string[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, photoUrl: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setForm((f) => ({ ...f, photoUrl: "" }));
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  useEffect(() => {
    if (open) {
      if (employee) {
        const { id, education, workHistory, ...rest } = employee;
        setForm(rest);
      } else {
        setForm(EMPTY);
      }
      setErrors([]);
    }
  }, [open, employee]);

  const set = (key: string) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  const handleSave = () => {
    const errs: string[] = [];
    if (!form.firstName.trim()) errs.push("กรุณากรอกชื่อ");
    if (!form.lastName.trim()) errs.push("กรุณากรอกนามสกุล");
    if (!form.dept.trim() || form.dept === "-- เลือกแผนก --") errs.push("กรุณาเลือกแผนก");
    if (!form.position.trim()) errs.push("กรุณากรอกตำแหน่ง");
    if (errs.length) { setErrors(errs); return; }

    // Auto-generate avatar data
    const avatar = form.firstName.charAt(0) || "?";
    const hue = Math.floor(Math.random() * 360);
    onSave({
      ...form,
      avatar,
      avatarColor: `hsl(${hue} 70% 90%)`,
      avatarTextColor: `hsl(${hue} 70% 35%)`,
      username: form.username || `${form.firstName.toLowerCase()}.${form.lastName.charAt(0).toLowerCase()}`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-lg font-bold">{isEdit ? "แก้ไขข้อมูลพนักงาน" : "เพิ่มพนักงานใหม่"}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {isEdit ? "แก้ไขข้อมูลพนักงานด้านล่าง" : "กรอกข้อมูลพนักงานใหม่ด้านล่าง"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="px-6 pb-6 max-h-[65vh]">
          {errors.length > 0 && (
            <div className="mb-4 p-3 rounded-xl border border-destructive/30 bg-destructive/5 text-sm text-destructive space-y-1">
              {errors.map((e, i) => <p key={i}>• {e}</p>)}
            </div>
          )}

          <SectionLabel>รูปภาพพนักงาน</SectionLabel>
          <div className="flex items-center gap-4 mb-2">
            {form.photoUrl ? (
              <div className="relative">
                <img src={form.photoUrl} alt="Employee" className="w-20 h-20 rounded-xl object-cover border border-border" />
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center text-muted-foreground bg-muted/30">
                <Camera className="w-6 h-6" />
              </div>
            )}
            <div className="space-y-1.5">
              <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-border hover:bg-muted transition-colors"
              >
                <Upload className="w-4 h-4" /> เลือกรูปภาพ
              </button>
              <p className="text-[10px] text-muted-foreground">รองรับ JPG, PNG ขนาดไม่เกิน 2MB</p>
            </div>
          </div>

          <SectionLabel>ข้อมูลพื้นฐาน</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SelectField label="คำนำหน้า" value={form.prefix} onChange={set("prefix")} options={["นาย", "นาง", "นางสาว", "ดร.", "ผศ.ดร."]} />
            <InputField label="ชื่อ" value={form.firstName} onChange={set("firstName")} required />
            <InputField label="นามสกุล" value={form.lastName} onChange={set("lastName")} required />
            <InputField label="ชื่อเล่น" value={form.nickname} onChange={set("nickname")} />
            <InputField label="เบอร์โทรศัพท์" value={form.phone} onChange={set("phone")} type="tel" />
            <InputField label="อีเมล" value={form.email} onChange={set("email")} type="email" />
          </div>

          <SectionLabel>ข้อมูลการทำงาน</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SelectField label="แผนก" value={form.dept} onChange={set("dept")} options={["-- เลือกแผนก --", ...departments]} />
            <InputField label="ตำแหน่ง" value={form.position} onChange={set("position")} required />
            <SelectField label="ประเภทพนักงาน" value={form.employeeType} onChange={set("employeeType")} options={["พนักงานประจำ", "พนักงานชั่วคราว", "พนักงานทดลองงาน"]} />
            <InputField label="เงินเดือน (บาท)" value={form.salary} onChange={set("salary")} type="number" />
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <ScanFace className="w-3.5 h-3.5" /> Face Scan ID
              </label>
              <input
                type="text" value={form.faceScanId} onChange={(e) => set("faceScanId")(e.target.value)} placeholder="FS-0001"
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/30 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
              <p className="text-[10px] text-muted-foreground">ใช้ ID เดียวกับที่ตั้งค่าในเครื่องสแกนหน้า</p>
            </div>
            <SelectField label="สถานะ" value={form.status} onChange={set("status")} options={["active", "leave", "inactive"]} />
            <SelectField label="Role" value={form.role} onChange={set("role")} options={["Executive", "Manager", "Admin", "HR", "Accountant", "Employee"]} />
          </div>

          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border">
            <button onClick={() => onOpenChange(false)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
              <X className="w-4 h-4" /> ยกเลิก
            </button>
            <button onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-primary-foreground transition-all"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}>
              <Save className="w-4 h-4" /> {isEdit ? "บันทึก" : "เพิ่มพนักงาน"}
            </button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeFormDialog;
