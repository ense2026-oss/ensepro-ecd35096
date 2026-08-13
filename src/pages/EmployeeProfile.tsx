import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Camera, Edit, Save, X, Plus, Trash2,
  User, Briefcase, Users, GraduationCap, Clock, Shield, Receipt,
  Phone, Mail, MapPin, Calendar, CreditCard, Droplets,
  Building, Star, Lock, Eye, EyeOff, AlertCircle, Palette, Paperclip
} from "lucide-react";

import { ThaiDatePicker } from "@/components/ui/thai-date-picker";
import { useEmployees } from "@/contexts/EmployeeContext";
import { useOrg, type Position } from "@/contexts/OrgContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useRoleOptions } from "@/hooks/useRoleOptions";
import { toast } from "sonner";
import { TaxDeduction, DEFAULT_TAX_DEDUCTION, calculateTotalDeductions, calculateAnnualIncome, calculateExpenseDeduction, calculateProgressiveTax, formatCurrency } from "@/utils/taxCalculation";
import { processFileUpload } from "@/utils/fileCompression";
import LazyImage from "@/components/ui/lazy-image";
import defaultAvatarImg from "@/assets/default-avatar.png";
import { supabase } from "@/integrations/supabase/client";
import DisplaySettings, { getPersonalDisplayKey } from "@/components/settings/DisplaySettings";
import EmployeeDocuments from "@/components/employees/EmployeeDocuments";

const TAB_CONFIG = [
  { key: "personal",   label: "ข้อมูลส่วนตัว",   icon: User },
  { key: "work",       label: "ข้อมูลการทำงาน",  icon: Briefcase },
  { key: "family",     label: "ข้อมูลครอบครัว",  icon: Users },
  { key: "documents",  label: "เอกสารแนบ",       icon: Paperclip },
  { key: "workhistory",label: "ประวัติ",          icon: Clock },
  { key: "tax",        label: "ข้อมูลภาษี",      icon: Receipt },
  { key: "security",   label: "ความปลอดภัย",     icon: Shield },
  { key: "display",    label: "การแสดงผล",       icon: Palette },
];

/* ───────────────────── Helpers ───────────────────── */
const THAI_MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const formatThaiDate = (dateStr: string): string => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
};

/* ───────────────────── Sub-components ───────────────────── */
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 mt-6 first:mt-0">{children}</p>
);

