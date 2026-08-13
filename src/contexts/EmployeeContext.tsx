import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { TaxDeduction, DEFAULT_TAX_DEDUCTION } from "@/utils/taxCalculation";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/* ───────────────────── Types ───────────────────── */
export interface EducationRecord {
  id: number;
  level: string;
  institution: string;
  major: string;
  year: string;
}

export interface WorkHistoryRecord {
  id: number;
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface CustomPayrollItem {
  id: string;
  name: string;
  type: "income" | "deduction";
  amount: number;
  enabled: boolean;
}

export interface Employee {
  id: string;
  avatar: string;
  avatarColor: string;
  avatarTextColor: string;
  photoUrl?: string;
  prefix: string;
  firstName: string;
  lastName: string;
  nickname: string;
  birthDate: string;
  gender: string;
  nationalId: string;
  nationality: string;
  religion: string;
  bloodGroup: string;
  idIssueDate: string;
  idExpireDate: string;
  phone: string;
  email: string;
  address: string;
  dept: string;
  position: string;
  employeeType: string;
  startDate: string;
  trialEndDate: string;
  contractEndDate: string;
  shift: string;
  faceScanId: string;
  salary: string;
  bankAccount: string;
  driverLicense: string;
  isProtected?: boolean;
  positionId?: string;
  status: "active" | "leave" | "inactive";
  homeAddress: string;
  maritalStatus: string;
  spouseName: string;
  spousePhone: string;
  fatherName: string;
  fatherPhone: string;
  motherName: string;
  motherPhone: string;
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;
  education: EducationRecord[];
  workHistory: WorkHistoryRecord[];
  username: string;
  role: string;
  initialPassword?: string;
  taxDeductions?: TaxDeduction;
  children?: number;
  childrenAfter2018?: number;
  sons?: number;
  daughters?: number;
  pvdRate?: number;
  customPayrollItems?: CustomPayrollItem[];
}

/* ───────────────── DB → App mapping helpers ───────────────── */
function dbToEmployee(row: any, education: any[], workHistory: any[], payrollItems: any[]): Employee {
  return {
    id: row.id,
    avatar: row.avatar || '',
    avatarColor: row.avatar_color || 'hsl(200 70% 90%)',
    avatarTextColor: row.avatar_text_color || 'hsl(200 70% 35%)',
    photoUrl: row.photo_url || undefined,
    prefix: row.prefix || '',
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    nickname: row.nickname || '',
    birthDate: row.birth_date || '',
    gender: row.gender || '',
    nationalId: row.national_id || '',
    nationality: row.nationality || 'ไทย',
    religion: row.religion || '',
    bloodGroup: row.blood_group || '',
    idIssueDate: row.id_issue_date || '',
    idExpireDate: row.id_expire_date || '',
    phone: row.phone || '',
    email: row.email || '',
    address: row.address || '',
    dept: row.dept || '',
    position: row.position || '',
    employeeType: row.employee_type || '',
    startDate: row.start_date || '',
    trialEndDate: row.trial_end_date || '',
    contractEndDate: row.contract_end_date || '',
    shift: row.shift || '',
    faceScanId: row.face_scan_id || '',
    salary: row.salary || '0',
    bankAccount: row.bank_account || '',
    driverLicense: row.driver_license || '',
    isProtected: row.is_protected === true,
    positionId: row.position_id || undefined,
    status: (row.status as "active" | "leave" | "inactive") || 'active',
    homeAddress: row.home_address || '',
    maritalStatus: row.marital_status || '',
    spouseName: row.spouse_name || '',
    spousePhone: row.spouse_phone || '',
    fatherName: row.father_name || '',
    fatherPhone: row.father_phone || '',
    motherName: row.mother_name || '',
    motherPhone: row.mother_phone || '',
    emergencyName: row.emergency_name || '',
    emergencyRelation: row.emergency_relation || '',
    emergencyPhone: row.emergency_phone || '',
    username: row.username || '',
    role: row.role || 'Employee',
    initialPassword: row.initial_password || '',
    children: row.children || 0,
    childrenAfter2018: row.children_after_2018 || 0,
    sons: row.sons || 0,
    daughters: row.daughters || 0,
    pvdRate: row.pvd_rate ? Number(row.pvd_rate) : 0,
    taxDeductions: row.tax_deductions && Object.keys(row.tax_deductions).length > 0
      ? { ...DEFAULT_TAX_DEDUCTION, ...row.tax_deductions }
      : undefined,
    education: education
      .filter((e: any) => e.employee_id === row.id)
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((e: any, i: number) => ({
        id: i + 1,
        level: e.level,
        institution: e.institution,
        major: e.major,
        year: e.year,
      })),
    workHistory: workHistory
      .filter((w: any) => w.employee_id === row.id)
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((w: any, i: number) => ({
        id: i + 1,
        company: w.company,
        position: w.position,
        startDate: w.start_date,
        endDate: w.end_date,
        reason: w.reason,
      })),
    customPayrollItems: payrollItems
      .filter((p: any) => p.employee_id === row.id)
      .map((p: any) => ({
        id: p.id,
        name: p.name,
        type: p.type as "income" | "deduction",
        amount: Number(p.amount),
        enabled: p.enabled,
      })),
  };
}

function employeeToDb(emp: Partial<Employee>) {
  const mapped: any = {};
  if (emp.avatar !== undefined) mapped.avatar = emp.avatar;
  if (emp.avatarColor !== undefined) mapped.avatar_color = emp.avatarColor;
  if (emp.avatarTextColor !== undefined) mapped.avatar_text_color = emp.avatarTextColor;
  if (emp.photoUrl !== undefined) mapped.photo_url = emp.photoUrl;
  if (emp.prefix !== undefined) mapped.prefix = emp.prefix;
  if (emp.firstName !== undefined) mapped.first_name = emp.firstName;
  if (emp.lastName !== undefined) mapped.last_name = emp.lastName;
  if (emp.nickname !== undefined) mapped.nickname = emp.nickname;
  if (emp.birthDate !== undefined) mapped.birth_date = emp.birthDate;
  if (emp.gender !== undefined) mapped.gender = emp.gender;
  if (emp.nationalId !== undefined) mapped.national_id = emp.nationalId;
  if (emp.nationality !== undefined) mapped.nationality = emp.nationality;
  if (emp.religion !== undefined) mapped.religion = emp.religion;
  if (emp.bloodGroup !== undefined) mapped.blood_group = emp.bloodGroup;
  if (emp.idIssueDate !== undefined) mapped.id_issue_date = emp.idIssueDate;
  if (emp.idExpireDate !== undefined) mapped.id_expire_date = emp.idExpireDate;
  if (emp.phone !== undefined) mapped.phone = emp.phone;
  if (emp.email !== undefined) mapped.email = emp.email;
  if (emp.address !== undefined) mapped.address = emp.address;
  if (emp.dept !== undefined) mapped.dept = emp.dept;
  if (emp.position !== undefined) mapped.position = emp.position;
  if (emp.employeeType !== undefined) mapped.employee_type = emp.employeeType;
  if (emp.startDate !== undefined) mapped.start_date = emp.startDate;
  if (emp.trialEndDate !== undefined) mapped.trial_end_date = emp.trialEndDate;
  if (emp.contractEndDate !== undefined) mapped.contract_end_date = emp.contractEndDate;
  if (emp.shift !== undefined) mapped.shift = emp.shift;
  if (emp.faceScanId !== undefined) mapped.face_scan_id = emp.faceScanId;
  if (emp.salary !== undefined) mapped.salary = emp.salary;
  if (emp.bankAccount !== undefined) mapped.bank_account = emp.bankAccount;
  if (emp.driverLicense !== undefined) mapped.driver_license = emp.driverLicense;
  if (emp.positionId !== undefined) mapped.position_id = emp.positionId || null;
  if (emp.status !== undefined) mapped.status = emp.status;
  if (emp.homeAddress !== undefined) mapped.home_address = emp.homeAddress;
  if (emp.maritalStatus !== undefined) mapped.marital_status = emp.maritalStatus;
  if (emp.spouseName !== undefined) mapped.spouse_name = emp.spouseName;
  if (emp.spousePhone !== undefined) mapped.spouse_phone = emp.spousePhone;
  if (emp.fatherName !== undefined) mapped.father_name = emp.fatherName;
  if (emp.fatherPhone !== undefined) mapped.father_phone = emp.fatherPhone;
  if (emp.motherName !== undefined) mapped.mother_name = emp.motherName;
  if (emp.motherPhone !== undefined) mapped.mother_phone = emp.motherPhone;
  if (emp.emergencyName !== undefined) mapped.emergency_name = emp.emergencyName;
  if (emp.emergencyRelation !== undefined) mapped.emergency_relation = emp.emergencyRelation;
  if (emp.emergencyPhone !== undefined) mapped.emergency_phone = emp.emergencyPhone;
  if (emp.username !== undefined) mapped.username = emp.username;
  if (emp.role !== undefined) mapped.role = emp.role;
  if (emp.children !== undefined) mapped.children = emp.children;
  if (emp.childrenAfter2018 !== undefined) mapped.children_after_2018 = emp.childrenAfter2018;
  if (emp.sons !== undefined) mapped.sons = emp.sons;
  if (emp.daughters !== undefined) mapped.daughters = emp.daughters;
  if (emp.pvdRate !== undefined) mapped.pvd_rate = emp.pvdRate;
  if (emp.taxDeductions !== undefined) mapped.tax_deductions = emp.taxDeductions;
  if (emp.initialPassword !== undefined) mapped.initial_password = emp.initialPassword;
  mapped.updated_at = new Date().toISOString();
  return mapped;
}

/* ───────────────────── Context ───────────────────── */
interface EmployeeContextType {
  employees: Employee[];
  loading: boolean;
  addEmployee: (emp: Omit<Employee, "id">) => Promise<void>;
  updateEmployee: (id: string, data: Partial<Employee>) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  getEmployeeById: (id: string) => Employee | undefined;
  refetch: () => Promise<void>;
}

const EmployeeContext = createContext<EmployeeContextType | undefined>(undefined);

export const EmployeeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const { session } = useAuth();

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch employees first (essential), then related data in parallel
      // Select specific columns excluding photo_url (base64 data is huge and slows down loading)
      const empRes = await supabase.from("employees").select(
        "id,avatar,avatar_color,avatar_text_color,prefix,first_name,last_name,nickname,birth_date,gender,national_id,nationality,religion,blood_group,id_issue_date,id_expire_date,phone,email,address,dept,position,employee_type,start_date,trial_end_date,contract_end_date,shift,face_scan_id,salary,bank_account,driver_license,is_protected,position_id,status,home_address,marital_status,spouse_name,spouse_phone,father_name,father_phone,mother_name,mother_phone,emergency_name,emergency_relation,emergency_phone,username,role,initial_password,children,children_after_2018,sons,daughters,pvd_rate,tax_deductions,user_id,created_at,updated_at"
      ).order("created_at");
      if (empRes.error) throw empRes.error;

