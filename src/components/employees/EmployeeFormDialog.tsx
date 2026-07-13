import { useState, useEffect, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, X, ScanFace, Upload, Camera } from "lucide-react";
import type { Employee } from "@/contexts/EmployeeContext";
import { useOrg } from "@/contexts/OrgContext";
import { useRoleOptions } from "@/hooks/useRoleOptions";
import { processFileUpload } from "@/utils/fileCompression";

interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Employee | null;
  onSave: (data: Omit<Employee, "id" | "education" | "workHistory">) => void;
}

const EMPTY: Omit<Employee, "id" | "education" | "workHistory"> = {
  avatar: "", avatarColor: "", avatarTextColor: "", photoUrl: "",
  prefix: "นาย", firstName: "", lastName: "", nickname: "",
  birthDate: "", gender: "ชาย", nationalId: "", nationality: "ไทย", religion: "พุทธ", bloodGroup: "A",
  idIssueDate: "", idExpireDate: "",
  phone: "", email: "", address: "",
  dept: "", position: "", employeeType: "พนักงานประจำ",
  startDate: "", trialEndDate: "", contractEndDate: "",
  shift: "กะเช้า 08:00-17:00", faceScanId: "", salary: "", status: "active",
  bankAccount: "", driverLicense: "",
  homeAddress: "", maritalStatus: "โสด",
  spouseName: "", spousePhone: "",
  fatherName: "", fatherPhone: "", motherName: "", motherPhone: "",
  emergencyName: "", emergencyRelation: "", emergencyPhone: "",
  sons: 0, daughters: 0,
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

type SelectOption = string | { value: string; label: string };
const SelectField = ({ label, value, onChange, options, disabled, hint }: {
  label: string; value: string; onChange: (v: string) => void; options: SelectOption[]; disabled?: boolean; hint?: string;
}) => (
  <div className="space-y-1.5">
    <label className="text-xs font-medium text-muted-foreground">{label}</label>
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
      className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/30 outline-none focus:ring-2 focus:ring-primary/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
      {options.map((o) => {
        const val = typeof o === "string" ? o : o.value;
        const lbl = typeof o === "string" ? o : o.label;
        return <option key={val} value={val}>{lbl}</option>;
      })}
    </select>
    {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
  </div>
);

const STATUS_OPTIONS: SelectOption[] = [
  { value: "active", label: "ทำงานปกติ" },
  { value: "leave", label: "ลาพัก" },
  { value: "inactive", label: "พ้นสภาพ" },
];

const TextAreaField = ({ label, value, onChange, rows = 2 }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number;
}) => (
  <div className="space-y-1.5 col-span-full">
    <label className="text-xs font-medium text-muted-foreground">{label}</label>
    <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows}
      className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/30 outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none"
    />
  </div>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 mt-5 first:mt-0">{children}</p>
);

