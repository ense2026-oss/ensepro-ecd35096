import { useState, useEffect, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Save, X, ScanFace, Upload, Camera, Loader2, Eye, EyeOff, KeyRound } from "lucide-react";
import type { Employee } from "@/contexts/EmployeeContext";
import { useOrg } from "@/contexts/OrgContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { logInfo } from "@/lib/systemLog";
import ApproverMultiSelect from "@/components/approvals/ApproverMultiSelect";
import { useApprovalAssignments, saveEmployeeApprovers } from "@/lib/approvalAssignments";
import { useRoleOptions, matchRoleOption } from "@/hooks/useRoleOptions";
import { useEmployeeFieldOptions } from "@/hooks/useEmployeeFieldOptions";
import { processFileUpload } from "@/utils/fileCompression";
import { supabase } from "@/integrations/supabase/client";

interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Employee | null;
  onSave: (data: Omit<Employee, "id" | "education" | "workHistory">) => Promise<void> | void;
}

const EMPTY: Omit<Employee, "id" | "education" | "workHistory"> = {
  avatar: "", avatarColor: "", avatarTextColor: "", photoUrl: "",
  prefix: "นาย", firstName: "", lastName: "", nickname: "",
  birthDate: "", gender: "ชาย", nationalId: "", nationality: "ไทย", religion: "พุทธ", bloodGroup: "A",
  idIssueDate: "", idExpireDate: "",
  phone: "", email: "", address: "",
  dept: "", position: "", employeeType: "พนักงานประจำ",
  startDate: "", trialEndDate: "", contractEndDate: "",
  shift: "", faceScanId: "", salary: "", status: "active",
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
  const { affiliations, affiliationNames } = useOrg();
  const ROLE_OPTIONS = useRoleOptions();
  const { options: fieldOptions } = useEmployeeFieldOptions();
  const [form, setForm] = useState<Omit<Employee, "id" | "education" | "workHistory">>(EMPTY);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [shiftNames, setShiftNames] = useState<string[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // ─── บัญชีเข้าสู่ระบบ (ชื่อผู้ใช้/รหัสผ่าน) — แก้ได้เฉพาะ admin/hr ───
  // username/password จริงอยู่ใน Supabase Auth ไม่ใช่ตาราง employees จึงต้องเรียก
  // edge function (service-role) เหมือนหน้าโปรไฟล์ ห้ามแก้ผ่าน updateEmployee ตรง ๆ
  const { currentUser } = useAuth();
  const { canAction, getScope } = usePermissions();
  const roleKey = (currentUser?.role || "").toLowerCase();
  const isAdminOrHr = ["admin", "hr"].includes(roleKey);
  // ตรงกับเงื่อนไขของ edge function admin-update-username: admin/hr หรือ role ที่แก้พนักงานได้ทั้งองค์กร
  const canEditUsername = isAdminOrHr || (canAction(roleKey, "employee", "edit") && getScope(roleKey, "employee") === "all");
  const hasLogin = isEdit && !!employee?.userId;
  const [usernameInput, setUsernameInput] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  // ─── ผู้อนุมัติการลา (กำหนดรายบุคคล — แก้ไขเฉพาะโหมดแก้ไข) ───
  // เก็บในตาราง approval_assignments แยกจากข้อมูลพนักงาน จึงบันทึกแยกหลังบันทึกข้อมูลหลักสำเร็จ
  const canEditApprovers = isEdit && canEditUsername;
  const { approversOf, loading: approversLoading, refetch: refetchApprovers } =
    useApprovalAssignments("leave", open && canEditApprovers);
  const [approverIds, setApproverIds] = useState<string[]>([]);
  const approversInitFor = useRef<string | null>(null);
  useEffect(() => {
    if (!open) { approversInitFor.current = null; return; }
    if (!employee || !canEditApprovers || approversLoading) return;
    if (approversInitFor.current === employee.id) return; // ตั้งต้นครั้งเดียวต่อการเปิด ไม่ทับสิ่งที่กำลังแก้
    approversInitFor.current = employee.id;
    setApproverIds(approversOf(employee.id));
  }, [open, employee, canEditApprovers, approversLoading, approversOf]);

  // ผู้อนุมัติแก้ไขเวลา (ชนิดเดียวกัน คนละ request_type)
  const { approversOf: timeEditApproversOf, loading: timeEditLoading, refetch: refetchTimeEditApprovers } =
    useApprovalAssignments("time_edit", open && canEditApprovers);
  const [timeEditApproverIds, setTimeEditApproverIds] = useState<string[]>([]);
  const timeEditInitFor = useRef<string | null>(null);
  useEffect(() => {
    if (!open) { timeEditInitFor.current = null; return; }
    if (!employee || !canEditApprovers || timeEditLoading) return;
    if (timeEditInitFor.current === employee.id) return;
    timeEditInitFor.current = employee.id;
    setTimeEditApproverIds(timeEditApproversOf(employee.id));
  }, [open, employee, canEditApprovers, timeEditLoading, timeEditApproversOf]);

  const isDeptSelected = !!form.dept && form.dept !== "-- เลือกสังกัด --";

  // Roles come from Settings > สิทธิ์ผู้ใช้งาน. If the employee currently holds a
  // role that no longer exists there, keep it as an explicit option so the
  // browser does not silently switch them to the first option on save.
  const isUnknownRole = !!form.role && !matchRoleOption(ROLE_OPTIONS, form.role);
  const roleSelectOptions = useMemo(
    () =>
      isUnknownRole
        ? [{ value: form.role, label: `${form.role} (ไม่มีในการตั้งค่าแล้ว)` }, ...ROLE_OPTIONS]
        : ROLE_OPTIONS,
    [isUnknownRole, form.role, ROLE_OPTIONS]
  );

  const shiftOptions = useMemo(() => {
    const list = ["-- เลือกกะการทำงาน --", ...shiftNames];
    return form.shift && !list.includes(form.shift) ? [...list, form.shift] : list;
  }, [shiftNames, form.shift]);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("shifts")
      .select("name,start_time,end_time,sort_order")
      .order("sort_order")
      .then(({ data }) => {
        setShiftNames(
          (data || []).map((s: any) =>
            s.start_time && s.end_time ? `${s.name} ${s.start_time}-${s.end_time}` : s.name
          )
        );
      });
  }, [open]);

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
    if (!aff) return [];
    // Deduplicate by name: the positions table may contain multiple rows with
    // the same name (headcount slots), but the dropdown only needs each once.
    return Array.from(new Set(collectNames(aff.positions)));
  }, [form.dept, affiliations]);

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
      setSaving(false);
      setUsernameInput(employee?.username || "");
      setNewPassword("");
      setShowNewPassword(false);
    }
  }, [open, employee]);

  // Align the stored role with the exact value used by the settings page
  // (e.g. "hr" stored on an employee resolves to the "HR" option).
  useEffect(() => {
    if (!open || !form.role || !ROLE_OPTIONS.length) return;
    const matched = matchRoleOption(ROLE_OPTIONS, form.role);
    if (matched && matched.value !== form.role) {
      setForm((f) => ({ ...f, role: matched.value }));
    }
  }, [open, form.role, ROLE_OPTIONS]);

  const set = (key: string) => (v: string) => setForm((f) => ({ ...f, [key]: v }));
  const setNumber = (key: string) => (v: string) =>
    setForm((f) => ({ ...f, [key]: Math.max(0, Number(v) || 0) }));

  // When the department changes, reset the position so it must be re-picked
  // from the newly selected affiliation's positions.
  const handleDeptChange = (v: string) => setForm((f) => ({ ...f, dept: v, position: "" }));

  const handleSave = async () => {
    const errs: string[] = [];
    if (!form.firstName.trim()) errs.push("กรุณากรอกชื่อ");
    if (!form.lastName.trim()) errs.push("กรุณากรอกนามสกุล");
    if (!form.dept.trim() || form.dept === "-- เลือกสังกัด --") errs.push("กรุณาเลือกสังกัด");
    if (!form.position.trim() || form.position === "-- เลือกตำแหน่ง --") errs.push("กรุณาเลือกตำแหน่ง");
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      errs.push("รูปแบบอีเมลไม่ถูกต้อง");
    if (!isEdit && !form.email.trim()) errs.push("กรุณากรอกอีเมล เพื่อสร้างบัญชีเข้าใช้งานให้พนักงาน");
    if (!form.role.trim() || isUnknownRole) errs.push("กรุณาเลือกสิทธิ์การใช้งานจากรายการในหน้าตั้งค่า");

    // ตรวจชื่อผู้ใช้/รหัสผ่านใหม่ (เฉพาะโหมดแก้ไขของพนักงานที่มีบัญชีเข้าสู่ระบบ)
    const nextUsername = usernameInput.trim().toLowerCase();
    const usernameChanged = hasLogin && canEditUsername && !!nextUsername && nextUsername !== (employee?.username || "");
    const passwordChanged = hasLogin && isAdminOrHr && newPassword.length > 0;
    const loginEmail = `${nextUsername}@ensepro.com`;
    if (usernameChanged) {
      if (!/^[a-z0-9._-]+$/.test(nextUsername)) errs.push("ชื่อผู้ใช้ใช้ได้เฉพาะ a-z, 0-9, . _ - (ห้ามเว้นวรรค/ภาษาไทย)");
      // ชื่อผู้ใช้กับอีเมลเข้าสู่ระบบผูกกัน (<ชื่อผู้ใช้>@ensepro.com) — แก้พร้อมกันไม่ได้ กันอีเมลถูกตีกลับ
      if (form.email.trim().toLowerCase() !== (employee?.email || "").trim().toLowerCase())
        errs.push("เปลี่ยนชื่อผู้ใช้และอีเมลพร้อมกันไม่ได้ (ชื่อผู้ใช้จะกำหนดอีเมลเข้าสู่ระบบให้อัตโนมัติ) กรุณาแยกบันทึกทีละอย่าง");
    }
    if (passwordChanged && newPassword.length < 8) errs.push("รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร");
    if (errs.length) { setErrors(errs); return; }

    const avatar = form.firstName.charAt(0) || "?";
    const hue = Math.floor(Math.random() * 360);
    setSaving(true);
    try {
      let savedUsername = form.username;
      let savedEmail = form.email.trim();
      let savedInitialPassword = form.initialPassword;
      const isOwn = !!employee && !!currentUser?.employeeId && currentUser.employeeId === employee.id;

      // 1) เปลี่ยนชื่อผู้ใช้ (Auth + employees + profiles ผ่าน service-role)
      if (usernameChanged) {
        const { data: fnData, error: fnErr } = await supabase.functions.invoke("admin-update-username", {
          body: { employeeId: employee!.id, newUsername: nextUsername },
        });
        if (fnErr || fnData?.error) throw new Error(fnData?.error || fnErr?.message || "เปลี่ยนชื่อผู้ใช้ไม่สำเร็จ");
        savedUsername = nextUsername;
        savedEmail = loginEmail; // ให้ตรงกับที่ฟังก์ชันตั้งไว้ใน Auth/ตาราง จะได้ไม่ถูกบันทึกทับกลับ
        logInfo("account", `เปลี่ยนชื่อผู้ใช้: ${employee?.firstName || ""} → ${nextUsername}`, { employeeId: employee?.id, newUsername: nextUsername });
      }

      // 2) รีเซ็ตรหัสผ่าน — ถ้าเป็นบัญชีตัวเองใช้ auth.updateUser ส่วนของคนอื่นต้องใช้ service-role เท่านั้น
      if (passwordChanged) {
        try {
          if (isOwn) {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
          } else {
            const targetEmail = usernameChanged ? loginEmail : (employee?.email || "");
            if (!targetEmail) throw new Error("พนักงานคนนี้ไม่มีอีเมลสำหรับเข้าสู่ระบบ");
            const { data: fnData, error: fnErr } = await supabase.functions.invoke("admin-reset-password", {
              body: { email: targetEmail, password: newPassword },
            });
            if (fnErr || fnData?.error) throw new Error(fnData?.error || fnErr?.message || "รีเซ็ตรหัสผ่านไม่สำเร็จ");
          }
        } catch (pwErr: any) {
          throw new Error(
            (usernameChanged ? "เปลี่ยนชื่อผู้ใช้สำเร็จแล้ว แต่" : "") + "รีเซ็ตรหัสผ่านไม่สำเร็จ: " + (pwErr?.message || "เกิดข้อผิดพลาด")
          );
        }
        // admin-reset-password sync employees.initial_password ให้แล้ว — ส่งค่าใหม่ไปด้วยกันบันทึกทับของเก่า
        savedInitialPassword = newPassword;
        logInfo("account", isOwn ? "เปลี่ยนรหัสผ่านของตนเอง" : `รีเซ็ตรหัสผ่านของ ${employee?.firstName || "พนักงาน"} ${employee?.lastName || ""}`.trim(), { employeeId: employee?.id, own: isOwn });
      }

      await onSave({
        ...form,
        email: savedEmail,
        initialPassword: savedInitialPassword,
        avatar,
        avatarColor: isEdit ? form.avatarColor : `hsl(${hue} 70% 90%)`,
        avatarTextColor: isEdit ? form.avatarTextColor : `hsl(${hue} 70% 35%)`,
        username: savedUsername || `${form.firstName.toLowerCase()}.${form.lastName.charAt(0).toLowerCase()}`,
      });

      // ผู้อนุมัติการลา — บันทึกเมื่อมีการเปลี่ยนแปลงเท่านั้น
      if (canEditApprovers && employee && approversInitFor.current === employee.id) {
        const before = [...approversOf(employee.id)].sort().join("|");
        const after = [...new Set(approverIds)].sort().join("|");
        if (before !== after) {
          try {
            await saveEmployeeApprovers(employee.id, approverIds, "leave");
            await refetchApprovers();
            logInfo("account", `ตั้งผู้อนุมัติการลา: ${employee.firstName} ${employee.lastName}`, { employeeId: employee.id, approverIds });
          } catch (apErr: any) {
            throw new Error("บันทึกข้อมูลพนักงานแล้ว แต่บันทึกผู้อนุมัติการลาไม่สำเร็จ: " + (apErr?.message || "เกิดข้อผิดพลาด"));
          }
        }
      }

      // ผู้อนุมัติแก้ไขเวลา — บันทึกเมื่อมีการเปลี่ยนแปลงเท่านั้น
      if (canEditApprovers && employee && timeEditInitFor.current === employee.id) {
        const before = [...timeEditApproversOf(employee.id)].sort().join("|");
        const after = [...new Set(timeEditApproverIds)].sort().join("|");
        if (before !== after) {
          try {
            await saveEmployeeApprovers(employee.id, timeEditApproverIds, "time_edit");
            await refetchTimeEditApprovers();
            logInfo("account", `ตั้งผู้อนุมัติแก้ไขเวลา: ${employee.firstName} ${employee.lastName}`, { employeeId: employee.id, approverIds: timeEditApproverIds });
          } catch (apErr: any) {
            throw new Error("บันทึกข้อมูลพนักงานแล้ว แต่บันทึกผู้อนุมัติแก้ไขเวลาไม่สำเร็จ: " + (apErr?.message || "เกิดข้อผิดพลาด"));
          }
        }
      }
      onOpenChange(false);
    } catch (err: any) {
      setErrors([err?.message || "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"]);
    } finally {
      setSaving(false);
    }
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
            <SelectField label="คำนำหน้า" value={form.prefix} onChange={set("prefix")} options={fieldOptions.prefixes} />
            <SelectField label="เพศ" value={form.gender || "ชาย"} onChange={set("gender")} options={fieldOptions.genders} />
            <InputField label="ชื่อ" value={form.firstName} onChange={set("firstName")} required />
            <InputField label="นามสกุล" value={form.lastName} onChange={set("lastName")} required />
            <InputField label="ชื่อเล่น" value={form.nickname} onChange={set("nickname")} />
            <InputField label="วันเกิด" value={form.birthDate} onChange={set("birthDate")} placeholder="YYYY-MM-DD" />
            <InputField label="เลขบัตรประชาชน" value={form.nationalId} onChange={set("nationalId")} placeholder="X-XXXX-XXXXX-XX-X" />
            <SelectField label="สัญชาติ" value={form.nationality} onChange={set("nationality")} options={fieldOptions.nationalities} />
            <SelectField label="ศาสนา" value={form.religion} onChange={set("religion")} options={fieldOptions.religions} />
            <SelectField label="หมู่เลือด" value={form.bloodGroup} onChange={set("bloodGroup")} options={fieldOptions.bloodGroups} />
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
            <SelectField label="สังกัด (แผนก/หน่วยงาน)" value={form.dept} onChange={handleDeptChange} options={["-- เลือกสังกัด --", ...affiliationNames]} />
            <SelectField
              label="ตำแหน่ง"
              value={form.position}
              onChange={set("position")}
              disabled={!isDeptSelected}
              options={isDeptSelected ? ["-- เลือกตำแหน่ง --", ...filteredPositions] : ["-- เลือกสังกัดก่อน --"]}
              hint={!isDeptSelected ? "กรุณาเลือกสังกัดก่อน" : undefined}
            />

            <SelectField label="ประเภทพนักงาน" value={form.employeeType} onChange={set("employeeType")} options={fieldOptions.employeeTypes} />
            <SelectField
              label="กะการทำงาน"
              value={form.shift || "-- เลือกกะการทำงาน --"}
              onChange={(v) => set("shift")(v === "-- เลือกกะการทำงาน --" ? "" : v)}
              options={shiftOptions}
            />
            <InputField label="วันที่เริ่มงาน" value={form.startDate} onChange={set("startDate")} placeholder="YYYY-MM-DD" />
            <InputField label="วันสิ้นสุดทดลองงาน" value={form.trialEndDate} onChange={set("trialEndDate")} placeholder="YYYY-MM-DD" />
            <InputField label="วันสิ้นสุดสัญญาจ้าง" value={form.contractEndDate} onChange={set("contractEndDate")} placeholder="YYYY-MM-DD" />
            <InputField label="เงินเดือน (บาท)" value={form.salary} onChange={set("salary")} type="number" />
            <InputField label="เลขบัญชีธนาคาร" value={form.bankAccount} onChange={set("bankAccount")} />
            <InputField label="เลขใบขับขี่" value={form.driverLicense} onChange={set("driverLicense")} />
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
            <SelectField
              label="สิทธิ์การใช้งาน"
              value={form.role}
              onChange={set("role")}
              options={roleSelectOptions}
              hint={
                isUnknownRole
                  ? "สิทธิ์นี้ไม่มีอยู่ในหน้าตั้งค่าสิทธิ์ผู้ใช้งานแล้ว กรุณาเลือกสิทธิ์ใหม่"
                  : "รายการมาจากหน้าตั้งค่า > สิทธิ์ผู้ใช้งาน · การเปลี่ยนสิทธิ์มีผลกับบัญชีเข้าใช้งานทันที"
              }
            />
          </div>

          {/* บัญชีเข้าสู่ระบบ — เฉพาะโหมดแก้ไขและผู้ที่มีสิทธิ์ (admin/hr) */}
          {isEdit && canEditUsername && (
            <>
              <SectionLabel>บัญชีเข้าสู่ระบบ</SectionLabel>
              {!hasLogin ? (
                <p className="text-xs text-muted-foreground rounded-xl border border-dashed border-border px-3 py-2.5">
                  พนักงานคนนี้ยังไม่มีบัญชีเข้าสู่ระบบ จึงยังตั้งชื่อผู้ใช้/รหัสผ่านไม่ได้
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">ชื่อผู้ใช้ (สำหรับเข้าสู่ระบบ)</label>
                    <input
                      type="text"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                      placeholder="เช่น areenan.s"
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/30 outline-none focus:ring-2 focus:ring-primary/30 transition-all font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      ใช้ a-z, 0-9, . _ - เท่านั้น · อีเมลเข้าสู่ระบบจะเป็น {(usernameInput.trim() || "ชื่อผู้ใช้")}@ensepro.com
                    </p>
                  </div>
                  {isAdminOrHr && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5" /> รหัสผ่านใหม่
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยน"
                          autoComplete="new-password"
                          className="w-full px-3 py-2 pr-10 text-sm rounded-xl border border-border bg-muted/30 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          title={showNewPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                          aria-label={showNewPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">อย่างน้อย 8 ตัวอักษร · มีผลกับการเข้าสู่ระบบของพนักงานทันทีเมื่อกดบันทึก</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ผู้อนุมัติการลา — เฉพาะโหมดแก้ไขและผู้ที่มีสิทธิ์ */}
          {canEditApprovers && (
            <>
              <SectionLabel>ผู้อนุมัติการลา</SectionLabel>
              <div className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground">
                  ผู้ที่อนุมัติใบลาของพนักงานคนนี้ได้ — เลือกได้หลายคน <b>คนใดคนหนึ่งอนุมัติก็จบ</b>
                  · admin/hr อนุมัติแทนได้เสมอ
                </p>
                <ApproverMultiSelect
                  value={approverIds}
                  onChange={setApproverIds}
                  excludeEmployeeId={employee?.id}
                  disabled={approversLoading}
                />
              </div>
              <SectionLabel>ผู้อนุมัติแก้ไขเวลา</SectionLabel>
              <div className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground">
                  ผู้ที่อนุมัติ/ปฏิเสธคำขอแก้ไขเวลาเข้า-ออกงานของพนักงานคนนี้ได้ — เลือกได้หลายคน <b>คนใดคนหนึ่งอนุมัติก็จบ</b>
                  · admin/hr ดำเนินการแทนได้เสมอ
                </p>
                <ApproverMultiSelect
                  value={timeEditApproverIds}
                  onChange={setTimeEditApproverIds}
                  excludeEmployeeId={employee?.id}
                  disabled={timeEditLoading}
                />
              </div>
            </>
          )}

          {/* ข้อมูลครอบครัว */}
          <SectionLabel>ข้อมูลครอบครัว</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SelectField label="สถานภาพสมรส" value={form.maritalStatus} onChange={set("maritalStatus")} options={fieldOptions.maritalStatuses} />
            <InputField label="ชื่อคู่สมรส" value={form.spouseName} onChange={set("spouseName")} />
            <InputField label="เบอร์โทรคู่สมรส" value={form.spousePhone} onChange={set("spousePhone")} type="tel" />
            <div />
            <InputField label="ชื่อบิดา" value={form.fatherName} onChange={set("fatherName")} />
            <InputField label="เบอร์โทรบิดา" value={form.fatherPhone} onChange={set("fatherPhone")} type="tel" />
            <InputField label="ชื่อมารดา" value={form.motherName} onChange={set("motherName")} />
            <InputField label="เบอร์โทรมารดา" value={form.motherPhone} onChange={set("motherPhone")} type="tel" />
            <InputField label="จำนวนบุตรชาย" value={String(form.sons ?? 0)} onChange={setNumber("sons")} type="number" />
            <InputField label="จำนวนบุตรสาว" value={String(form.daughters ?? 0)} onChange={setNumber("daughters")} type="number" />
          </div>

          {/* ผู้ติดต่อฉุกเฉิน */}
          <SectionLabel>ผู้ติดต่อฉุกเฉิน</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputField label="ชื่อผู้ติดต่อฉุกเฉิน" value={form.emergencyName} onChange={set("emergencyName")} />
            <InputField label="ความสัมพันธ์" value={form.emergencyRelation} onChange={set("emergencyRelation")} />
            <InputField label="เบอร์โทรฉุกเฉิน" value={form.emergencyPhone} onChange={set("emergencyPhone")} type="tel" />
          </div>
        </DialogBody>

        <DialogFooter className="px-6 pb-6 pt-4 border-t border-border flex-nowrap">
          {/* มือถือ: ยกเลิก/บันทึกอยู่แถวเดียวกัน แบ่งความกว้างเท่ากัน มีช่องไฟ (gap-2 จาก DialogFooter) */}
          <button onClick={() => onOpenChange(false)}
            className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
            <X className="w-4 h-4" /> ยกเลิก
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-primary-foreground transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "กำลังบันทึก..." : isEdit ? "บันทึก" : "เพิ่มพนักงาน"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeFormDialog;