      // Quick initial render with basic employee data (no education/work/payroll)
      const quickMapped = (empRes.data || []).map((row: any) =>
        dbToEmployee(row, [], [], [])
      );
      setEmployees(quickMapped);
      setLoading(false);

      // Then fetch related data + photo_url in background
      const [eduRes, whRes, piRes, photoRes] = await Promise.all([
        supabase.from("employee_education").select("*"),
        supabase.from("employee_work_history").select("*"),
        supabase.from("employee_custom_payroll_items").select("*"),
        supabase.from("employees").select("id,photo_url"),
      ]);

      const eduData = eduRes.data || [];
      const whData = whRes.data || [];
      const piData = piRes.data || [];
      const photoMap = new Map<string, string | null>(
        (photoRes.data || []).map((r: any) => [r.id, r.photo_url])
      );

      const enrichedRows = (empRes.data || []).map((row: any) => ({
        ...row,
        photo_url: photoMap.get(row.id) ?? null,
      }));

      const fullMapped = enrichedRows.map((row: any) =>
        dbToEmployee(row, eduData, whData, piData)
      );
      setEmployees(fullMapped);
    } catch (err) {
      console.error("Failed to fetch employees:", err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) {
      // Defer initial fetch so it doesn't block the first render
      const timer = setTimeout(() => fetchEmployees(), 50);
      return () => clearTimeout(timer);
    }
  }, [session, fetchEmployees]);

  // Realtime: refetch when employees or related tables change (any device)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!session) return;
    const debounced = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchEmployees(), 250);
    };
    const channel = supabase
      .channel("employees-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "employees" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_education" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_work_history" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_custom_payroll_items" }, debounced)
      .subscribe();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [session, fetchEmployees]);

  const addEmployee = useCallback(async (emp: Omit<Employee, "id">) => {
    const dbData = employeeToDb(emp as Partial<Employee>);
    const { data, error } = await supabase.from("employees").insert(dbData).select().single();
    if (error) { console.error("Add employee error:", error); throw error; }
    
    const empId = data.id;
    // Insert education
    if (emp.education?.length) {
      await supabase.from("employee_education").insert(
        emp.education.map((e, i) => ({
          employee_id: empId, level: e.level, institution: e.institution,
          major: e.major, year: e.year, sort_order: i,
        }))
      );
    }
    // Insert work history
    if (emp.workHistory?.length) {
      await supabase.from("employee_work_history").insert(
        emp.workHistory.map((w, i) => ({
          employee_id: empId, company: w.company, position: w.position,
          start_date: w.startDate, end_date: w.endDate, reason: w.reason, sort_order: i,
        }))
      );
    }
    // Insert custom payroll items
    if (emp.customPayrollItems?.length) {
      await supabase.from("employee_custom_payroll_items").insert(
        emp.customPayrollItems.map((p) => ({
          employee_id: empId, name: p.name, type: p.type,
          amount: p.amount, enabled: p.enabled,
        }))
      );
    }

    // Create auth account for the new employee
    if (emp.email) {
      try {
        const defaultPassword = "Test1234!";
        const fullName = `${emp.firstName} ${emp.lastName}`.trim();
        const { data: fnData, error: fnError } = await supabase.functions.invoke("create-employee-auth", {
          body: {
            email: emp.email,
            password: defaultPassword,
            fullName,
            role: emp.role || "Employee",
            employeeId: empId,
          },
        });
        if (fnError) {
          console.warn("Auth account skipped:", fnError);
        } else if (fnData?.skipped) {
          console.warn("Auth account skipped (invalid email):", fnData.error);
        } else if (fnData?.error) {
          console.warn("Auth account error:", fnData.error);
        } else {
          console.log("Auth account created for", emp.email);
        }
      } catch (authErr) {
        console.warn("Auth account creation skipped:", authErr);
      }
    }

    await fetchEmployees();
  }, [fetchEmployees]);

  const updateEmployee = useCallback(async (id: string, data: Partial<Employee>) => {
    const dbData = employeeToDb(data);
    const { error } = await supabase.from("employees").update(dbData).eq("id", id);
    if (error) { console.error("Update employee error:", error); throw error; }

    // Sync role to user_roles if role changed
    if (data.role !== undefined) {
      try {
        const { data: syncData, error: syncError } = await supabase.functions.invoke("sync-employee-role", {
          body: { action: "sync_role", employeeId: id, newRole: data.role },
        });
        if (syncError || syncData?.error) {
          toast.warning("บันทึกข้อมูลแล้ว แต่ซิงก์สิทธิ์ไม่สำเร็จ: " + (syncData?.error || syncError?.message));
        } else if (syncData?.message === "No linked auth account") {
          toast.warning("บันทึกข้อมูลแล้ว แต่พนักงานยังไม่มีบัญชีเข้าใช้งาน สิทธิ์จะมีผลเมื่อสร้างบัญชีแล้ว");
        }
      } catch (syncErr: any) {
        console.error("Role sync failed:", syncErr);
        toast.warning("บันทึกข้อมูลแล้ว แต่ซิงก์สิทธิ์ไม่สำเร็จ");
      }
    }

    // Re-sync education if provided
    if (data.education !== undefined) {
      await supabase.from("employee_education").delete().eq("employee_id", id);
      if (data.education.length) {
        await supabase.from("employee_education").insert(
          data.education.map((e, i) => ({
            employee_id: id, level: e.level, institution: e.institution,
            major: e.major, year: e.year, sort_order: i,
          }))
        );
      }
    }
    // Re-sync work history if provided
    if (data.workHistory !== undefined) {
      await supabase.from("employee_work_history").delete().eq("employee_id", id);
      if (data.workHistory.length) {
        await supabase.from("employee_work_history").insert(
          data.workHistory.map((w, i) => ({
            employee_id: id, company: w.company, position: w.position,
            start_date: w.startDate, end_date: w.endDate, reason: w.reason, sort_order: i,
          }))
        );
      }
    }
    // Re-sync payroll items if provided
    if (data.customPayrollItems !== undefined) {
      await supabase.from("employee_custom_payroll_items").delete().eq("employee_id", id);
      if (data.customPayrollItems.length) {
        await supabase.from("employee_custom_payroll_items").insert(
          data.customPayrollItems.map((p) => ({
            employee_id: id, name: p.name, type: p.type,
            amount: p.amount, enabled: p.enabled,
          }))
        );
      }
    }
    await fetchEmployees();
  }, [fetchEmployees]);

  const deleteEmployee = useCallback(async (id: string) => {
    // Protect the primary admin account from deletion regardless of role
    const target = employees.find((e) => e.id === id);
    if (target?.isProtected) {
      throw new Error("ไม่สามารถลบบัญชีที่ถูกป้องกันไว้ได้");
    }

    // Cleanup auth account before deleting employee record
    try {
      await supabase.functions.invoke("sync-employee-role", {
        body: { action: "cleanup_employee", employeeId: id },
      });
    } catch (cleanupErr) {
      console.error("Auth cleanup failed:", cleanupErr);
    }

    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (error) { console.error("Delete employee error:", error); throw error; }
    await fetchEmployees();
  }, [fetchEmployees, employees]);

  const getEmployeeById = useCallback(
    (id: string) => employees.find((e) => e.id === id),
    [employees]
  );

  return (
    <EmployeeContext.Provider value={{ employees, loading, addEmployee, updateEmployee, deleteEmployee, getEmployeeById, refetch: fetchEmployees }}>
      {children}
    </EmployeeContext.Provider>
  );
};

export const useEmployees = () => {
  const ctx = useContext(EmployeeContext);
  if (!ctx) throw new Error("useEmployees must be used within EmployeeProvider");
  return ctx;
};