const Field = ({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ElementType }) => (
  <div className="space-y-1">
    <p className="text-xs text-muted-foreground">{label}</p>
    <div className="flex items-center gap-2">
      {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  </div>
);

const InputField = ({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) => (
  <div className="space-y-1.5">
    <label className="text-xs font-medium text-muted-foreground">{label}</label>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/30 outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
  </div>
);

const DatePickerField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-medium text-muted-foreground">{label}</label>
    <ThaiDatePicker value={value} onChange={onChange} />
  </div>
);

type SelectOption = string | { value: string; label: string };
const SelectField = ({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: SelectOption[];
}) => (
  <div className="space-y-1.5">
    <label className="text-xs font-medium text-muted-foreground">{label}</label>
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/30 outline-none focus:ring-2 focus:ring-primary/30 transition-all cursor-pointer">
      {options.map((o) => {
        const val = typeof o === "string" ? o : o.value;
        const lbl = typeof o === "string" ? o : o.label;
        return <option key={val} value={val}>{lbl}</option>;
      })}
    </select>
  </div>
);

/* ───────────────────── Shared label maps ───────────────────── */
const STATUS_OPTIONS: SelectOption[] = [
  { value: "active", label: "ทำงานปกติ" },
  { value: "leave", label: "ลาพัก" },
  { value: "inactive", label: "พ้นสภาพ" },
];

/* ───────────────────── Main Component ───────────────────── */
const EmployeeProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getEmployeeById, updateEmployee, loading } = useEmployees();
  const { currentUser } = useAuth();
  const { affiliations, orgLevelsFlat } = useOrg();
  const ROLE_OPTIONS = useRoleOptions();
  // Restricted fields (salary, role, ...) follow the permission matrix, not hardcoded role names
  const { canAction, getScope } = usePermissions();
  const canEditRestricted =
    canAction(currentUser?.role || "", "employees", "edit") &&
    getScope(currentUser?.role || "", "employees") === "all";

  // Fetch org levels assigned to this employee
  const [employeeOrgLevels, setEmployeeOrgLevels] = useState<string[]>([]);
  useEffect(() => {
    if (!id) return;
    const fetchOrgLevels = async () => {
      const { data } = await supabase.from("org_level_employees").select("org_level_id").eq("employee_id", id);
      if (data && data.length > 0) {
        const names = data.map(row => {
          const ol = orgLevelsFlat.find(o => o.id === row.org_level_id);
          return ol?.name || "";
        }).filter(Boolean);
        setEmployeeOrgLevels(names);
      } else {
        setEmployeeOrgLevels([]);
      }
    };
    fetchOrgLevels();
  }, [id, orgLevelsFlat]);

  // Flatten position tree to get all position names for a given affiliation
  const flattenPositionNames = (positions: Position[]): string[] => {
    const names: string[] = [];
    const walk = (list: Position[]) => {
      for (const p of list) {
        names.push(p.name);
        if (p.children?.length) walk(p.children);
      }
    };
    walk(positions);
    return names;
  };

  // Position options synced with "จัดการสังกัด": positions of the matching
  // affiliation, falling back to ALL positions when the dept doesn't match
  // any affiliation (or that affiliation has none defined yet).
  const positionOptions = (dept: string): string[] => {
    const aff = affiliations.find((a) => a.name === dept);
    const matched = aff ? flattenPositionNames(aff.positions) : [];
    if (matched.length) return matched;
    const all = new Set<string>();
    affiliations.forEach((a) => flattenPositionNames(a.positions).forEach((n) => all.add(n)));
    return Array.from(all);
  };

  const employee = getEmployeeById(id || "");

  const [activeTab, setActiveTab] = useState("personal");
  const [isEditing, setIsEditing] = useState(false);
  const [data, setData] = useState(employee ? { ...employee } : null);

  // Sync local data when the employee list finishes loading asynchronously.
  // The useState initializer above only runs once, so a late-arriving list
  // (e.g. when the profile is opened directly by URL or refreshed) would
  // otherwise leave `data` null forever and wrongly show "not found".
  useEffect(() => {
    if (isEditing) return;
    if (employee && !data) {
      setData({ ...employee });
    }
  }, [employee, data, isEditing]);


  // Fetch photo_url on-demand (not included in list query for performance)
  useEffect(() => {
    if (!id || !employee) return;
    if (employee.photoUrl) return; // already has photo
    supabase.from("employees").select("photo_url").eq("id", id).maybeSingle().then(({ data: row }) => {
      if (row?.photo_url) {
        setData((d) => d ? { ...d, photoUrl: row.photo_url } : d);
      }
    });
  }, [id, employee]);
  const [showPassword, setShowPassword] = useState(false);
  const [showInitialPassword, setShowInitialPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [slideState, setSlideState] = useState<"entering" | "visible" | "exiting">("entering");

  useEffect(() => {
    const t = requestAnimationFrame(() => setSlideState("visible"));
    return () => cancelAnimationFrame(t);
  }, []);

  const handleBack = useCallback(() => {
    setSlideState("exiting");
    setTimeout(() => navigate("/employees"), 350);
  }, [navigate]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so selecting the same file again still triggers onChange
    e.target.value = "";
    const photoUrl = await processFileUpload(file, { maxWidth: 400, maxHeight: 400, quality: 0.8 });
    if (!photoUrl) return;
    if (!employee) return;

    const isOwnProfile = !!currentUser?.employeeId && currentUser.employeeId === employee.id;

    try {
      if (isOwnProfile) {
        // Employees can only edit their own record via a safe RPC that updates
        // just the photo — the direct UPDATE is blocked by RLS for non-admins.
        const { error } = await supabase.rpc("update_own_employee_photo", { _photo_url: photoUrl });
        if (error) throw error;
      } else {
        // Admin/HR editing someone else's profile uses the normal update path.
        await updateEmployee(employee.id, { photoUrl });
      }
      setData((d) => d ? { ...d, photoUrl } : d);
      toast.success("อัพโหลดรูปภาพสำเร็จ");
    } catch (err) {
      console.error("Photo upload failed:", err);
      toast.error("ไม่สามารถบันทึกรูปภาพได้ กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ");
    }
  };


  // While the employee list is still loading (e.g. direct URL open / refresh),
  // show a spinner instead of prematurely rendering the "not found" screen.
  if (loading && (!employee || !data)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-10 h-10 rounded-full border-2 border-muted border-t-primary animate-spin" />
        <p className="text-sm text-muted-foreground">กำลังโหลดข้อมูลพนักงาน...</p>
      </div>
    );
  }

  // Not found (only after loading has completed)
  if (!employee || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <AlertCircle className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-bold">ไม่พบข้อมูลพนักงาน</h2>
        <p className="text-sm text-muted-foreground">ไม่พบพนักงานที่มี ID นี้ในระบบ</p>
        <button onClick={handleBack}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 shadow-md transition-all">
          <ArrowLeft className="w-4 h-4" /> กลับไปหน้ารายชื่อ
        </button>
      </div>
    );
  }

  const emp = data;
  const set = (key: keyof typeof data) => (v: string) => setData((d) => d ? { ...d, [key]: v } : d);

  // Education CRUD
  const addEducation = () =>
    setData((d) => d ? { ...d, education: [...d.education, { id: Date.now(), level: "", institution: "", major: "", year: "" }] } : d);
  const removeEducation = (eduId: number) =>
    setData((d) => d ? { ...d, education: d.education.filter((e) => e.id !== eduId) } : d);
  const updateEdu = (eduId: number, field: string, val: string) =>
    setData((d) => d ? { ...d, education: d.education.map((e) => e.id === eduId ? { ...e, [field]: val } : e) } : d);

  // Work History CRUD
  const addWork = () =>
    setData((d) => d ? { ...d, workHistory: [...d.workHistory, { id: Date.now(), company: "", position: "", startDate: "", endDate: "", reason: "" }] } : d);
  const removeWork = (wId: number) =>
    setData((d) => d ? { ...d, workHistory: d.workHistory.filter((w) => w.id !== wId) } : d);
  const updateWork = (wId: number, field: string, val: string) =>
    setData((d) => d ? { ...d, workHistory: d.workHistory.map((w) => w.id === wId ? { ...w, [field]: val } : w) } : d);

  const handleSave = () => {
    if (data) {
      updateEmployee(data.id, data);
      toast.success("บันทึกข้อมูลพนักงานสำเร็จ");
    }
    setIsEditing(false);
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 8) { setPasswordError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"); return; }
    if (newPassword !== confirmPassword) { setPasswordError("รหัสผ่านไม่ตรงกัน"); return; }
    setPasswordError("");
    
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    } catch (err: any) {
      setPasswordError(err.message || "เกิดข้อผิดพลาด");
      return;
    }
    
    setNewPassword("");
    setConfirmPassword("");
    toast.success("เปลี่ยนรหัสผ่านสำเร็จ");
  };


  /* ─── TAB: Personal ─── */
  const personalTab = (
    <div>
      <SectionLabel>ข้อมูลพื้นฐาน</SectionLabel>
      {isEditing ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SelectField label="คำนำหน้า" value={emp.prefix} onChange={set("prefix")} options={["นาย", "นาง", "นางสาว", "ดร.", "ผศ.ดร."]} />
          <InputField label="ชื่อ" value={emp.firstName} onChange={set("firstName")} />
          <InputField label="นามสกุล" value={emp.lastName} onChange={set("lastName")} />
          <InputField label="ชื่อเล่น" value={emp.nickname} onChange={set("nickname")} />
          <DatePickerField label="วันเกิด" value={emp.birthDate} onChange={set("birthDate")} />
          <InputField label="สัญชาติ" value={emp.nationality} onChange={set("nationality")} />
          <SelectField label="ศาสนา" value={emp.religion} onChange={set("religion")} options={["พุทธ", "คริสต์", "อิสลาม", "อื่นๆ"]} />
          <SelectField label="กรุ๊ปเลือด" value={emp.bloodGroup} onChange={set("bloodGroup")} options={["A", "B", "AB", "O"]} />
          <InputField label="เบอร์โทรศัพท์ (10 หลัก)" value={emp.phone} onChange={set("phone")} type="tel" placeholder="0812345678" />
          <InputField label="อีเมล" value={emp.email} onChange={set("email")} type="email" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
          <Field label="คำนำหน้า" value={emp.prefix} />
          <Field label="ชื่อ" value={emp.firstName} />
          <Field label="นามสกุล" value={emp.lastName} />
          <Field label="ชื่อเล่น" value={emp.nickname} />
          <Field label="วันเกิด" value={emp.birthDate} icon={Calendar} />
          <Field label="สัญชาติ" value={emp.nationality} />
          <Field label="ศาสนา" value={emp.religion} />
          <Field label="กรุ๊ปเลือด" value={emp.bloodGroup} icon={Droplets} />
          <Field label="เบอร์โทรศัพท์" value={emp.phone} icon={Phone} />
          <Field label="อีเมล" value={emp.email} icon={Mail} />
        </div>
      )}

      <SectionLabel>บัตรประชาชน</SectionLabel>
      {isEditing ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InputField label="เลขบัตรประชาชน (13 หลัก)" value={emp.nationalId} onChange={set("nationalId")} placeholder="1234567890123" />
          <DatePickerField label="วันที่ออกบัตร" value={emp.idIssueDate} onChange={set("idIssueDate")} />
          <DatePickerField label="วันหมดอายุ" value={emp.idExpireDate} onChange={set("idExpireDate")} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
          <Field label="เลขบัตรประชาชน" value={emp.nationalId} icon={CreditCard} />
          <Field label="วันที่ออกบัตร" value={emp.idIssueDate} icon={Calendar} />
          <Field label="วันหมดอายุ" value={emp.idExpireDate} icon={Calendar} />
        </div>
      )}

      <SectionLabel>ที่อยู่ปัจจุบัน</SectionLabel>
      {isEditing ? (
        <textarea value={emp.address} onChange={(e) => set("address")(e.target.value)} rows={3}
          className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/30 outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none" />
      ) : (
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-sm font-medium">{emp.address}</p>
        </div>
      )}
    </div>
  );

  /* ─── TAB: Work ─── */
  const workTab = (
    <div>
      <SectionLabel>ข้อมูลการทำงาน</SectionLabel>
      {isEditing && canEditRestricted ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SelectField label="แผนก" value={emp.dept} onChange={(v) => { set("dept")(v); set("position")(""); }} options={["", ...affiliations.map(a => a.name)]} />
          <SelectField label="ตำแหน่ง" value={emp.position} onChange={set("position")} options={["", ...positionOptions(emp.dept)]} />
          <SelectField label="ประเภทพนักงาน" value={emp.employeeType} onChange={set("employeeType")} options={["พนักงานประจำ", "พนักงานชั่วคราว", "พนักงานทดลองงาน"]} />
          <DatePickerField label="วันที่เริ่มงาน" value={emp.startDate} onChange={set("startDate")} />
          
          <InputField label="Face Scan ID" value={emp.faceScanId} onChange={set("faceScanId")} />
          <InputField label="เงินเดือน (บาท)" value={emp.salary} onChange={set("salary")} type="number" />
          <SelectField label="สถานะ" value={emp.status} onChange={set("status")} options={STATUS_OPTIONS} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
          {employeeOrgLevels.length > 0 && (
            <Field label="ระดับองค์กร" value={employeeOrgLevels.join(", ")} icon={Building} />
          )}
          <Field label="แผนก" value={emp.dept} icon={Building} />
          <Field label="ตำแหน่ง" value={emp.position} icon={Star} />
          <Field label="ประเภทพนักงาน" value={emp.employeeType} />
          <Field label="วันที่เริ่มงาน" value={formatThaiDate(emp.startDate)} icon={Calendar} />
          <Field label="กะการทำงาน" value={emp.shift} icon={Clock} />
          <Field label="Face Scan ID" value={emp.faceScanId} />
          <Field label="เงินเดือน" value={`฿${Number(emp.salary).toLocaleString()}`} />
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">สถานะ</p>
            <span className={emp.status === "active" ? "badge-present" : emp.status === "leave" ? "badge-leave" : "badge-absent"}>
              {emp.status === "active" ? "ทำงานปกติ" : emp.status === "leave" ? "ลาพัก" : "พ้นสภาพ"}
            </span>
          </div>
        </div>
      )}
    </div>
  );

  /* ─── TAB: Family ─── */
  const familyTab = (
    <div>
      <SectionLabel>ที่อยู่ตามทะเบียนบ้าน</SectionLabel>
      {isEditing ? (
        <textarea value={emp.homeAddress} onChange={(e) => set("homeAddress")(e.target.value)} rows={3}
          className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/30 outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none" />
      ) : (
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-sm font-medium">{emp.homeAddress}</p>
        </div>
      )}
      <SectionLabel>สถานภาพสมรส</SectionLabel>
      {isEditing ? (
        <SelectField label="" value={emp.maritalStatus} onChange={set("maritalStatus")} options={["โสด", "สมรส", "หย่าร้าง", "หม้าย"]} />
      ) : (
        <Field label="สถานภาพ" value={emp.maritalStatus} icon={Users} />
      )}
      <SectionLabel>ข้อมูลบิดามารดา</SectionLabel>
      {isEditing ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField label="ชื่อบิดา" value={emp.fatherName} onChange={set("fatherName")} />
          <InputField label="เบอร์โทรบิดา" value={emp.fatherPhone} onChange={set("fatherPhone")} />
          <InputField label="ชื่อมารดา" value={emp.motherName} onChange={set("motherName")} />
          <InputField label="เบอร์โทรมารดา" value={emp.motherPhone} onChange={set("motherPhone")} />
          {emp.maritalStatus === "สมรส" && (
            <>
              <InputField label="ชื่อคู่สมรส" value={emp.spouseName} onChange={set("spouseName")} />
              <InputField label="เบอร์โทรคู่สมรส" value={emp.spousePhone} onChange={set("spousePhone")} />
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          <Field label="ชื่อบิดา" value={emp.fatherName} />
          <Field label="เบอร์โทรบิดา" value={emp.fatherPhone} icon={Phone} />
          <Field label="ชื่อมารดา" value={emp.motherName} />
          <Field label="เบอร์โทรมารดา" value={emp.motherPhone} icon={Phone} />
          {emp.maritalStatus === "สมรส" && (
            <>
              <Field label="ชื่อคู่สมรส" value={emp.spouseName} />
              <Field label="เบอร์โทรคู่สมรส" value={emp.spousePhone} icon={Phone} />
            </>
          )}
        </div>
      )}
      <SectionLabel>ข้อมูลติดต่อฉุกเฉิน</SectionLabel>
      {isEditing ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <InputField label="ชื่อ-นามสกุล" value={emp.emergencyName} onChange={set("emergencyName")} />
          <InputField label="ความสัมพันธ์" value={emp.emergencyRelation} onChange={set("emergencyRelation")} />
          <InputField label="เบอร์โทรฉุกเฉิน" value={emp.emergencyPhone} onChange={set("emergencyPhone")} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-4">
          <Field label="ชื่อ-นามสกุล" value={emp.emergencyName} />
          <Field label="ความสัมพันธ์" value={emp.emergencyRelation} />
          <Field label="เบอร์โทร" value={emp.emergencyPhone} icon={Phone} />
        </div>
      )}
    </div>
  );

  /* ─── TAB: Education ─── */
  const educationTab = (
    <div>
      <div className="flex items-center justify-between mb-4">
        <SectionLabel>ประวัติการศึกษา</SectionLabel>
        {isEditing && (
          <button onClick={addEducation} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all text-primary-foreground bg-primary hover:bg-primary/90">
            <Plus className="w-3.5 h-3.5" /> เพิ่ม
          </button>
        )}
      </div>
      <div className="space-y-3">
        {emp.education.map((edu, idx) => (
          <div key={edu.id} className="rounded-xl border border-border p-4 relative" style={{ background: "hsl(var(--muted) / 0.3)" }}>
            {isEditing && (
              <button onClick={() => removeEducation(edu.id)} className="absolute top-3 right-3 p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-primary-foreground bg-primary">{idx + 1}</div>
              {!isEditing && <p className="font-semibold text-sm">{edu.level}</p>}
            </div>
            {isEditing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-8">
                <InputField label="ระดับการศึกษา" value={edu.level} onChange={(v) => updateEdu(edu.id, "level", v)} placeholder="ปริญญาตรี" />
                <InputField label="สถาบัน" value={edu.institution} onChange={(v) => updateEdu(edu.id, "institution", v)} />
                <InputField label="สาขาวิชา" value={edu.major} onChange={(v) => updateEdu(edu.id, "major", v)} />
                <InputField label="ปีที่จบ (พ.ศ.)" value={edu.year} onChange={(v) => updateEdu(edu.id, "year", v)} placeholder="2551" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-2">
                <Field label="สถาบัน" value={edu.institution} />
                <Field label="สาขาวิชา" value={edu.major} />
                <Field label="ปีที่จบ" value={edu.year} />
              </div>
            )}
          </div>
        ))}
        {emp.education.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">ยังไม่มีข้อมูลการศึกษา</div>
        )}
      </div>
    </div>
  );

  /* ─── TAB: Work History ─── */
  const workHistoryTab = (
    <div>
      <div className="flex items-center justify-between mb-4">
        <SectionLabel>ประวัติการทำงาน</SectionLabel>
        {isEditing && (
          <button onClick={addWork} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl text-primary-foreground bg-primary hover:bg-primary/90 transition-all">
            <Plus className="w-3.5 h-3.5" /> เพิ่ม
          </button>
        )}
      </div>
      <div className="space-y-3">
        {emp.workHistory.map((w, idx) => (
          <div key={w.id} className="rounded-xl border border-border p-4 relative" style={{ background: "hsl(var(--muted) / 0.3)" }}>
            {isEditing && (
              <button onClick={() => removeWork(w.id)} className="absolute top-3 right-3 p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-primary-foreground bg-primary">{idx + 1}</div>
              {!isEditing && <p className="font-semibold text-sm">{w.company}</p>}
            </div>
            {isEditing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-8">
                <InputField label="บริษัท/องค์กร" value={w.company} onChange={(v) => updateWork(w.id, "company", v)} />
                <InputField label="ตำแหน่ง" value={w.position} onChange={(v) => updateWork(w.id, "position", v)} />
                <InputField label="ปีที่เริ่ม (พ.ศ.)" value={w.startDate} onChange={(v) => updateWork(w.id, "startDate", v)} />
                <InputField label="ปีที่สิ้นสุด (พ.ศ.)" value={w.endDate} onChange={(v) => updateWork(w.id, "endDate", v)} />
                <div className="sm:col-span-2">
                  <InputField label="เหตุผลที่ลาออก" value={w.reason} onChange={(v) => updateWork(w.id, "reason", v)} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-2">
                <Field label="ตำแหน่ง" value={w.position} />
                <Field label="ปีที่เริ่ม" value={w.startDate} />
                <Field label="ปีที่สิ้นสุด" value={w.endDate} />
                <Field label="เหตุผล" value={w.reason} />
              </div>
            )}
          </div>
        ))}
        {emp.workHistory.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">ยังไม่มีประวัติการทำงาน</div>
        )}
      </div>
    </div>
  );

  /* ─── TAB: Tax ─── */
  const taxDeductions = emp.taxDeductions || { ...DEFAULT_TAX_DEDUCTION };
  const setTaxField = (field: keyof TaxDeduction) => (v: string) => {
    const numVal = field === "otherNote" ? 0 : Number(v) || 0;
    setData((d) => {
      if (!d) return d;
      const updated = { ...d.taxDeductions || { ...DEFAULT_TAX_DEDUCTION }, [field]: field === "otherNote" ? v : numVal };
      return { ...d, taxDeductions: updated };
    });
  };

  const annualSalary = calculateAnnualIncome(Number(emp.salary) || 0);
  const expenseDeduction = calculateExpenseDeduction(annualSalary);
  const totalDeductions = calculateTotalDeductions(taxDeductions);
  const netIncome = Math.max(0, annualSalary - expenseDeduction - totalDeductions);
  const annualTax = calculateProgressiveTax(netIncome);
  const monthlyTax = Math.round(annualTax / 12);

  const TaxField = ({ label, value, max, field, auto }: { label: string; value: number; max?: number; field: keyof TaxDeduction; auto?: boolean }) => (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}{max ? ` (สูงสุด ${formatCurrency(max)})` : ""}</label>
      {isEditing && canEditRestricted && !auto ? (
        <input type="number" value={value} onChange={(e) => setTaxField(field)(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/30 outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
      ) : (
        <p className="text-sm font-medium">฿{formatCurrency(value)}{auto ? <span className="text-xs text-muted-foreground ml-1">(อัตโนมัติ)</span> : ""}</p>
      )}
    </div>
  );

  const taxTab = (
    <div>
      <SectionLabel>ค่าลดหย่อนภาษี</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <TaxField label="ค่าลดหย่อนส่วนตัว" value={taxDeductions.personal} field="personal" auto />
        <TaxField label="คู่สมรส (ไม่มีรายได้)" value={taxDeductions.spouse} field="spouse" />
        <TaxField label="บุตร (30,000 x จำนวน)" value={taxDeductions.children} field="children" />
        <TaxField label="บุตรตั้งแต่ปี 2561 (60,000 x จำนวน)" value={taxDeductions.childrenAfter2018} field="childrenAfter2018" />
        <TaxField label="ประกันสังคม" value={taxDeductions.socialSecurity} max={9000} field="socialSecurity" />
        <TaxField label="ประกันชีวิต" value={taxDeductions.lifeInsurance} max={100000} field="lifeInsurance" />
        <TaxField label="กองทุนสำรองเลี้ยงชีพ (PVD)" value={taxDeductions.pvd} max={500000} field="pvd" />
        <TaxField label="เงินบริจาค" value={taxDeductions.donation} field="donation" />
        <TaxField label="ค่าลดหย่อนอื่นๆ" value={taxDeductions.other} field="other" />
      </div>

      {isEditing && canEditRestricted && (
        <div className="mt-3 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">หมายเหตุลดหย่อนอื่นๆ</label>
          <input type="text" value={taxDeductions.otherNote || ""} onChange={(e) => setTaxField("otherNote")(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/30 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            placeholder="ระบุรายละเอียดค่าลดหย่อนอื่นๆ" />
        </div>
      )}

      {emp.maritalStatus === "สมรส" && taxDeductions.spouse === 0 && !isEditing && (
        <div className="mt-3 p-3 rounded-xl border border-border bg-primary/5 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-primary flex-shrink-0" />
          <span>พนักงานสถานะ "สมรส" — อาจมีสิทธิ์ลดหย่อนคู่สมรส 60,000 บาท</span>
        </div>
      )}

      <SectionLabel>สรุปการคำนวณภาษี (ประมาณการ)</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "รายได้รวม/ปี", value: annualSalary },
          { label: "หักค่าใช้จ่าย", value: expenseDeduction },
          { label: "รวมค่าลดหย่อน", value: totalDeductions },
          { label: "รายได้สุทธิ/ปี", value: netIncome },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border p-3" style={{ background: "hsl(var(--muted) / 0.3)" }}>
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="text-lg font-bold mt-1">฿{formatCurrency(item.value)}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <div className="rounded-xl border-2 p-4" style={{ borderColor: "hsl(var(--primary))", background: "hsl(var(--primary) / 0.05)" }}>
          <p className="text-xs text-muted-foreground">ภาษีต่อปี (ประมาณการ)</p>
          <p className="text-2xl font-bold mt-1 text-primary">฿{formatCurrency(annualTax)}</p>
        </div>
        <div className="rounded-xl border-2 p-4" style={{ borderColor: "hsl(var(--primary))", background: "hsl(var(--primary) / 0.05)" }}>
          <p className="text-xs text-muted-foreground">ภาษีต่อเดือน (ประมาณการ)</p>
          <p className="text-2xl font-bold mt-1 text-primary">฿{formatCurrency(monthlyTax)}</p>
        </div>
      </div>
    </div>
  );

  /* ─── TAB: Security ─── */
  const securityTab = (
    <div className="max-w-lg space-y-6">
      <div>
        <SectionLabel>ข้อมูล Account</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {isEditing && canEditRestricted ? (
            <>
              <InputField label="Username" value={emp.username} onChange={set("username")} />
              <SelectField label="สิทธิ์การใช้งาน" value={emp.role} onChange={set("role")} options={ROLE_OPTIONS} />
            </>
          ) : (
            <>
              <Field label="Username" value={emp.username} />
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Role</p>
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-primary/10 text-primary">{emp.role}</span>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">รหัสผ่านเริ่มต้น</p>
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  {canEditRestricted ? (
                    <>
                      <p className="text-sm font-medium font-mono tracking-wider">
                        {showInitialPassword ? (emp.initialPassword || "Password123!") : "••••••••"}
                      </p>
                      <button type="button" onClick={() => setShowInitialPassword(!showInitialPassword)} className="text-muted-foreground hover:text-foreground transition-colors">
                        {showInitialPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </>
                  ) : (
                    <p className="text-sm font-medium font-mono tracking-wider">••••••••</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>


      <div>
        <SectionLabel>เปลี่ยนรหัสผ่าน</SectionLabel>
        <div className="card-base p-5 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">รหัสผ่านใหม่</label>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="อย่างน้อย 8 ตัวอักษร"
                className="w-full px-3 py-2 pr-10 text-sm rounded-xl border border-border bg-muted/30 outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">ยืนยันรหัสผ่านใหม่</label>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="กรอกรหัสผ่านอีกครั้ง"
                className="w-full px-3 py-2 pr-10 text-sm rounded-xl border border-border bg-muted/30 outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {passwordError && (
            <div className="flex items-center gap-2 text-xs text-destructive"><AlertCircle className="w-3.5 h-3.5" />{passwordError}</div>
          )}
          <button onClick={handlePasswordChange}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 shadow-md transition-all">
            <Lock className="w-4 h-4" /> เปลี่ยนรหัสผ่าน
          </button>
        </div>
      </div>
    </div>
  );

  /* ─── TAB: Display (personal preferences) ─── */
  const displayTab = currentUser?.id ? (
    <DisplaySettings storageKey={getPersonalDisplayKey(currentUser.id)} personal />
  ) : (
    <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
      <AlertCircle className="w-4 h-4" /> กรุณาเข้าสู่ระบบเพื่อตั้งค่าการแสดงผลส่วนตัว
    </div>
  );

  const documentsTab = (
    <div className="space-y-4">
      <EmployeeDocuments
        employeeId={emp.id}
        category="personal"
        canEdit={true}
        title="เอกสารส่วนตัว"
        description="เช่น สำเนาบัตรประชาชน ทะเบียนบ้าน รูปถ่าย"
      />
    </div>
  );

  const historyTab = (
    <div className="space-y-8">
      <div className="space-y-4">
        {educationTab}
        <EmployeeDocuments
          employeeId={emp.id}
          category="education"
          canEdit={true}
          title="เอกสารการศึกษา"
          description="เช่น วุฒิการศึกษา ทรานสคริปต์ ใบรับรอง"
        />
      </div>
      <div className="space-y-4">
        {workHistoryTab}
        <EmployeeDocuments
          employeeId={emp.id}
          category="work"
          canEdit={true}
          title="เอกสารการทำงาน"
          description="เช่น สัญญาจ้าง หนังสือรับรอง ใบประเมิน"
        />
      </div>
    </div>
  );

  const tabContent: Record<string, React.ReactNode> = {
    personal: personalTab,
    work: workTab,
    family: familyTab,
    documents: documentsTab,
    workhistory: historyTab,
    tax: taxTab,
    security: securityTab,
    display: displayTab,
  };


  return (
    <div
      className="space-y-5"
      style={{
        transform: slideState === "visible" ? "translateX(0)" : "translateX(100%)",
        opacity: slideState === "visible" ? 1 : 0,
        transition: "transform 350ms cubic-bezier(0.22, 1, 0.36, 1), opacity 350ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {/* Back + Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="p-2 rounded-xl border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold font-display">ข้อมูลพนักงาน</h2>
            <p className="text-xs text-muted-foreground mt-0.5">UUID: <code className="font-mono">{emp.id}</code></p>
          </div>
        </div>
        <div className="flex items-center justify-center sm:justify-end gap-2">
          {isEditing ? (
            <>
              <button onClick={() => { setData({ ...employee }); setIsEditing(false); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
                <X className="w-4 h-4" /> ยกเลิก
              </button>
              <button onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 shadow-md transition-all">
                <Save className="w-4 h-4" /> บันทึก
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 shadow-md transition-all">
              <Edit className="w-4 h-4" /> แก้ไขข้อมูล
            </button>
          )}
        </div>
      </div>

      {/* Profile Card */}
      <div className="card-base p-5">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="relative flex-shrink-0">
            {emp.photoUrl ? (
              <LazyImage src={emp.photoUrl} alt={emp.firstName} className="w-24 h-24 rounded-2xl" />
            ) : (
              <LazyImage src={defaultAvatarImg} alt={emp.firstName || "Default"} className="w-24 h-24 rounded-2xl" />
            )}
            <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); photoInputRef.current?.click(); }}
              className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-primary-foreground shadow-md cursor-pointer bg-primary"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-xl font-bold font-display">
              {emp.prefix} {emp.firstName} {emp.lastName}
              <span className="text-base font-normal text-muted-foreground ml-2">({emp.nickname})</span>
            </h3>
            <p className="text-sm font-medium mt-1 text-primary">{emp.position}</p>
            <p className="text-xs text-muted-foreground">{emp.dept}</p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-3 mt-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Phone className="w-3.5 h-3.5" /> {emp.phone}</div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Mail className="w-3.5 h-3.5" /> {emp.email}</div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Calendar className="w-3.5 h-3.5" /> เริ่มงาน {formatThaiDate(emp.startDate)}</div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className={emp.status === "active" ? "badge-present" : emp.status === "leave" ? "badge-leave" : "badge-absent"}>
              {emp.status === "active" ? "ทำงานปกติ" : emp.status === "leave" ? "ลาพัก" : "พ้นสภาพ"}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary">{emp.role}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card-base overflow-hidden">
        <div className="border-b border-border">
          <div className="flex justify-between lg:justify-start">
            {TAB_CONFIG.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setActiveTab(key)}
                className="flex items-center justify-center gap-2 flex-1 lg:flex-none px-2 lg:px-4 py-3.5 text-sm font-medium whitespace-nowrap transition-all border-b-2 -mb-px"
                style={{
                  borderColor: activeTab === key ? "hsl(var(--primary))" : "transparent",
                  color: activeTab === key ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                  background: activeTab === key ? "hsl(var(--primary) / 0.05)" : "transparent",
                }}
                title={label}>
                <Icon className="w-4 h-4" /> <span className="hidden lg:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="p-5 sm:p-6">{tabContent[activeTab]}</div>
      </div>
    </div>
  );
};

export default EmployeeProfile;