const EmployeeFormDialog = ({ open, onOpenChange, employee, onSave }: EmployeeFormDialogProps) => {
  const isEdit = !!employee;
  const { affiliations, affiliationNames, allPositions } = useOrg();
  const ROLE_OPTIONS = useRoleOptions();
  const [form, setForm] = useState<Omit<Employee, "id" | "education" | "workHistory">>(EMPTY);
  const [errors, setErrors] = useState<string[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const filteredPositions = useMemo(() => {
    const collectNames = (positions: { name: string; children?: any[] }[]): string[] => {
      const names: string[] = [];
      positions.forEach((p) => {
        names.push(p.name);
        if (p.children?.length) names.push(...collectNames(p.children));
      });
      return names;
    };
    const aff = affiliations.find((a) => a.name === form.dept);
    if (aff) return collectNames(aff.positions);
    return allPositions;
  }, [form.dept, affiliations, allPositions]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await processFileUpload(file, { maxWidth: 400, maxHeight: 400, quality: 0.8 });
    if (compressed) setForm((f) => ({ ...f, photoUrl: compressed }));
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
    if (!form.dept.trim() || form.dept === "-- เลือกสังกัด --") errs.push("กรุณาเลือกสังกัด");
    if (!form.position.trim() || form.position === "-- เลือกตำแหน่ง --") errs.push("กรุณาเลือกตำแหน่ง");
    if (errs.length) { setErrors(errs); return; }

    const avatar = form.firstName.charAt(0) || "?";
    const hue = Math.floor(Math.random() * 360);
    onSave({
      ...form,
      avatar,
      avatarColor: isEdit ? form.avatarColor : `hsl(${hue} 70% 90%)`,
      avatarTextColor: isEdit ? form.avatarTextColor : `hsl(${hue} 70% 35%)`,
      username: form.username || `${form.firstName.toLowerCase()}.${form.lastName.charAt(0).toLowerCase()}`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-lg font-bold">{isEdit ? "แก้ไขข้อมูลพนักงาน" : "เพิ่มพนักงานใหม่"}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {isEdit ? "แก้ไขข้อมูลพนักงานด้านล่าง" : "กรอกข้อมูลพนักงานใหม่ด้านล่าง"}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="px-6">
          {errors.length > 0 && (
            <div className="mb-4 p-3 rounded-xl border border-destructive/30 bg-destructive/5 text-sm text-destructive space-y-1">
              {errors.map((e, i) => <p key={i}>• {e}</p>)}
            </div>
          )}

          {/* รูปภาพพนักงาน */}
          <SectionLabel>รูปภาพพนักงาน</SectionLabel>
          <div className="flex items-center gap-4 mb-2">
            {form.photoUrl ? (
              <div className="relative">
                <img src={form.photoUrl} alt="Employee" className="w-20 h-20 rounded-xl object-cover border border-border" />
                <button type="button" onClick={handleRemovePhoto}
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
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
              <button type="button" onClick={() => photoInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-border hover:bg-muted transition-colors">
                <Upload className="w-4 h-4" /> เลือกรูปภาพ
              </button>
              <p className="text-[10px] text-muted-foreground">รองรับ JPG, PNG ขนาดไม่เกิน 2MB</p>
            </div>
          </div>

          {/* ข้อมูลพื้นฐาน */}
          <SectionLabel>ข้อมูลพื้นฐาน</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SelectField label="คำนำหน้า" value={form.prefix} onChange={set("prefix")} options={["นาย", "นาง", "นางสาว", "ดร.", "ผศ.ดร."]} />
            <InputField label="ชื่อ" value={form.firstName} onChange={set("firstName")} required />
            <InputField label="นามสกุล" value={form.lastName} onChange={set("lastName")} required />
            <InputField label="ชื่อเล่น" value={form.nickname} onChange={set("nickname")} />
            <InputField label="วันเกิด" value={form.birthDate} onChange={set("birthDate")} placeholder="YYYY-MM-DD" />
            <InputField label="เลขบัตรประชาชน" value={form.nationalId} onChange={set("nationalId")} placeholder="X-XXXX-XXXXX-XX-X" />
            <SelectField label="สัญชาติ" value={form.nationality} onChange={set("nationality")} options={["ไทย", "อื่นๆ"]} />
            <SelectField label="ศาสนา" value={form.religion} onChange={set("religion")} options={["พุทธ", "คริสต์", "อิสลาม", "ฮินดู", "อื่นๆ"]} />
            <SelectField label="หมู่เลือด" value={form.bloodGroup} onChange={set("bloodGroup")} options={["A", "B", "AB", "O"]} />
            <InputField label="วันออกบัตร" value={form.idIssueDate} onChange={set("idIssueDate")} placeholder="YYYY-MM-DD" />
            <InputField label="วันหมดอายุบัตร" value={form.idExpireDate} onChange={set("idExpireDate")} placeholder="YYYY-MM-DD" />
            <InputField label="เบอร์โทรศัพท์" value={form.phone} onChange={set("phone")} type="tel" />
            <InputField label="อีเมล" value={form.email} onChange={set("email")} type="email" />
          </div>

          {/* ที่อยู่ */}
          <SectionLabel>ที่อยู่</SectionLabel>
          <div className="grid grid-cols-1 gap-3">
            <TextAreaField label="ที่อยู่ตามบัตร" value={form.address} onChange={set("address")} />
            <TextAreaField label="ที่อยู่ปัจจุบัน" value={form.homeAddress} onChange={set("homeAddress")} />
          </div>

          {/* ข้อมูลการทำงาน */}
          <SectionLabel>ข้อมูลการทำงาน</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SelectField label="สังกัด (แผนก/หน่วยงาน)" value={form.dept} onChange={set("dept")} options={["-- เลือกสังกัด --", ...affiliationNames]} />
            <SelectField label="ตำแหน่ง" value={form.position} onChange={set("position")} options={["-- เลือกตำแหน่ง --", ...filteredPositions]} />
            <SelectField label="ประเภทพนักงาน" value={form.employeeType} onChange={set("employeeType")} options={["พนักงานประจำ", "พนักงานชั่วคราว", "พนักงานทดลองงาน"]} />
            <InputField label="วันที่เริ่มงาน" value={form.startDate} onChange={set("startDate")} placeholder="YYYY-MM-DD" />
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
            <SelectField label="สถานะ" value={form.status} onChange={set("status")} options={STATUS_OPTIONS} />
            <SelectField label="สิทธิ์การใช้งาน" value={form.role} onChange={set("role")} options={ROLE_OPTIONS} />
          </div>

          {/* ข้อมูลครอบครัว */}
          <SectionLabel>ข้อมูลครอบครัว</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SelectField label="สถานภาพสมรส" value={form.maritalStatus} onChange={set("maritalStatus")} options={["โสด", "สมรส", "หย่าร้าง", "หม้าย"]} />
            <InputField label="ชื่อคู่สมรส" value={form.spouseName} onChange={set("spouseName")} />
            <InputField label="เบอร์โทรคู่สมรส" value={form.spousePhone} onChange={set("spousePhone")} type="tel" />
            <div />
            <InputField label="ชื่อบิดา" value={form.fatherName} onChange={set("fatherName")} />
            <InputField label="เบอร์โทรบิดา" value={form.fatherPhone} onChange={set("fatherPhone")} type="tel" />
            <InputField label="ชื่อมารดา" value={form.motherName} onChange={set("motherName")} />
            <InputField label="เบอร์โทรมารดา" value={form.motherPhone} onChange={set("motherPhone")} type="tel" />
          </div>

          {/* ผู้ติดต่อฉุกเฉิน */}
          <SectionLabel>ผู้ติดต่อฉุกเฉิน</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputField label="ชื่อผู้ติดต่อฉุกเฉิน" value={form.emergencyName} onChange={set("emergencyName")} />
            <InputField label="ความสัมพันธ์" value={form.emergencyRelation} onChange={set("emergencyRelation")} />
            <InputField label="เบอร์โทรฉุกเฉิน" value={form.emergencyPhone} onChange={set("emergencyPhone")} type="tel" />
          </div>

          {/* บัญชีผู้ใช้ */}
          <SectionLabel>บัญชีผู้ใช้</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputField label="Username" value={form.username} onChange={set("username")} placeholder="auto-generated if empty" />
          </div>
        </DialogBody>

        <DialogFooter className="px-6 pb-6 pt-4 border-t border-border">
          <button onClick={() => onOpenChange(false)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
            <X className="w-4 h-4" /> ยกเลิก
          </button>
          <button onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-primary-foreground transition-all"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}>
            <Save className="w-4 h-4" /> {isEdit ? "บันทึก" : "เพิ่มพนักงาน"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeFormDialog;
