import React, { createContext, useContext, useState, useCallback } from "react";
import { TaxDeduction, DEFAULT_TAX_DEDUCTION } from "@/utils/taxCalculation";

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

  // Personal
  prefix: string;
  firstName: string;
  lastName: string;
  nickname: string;
  birthDate: string;
  nationalId: string;
  nationality: string;
  religion: string;
  bloodGroup: string;
  idIssueDate: string;
  idExpireDate: string;
  phone: string;
  email: string;
  address: string;

  // Work
  dept: string;
  position: string;
  employeeType: string;
  startDate: string;
  shift: string;
  faceScanId: string;
  salary: string;
  status: "active" | "leave" | "inactive";

  // Family
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

  // Education & Work History
  education: EducationRecord[];
  workHistory: WorkHistoryRecord[];

  // Security
  username: string;
  role: string;

  // Tax
  taxDeductions?: TaxDeduction;
  children?: number;
  childrenAfter2018?: number;
  pvdRate?: number;

  // Custom payroll items
  customPayrollItems?: CustomPayrollItem[];
}

/* ───────────────────── Initial Mock Data ───────────────────── */
const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: "a3f1b2c4-1234-5678-90ab-cdef01234567",
    avatar: "ส", avatarColor: "hsl(30 70% 90%)", avatarTextColor: "hsl(30 70% 35%)",
    prefix: "นาย", firstName: "สมชาย", lastName: "ใจดี", nickname: "ชาย",
    birthDate: "1985-03-15", nationalId: "1234567890123", nationality: "ไทย", religion: "พุทธ", bloodGroup: "A",
    idIssueDate: "2010-01-01", idExpireDate: "2030-01-01",
    phone: "0812345678", email: "somchai@company.com",
    address: "123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110",
    dept: "ฝ่ายขาย", position: "ผู้จัดการฝ่ายขาย", employeeType: "พนักงานประจำ",
    startDate: "2020-03-01", shift: "กะเช้า 08:00-17:00", faceScanId: "FACE-10023", salary: "65000", status: "active",
    homeAddress: "456 ถนนพหลโยธิน แขวงลาดยาว เขตจตุจักร กรุงเทพฯ 10900",
    maritalStatus: "สมรส",
    spouseName: "สมศรี ใจดี", spousePhone: "0891234570",
    fatherName: "สมศักดิ์ ใจดี", fatherPhone: "0891234567",
    motherName: "สมใจ ใจดี", motherPhone: "0891234568",
    emergencyName: "สมหวัง ใจดี", emergencyRelation: "พี่ชาย", emergencyPhone: "0891234569",
    education: [
      { id: 1, level: "ปริญญาตรี", institution: "มหาวิทยาลัยเกษตรศาสตร์", major: "บริหารธุรกิจ", year: "2551" },
      { id: 2, level: "มัธยมศึกษาตอนปลาย", institution: "โรงเรียนสวนกุหลาบวิทยาลัย", major: "วิทย์-คณิต", year: "2547" },
    ],
    workHistory: [
      { id: 1, company: "บริษัท ABC จำกัด", position: "พนักงานขาย", startDate: "2551", endDate: "2555", reason: "ต้องการความก้าวหน้า" },
      { id: 2, company: "บริษัท XYZ จำกัด", position: "ผู้ช่วยผู้จัดการ", startDate: "2555", endDate: "2563", reason: "มีโอกาสใหม่" },
    ],
    username: "somchai.j", role: "Manager",
    children: 1, childrenAfter2018: 0, pvdRate: 5,
    taxDeductions: { ...DEFAULT_TAX_DEDUCTION, spouse: 60000, children: 30000, socialSecurity: 9000, lifeInsurance: 50000, pvd: 39000 },
    customPayrollItems: [
      { id: "ci-1", name: "ค่าตอบแทนวิชาชีพ", type: "income", amount: 1000, enabled: true },
      { id: "cd-1", name: "หักค่าประกันการทำงาน", type: "deduction", amount: 300, enabled: true },
    ],
  },
  {
    id: "b4e2c3d5-2345-6789-01bc-def012345678",
    avatar: "ห", avatarColor: "hsl(77 70% 90%)", avatarTextColor: "hsl(77 70% 35%)",
    prefix: "นางสาว", firstName: "สมหญิง", lastName: "รักงาน", nickname: "หญิง",
    birthDate: "1990-06-20", nationalId: "2345678901234", nationality: "ไทย", religion: "พุทธ", bloodGroup: "B",
    idIssueDate: "2015-05-01", idExpireDate: "2035-05-01",
    phone: "0823456789", email: "somying@company.com",
    address: "45 ถนนรัชดาภิเษก แขวงดินแดง เขตดินแดง กรุงเทพฯ 10400",
    dept: "ฝ่าย HR", position: "เจ้าหน้าที่ HR", employeeType: "พนักงานประจำ",
    startDate: "2021-06-15", shift: "กะเช้า 08:00-17:00", faceScanId: "FACE-10024", salary: "35000", status: "active",
    homeAddress: "45 ถนนรัชดาภิเษก แขวงดินแดง เขตดินแดง กรุงเทพฯ 10400",
    maritalStatus: "โสด",
    spouseName: "", spousePhone: "",
    fatherName: "สมบัติ รักงาน", fatherPhone: "0892345678",
    motherName: "สมพร รักงาน", motherPhone: "0892345679",
    emergencyName: "สมพร รักงาน", emergencyRelation: "มารดา", emergencyPhone: "0892345679",
    education: [{ id: 1, level: "ปริญญาตรี", institution: "มหาวิทยาลัยธรรมศาสตร์", major: "ทรัพยากรมนุษย์", year: "2556" }],
    workHistory: [{ id: 1, company: "บริษัท DEF จำกัด", position: "เจ้าหน้าที่ธุรการ", startDate: "2556", endDate: "2564", reason: "เปลี่ยนสายงาน" }],
    username: "somying.r", role: "HR",
    customPayrollItems: [
      { id: "cd-2", name: "หักเงิน กยศ.", type: "deduction", amount: 500, enabled: true },
      { id: "cd-3", name: "หักผ่อนชำระหนี้", type: "deduction", amount: 1200, enabled: true },
    ],
  },
  {
    id: "c5f3d4e6-3456-7890-12cd-ef0123456789",
    avatar: "น", avatarColor: "hsl(124 70% 90%)", avatarTextColor: "hsl(124 70% 35%)",
    prefix: "นาย", firstName: "มานะ", lastName: "ขยัน", nickname: "นะ",
    birthDate: "1992-01-10", nationalId: "3456789012345", nationality: "ไทย", religion: "พุทธ", bloodGroup: "O",
    idIssueDate: "2017-03-01", idExpireDate: "2037-03-01",
    phone: "0834567890", email: "mana@company.com",
    address: "78 ถนนลาดพร้าว แขวงจอมพล เขตจตุจักร กรุงเทพฯ 10900",
    dept: "ฝ่าย IT", position: "นักพัฒนาซอฟต์แวร์", employeeType: "พนักงานประจำ",
    startDate: "2022-01-10", shift: "กะเช้า 08:00-17:00", faceScanId: "FACE-10025", salary: "55000", status: "active",
    homeAddress: "78 ถนนลาดพร้าว แขวงจอมพล เขตจตุจักร กรุงเทพฯ 10900",
    maritalStatus: "โสด",
    spouseName: "", spousePhone: "",
    fatherName: "มานิตย์ ขยัน", fatherPhone: "0893456780",
    motherName: "มาลี ขยัน", motherPhone: "0893456781",
    emergencyName: "มาลี ขยัน", emergencyRelation: "มารดา", emergencyPhone: "0893456781",
    education: [{ id: 1, level: "ปริญญาตรี", institution: "มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี", major: "วิศวกรรมคอมพิวเตอร์", year: "2558" }],
    workHistory: [],
    username: "mana.k", role: "Employee",
  },
  {
    id: "d6g4e5f7-4567-8901-23de-f01234567890",
    avatar: "ด", avatarColor: "hsl(171 70% 90%)", avatarTextColor: "hsl(171 70% 35%)",
    prefix: "นางสาว", firstName: "สุดา", lastName: "ดีใจ", nickname: "ดา",
    birthDate: "1988-09-25", nationalId: "4567890123456", nationality: "ไทย", religion: "พุทธ", bloodGroup: "AB",
    idIssueDate: "2013-09-01", idExpireDate: "2033-09-01",
    phone: "0845678901", email: "suda@company.com",
    address: "99 ถนนสาทร แขวงทุ่งมหาเมฆ เขตสาทร กรุงเทพฯ 10120",
    dept: "ฝ่ายบัญชี", position: "นักบัญชี", employeeType: "พนักงานประจำ",
    startDate: "2019-09-20", shift: "กะเช้า 08:00-17:00", faceScanId: "FACE-10026", salary: "42000", status: "leave",
    homeAddress: "99 ถนนสาทร แขวงทุ่งมหาเมฆ เขตสาทร กรุงเทพฯ 10120",
    maritalStatus: "โสด",
    spouseName: "", spousePhone: "",
    fatherName: "สุชาติ ดีใจ", fatherPhone: "0894567890",
    motherName: "สุมาลี ดีใจ", motherPhone: "0894567891",
    emergencyName: "สุชาติ ดีใจ", emergencyRelation: "บิดา", emergencyPhone: "0894567890",
    education: [{ id: 1, level: "ปริญญาตรี", institution: "จุฬาลงกรณ์มหาวิทยาลัย", major: "บัญชี", year: "2554" }],
    workHistory: [{ id: 1, company: "บริษัท GHI จำกัด", position: "ผู้ช่วยนักบัญชี", startDate: "2554", endDate: "2562", reason: "ย้ายบริษัท" }],
    username: "suda.d", role: "Accountant",
  },
  {
    id: "e7h5f6g8-5678-9012-34ef-012345678901",
    avatar: "ว", avatarColor: "hsl(218 70% 90%)", avatarTextColor: "hsl(218 70% 35%)",
    prefix: "นาย", firstName: "วิชัย", lastName: "เก่งมาก", nickname: "ชัย",
    birthDate: "1983-02-05", nationalId: "5678901234567", nationality: "ไทย", religion: "พุทธ", bloodGroup: "B",
    idIssueDate: "2008-02-01", idExpireDate: "2028-02-01",
    phone: "0856789012", email: "wichai@company.com",
    address: "200 ถนนบางนา-ตราด แขวงบางนา เขตบางนา กรุงเทพฯ 10260",
    dept: "ฝ่ายผลิต", position: "หัวหน้าทีมผลิต", employeeType: "พนักงานชั่วคราว",
    startDate: "2018-02-05", shift: "กะเช้า 08:00-17:00", faceScanId: "FACE-10027", salary: "48000", status: "active",
    homeAddress: "200 ถนนบางนา-ตราด แขวงบางนา เขตบางนา กรุงเทพฯ 10260",
    maritalStatus: "สมรส",
    spouseName: "วิภา เก่งมาก", spousePhone: "0895678903",
    fatherName: "วิเชียร เก่งมาก", fatherPhone: "0895678901",
    motherName: "วิไล เก่งมาก", motherPhone: "0895678902",
    emergencyName: "วิไล เก่งมาก", emergencyRelation: "มารดา", emergencyPhone: "0895678902",
    education: [{ id: 1, level: "ปวส.", institution: "วิทยาลัยเทคนิคกรุงเทพ", major: "ช่างอุตสาหกรรม", year: "2545" }],
    workHistory: [],
    username: "wichai.k", role: "Employee",
    children: 2, childrenAfter2018: 1, pvdRate: 3,
    taxDeductions: { ...DEFAULT_TAX_DEDUCTION, spouse: 60000, children: 30000, childrenAfter2018: 60000, socialSecurity: 9000 },
    customPayrollItems: [
      { id: "ci-2", name: "ค่าตำแหน่ง", type: "income", amount: 2000, enabled: true },
      { id: "cd-4", name: "หักเงิน กยศ.", type: "deduction", amount: 800, enabled: true },
      { id: "cd-5", name: "หักค่าประกันการทำงาน", type: "deduction", amount: 300, enabled: false },
    ],
  },
  {
    id: "f8i6g7h9-6789-0123-45f0-123456789012",
    avatar: "น", avatarColor: "hsl(265 70% 90%)", avatarTextColor: "hsl(265 70% 35%)",
    prefix: "นางสาว", firstName: "นิดา", lastName: "สุขใจ", nickname: "นิด",
    birthDate: "1995-11-12", nationalId: "6789012345678", nationality: "ไทย", religion: "พุทธ", bloodGroup: "A",
    idIssueDate: "2020-11-01", idExpireDate: "2040-11-01",
    phone: "0867890123", email: "nida@company.com",
    address: "55 ถนนเพชรบุรีตัดใหม่ แขวงบางกะปิ เขตห้วยขวาง กรุงเทพฯ 10310",
    dept: "ฝ่ายการตลาด", position: "นักการตลาดดิจิทัล", employeeType: "พนักงานทดลองงาน",
    startDate: "2023-11-12", shift: "กะเช้า 08:00-17:00", faceScanId: "FACE-10028", salary: "38000", status: "active",
    homeAddress: "55 ถนนเพชรบุรีตัดใหม่ แขวงบางกะปิ เขตห้วยขวาง กรุงเทพฯ 10310",
    maritalStatus: "โสด",
    spouseName: "", spousePhone: "",
    fatherName: "นิพนธ์ สุขใจ", fatherPhone: "0896789012",
    motherName: "นิภา สุขใจ", motherPhone: "0896789013",
    emergencyName: "นิภา สุขใจ", emergencyRelation: "มารดา", emergencyPhone: "0896789013",
    education: [{ id: 1, level: "ปริญญาตรี", institution: "มหาวิทยาลัยศิลปากร", major: "นิเทศศาสตร์", year: "2561" }],
    workHistory: [],
    username: "nida.s", role: "Employee",
  },
  {
    id: "g9j7h8i0-7890-1234-56g1-234567890123",
    avatar: "ป", avatarColor: "hsl(312 70% 90%)", avatarTextColor: "hsl(312 70% 35%)",
    prefix: "นาย", firstName: "ประสิทธิ์", lastName: "ทำได้", nickname: "สิทธิ์",
    birthDate: "1980-07-08", nationalId: "7890123456789", nationality: "ไทย", religion: "พุทธ", bloodGroup: "O",
    idIssueDate: "2005-07-01", idExpireDate: "2025-07-01",
    phone: "0878901234", email: "prasit@company.com",
    address: "300 ถนนรามคำแหง แขวงหัวหมาก เขตบางกะปิ กรุงเทพฯ 10240",
    dept: "ฝ่ายขาย", position: "พนักงานขาย", employeeType: "พนักงานประจำ",
    startDate: "2017-07-08", shift: "กะเช้า 08:00-17:00", faceScanId: "FACE-10029", salary: "30000", status: "inactive",
    homeAddress: "300 ถนนรามคำแหง แขวงหัวหมาก เขตบางกะปิ กรุงเทพฯ 10240",
    maritalStatus: "หย่าร้าง",
    spouseName: "", spousePhone: "",
    fatherName: "ประเสริฐ ทำได้", fatherPhone: "0897890123",
    motherName: "ประภา ทำได้", motherPhone: "0897890124",
    emergencyName: "ประภา ทำได้", emergencyRelation: "มารดา", emergencyPhone: "0897890124",
    education: [{ id: 1, level: "ปริญญาตรี", institution: "มหาวิทยาลัยรามคำแหง", major: "บริหารธุรกิจ", year: "2546" }],
    workHistory: [],
    username: "prasit.t", role: "Employee",
  },
  {
    id: "h0k8i9j1-8901-2345-67h2-345678901234",
    avatar: "ก", avatarColor: "hsl(359 70% 90%)", avatarTextColor: "hsl(359 70% 35%)",
    prefix: "นางสาว", firstName: "กาญจนา", lastName: "ใสซื่อ", nickname: "น้อย",
    birthDate: "1998-04-25", nationalId: "8901234567890", nationality: "ไทย", religion: "พุทธ", bloodGroup: "A",
    idIssueDate: "2023-04-01", idExpireDate: "2043-04-01",
    phone: "0889012345", email: "kanchana@company.com",
    address: "12 ถนนวิภาวดีรังสิต แขวงจอมพล เขตจตุจักร กรุงเทพฯ 10900",
    dept: "ฝ่าย HR", position: "เจ้าหน้าที่ธุรการ", employeeType: "พนักงานทดลองงาน",
    startDate: "2024-04-25", shift: "กะเช้า 08:00-17:00", faceScanId: "FACE-10030", salary: "25000", status: "active",
    homeAddress: "12 ถนนวิภาวดีรังสิต แขวงจอมพล เขตจตุจักร กรุงเทพฯ 10900",
    maritalStatus: "โสด",
    spouseName: "", spousePhone: "",
    fatherName: "กำพล ใสซื่อ", fatherPhone: "0898901234",
    motherName: "กัญญา ใสซื่อ", motherPhone: "0898901235",
    emergencyName: "กัญญา ใสซื่อ", emergencyRelation: "มารดา", emergencyPhone: "0898901235",
    education: [{ id: 1, level: "ปริญญาตรี", institution: "มหาวิทยาลัยศรีนครินทรวิโรฒ", major: "การจัดการทั่วไป", year: "2564" }],
    workHistory: [],
    username: "kanchana.s", role: "Admin",
  },
  {
    id: "i1l9j0k2-9012-3456-78i3-456789012345",
    avatar: "ธ", avatarColor: "hsl(45 70% 90%)", avatarTextColor: "hsl(45 70% 35%)",
    prefix: "นาย", firstName: "ธนกร", lastName: "บริหาร", nickname: "กร",
    birthDate: "1975-05-18", nationalId: "9012345678901", nationality: "ไทย", religion: "พุทธ", bloodGroup: "A",
    idIssueDate: "2000-05-01", idExpireDate: "2020-05-01",
    phone: "0890123456", email: "thanakorn@company.com",
    address: "88 ถนนสีลม แขวงสุริยวงศ์ เขตบางรัก กรุงเทพฯ 10500",
    dept: "ผู้บริหาร", position: "ผู้อำนวยการ", employeeType: "พนักงานประจำ",
    startDate: "2015-01-01", shift: "กะเช้า 08:00-17:00", faceScanId: "FACE-10031", salary: "120000", status: "active",
    homeAddress: "88 ถนนสีลม แขวงสุริยวงศ์ เขตบางรัก กรุงเทพฯ 10500",
    maritalStatus: "สมรส",
    spouseName: "ธนิดา บริหาร", spousePhone: "0890123459",
    fatherName: "ธนวัฒน์ บริหาร", fatherPhone: "0890123457",
    motherName: "ธนภรณ์ บริหาร", motherPhone: "0890123458",
    emergencyName: "ธนภรณ์ บริหาร", emergencyRelation: "มารดา", emergencyPhone: "0890123458",
    education: [{ id: 1, level: "ปริญญาโท", institution: "จุฬาลงกรณ์มหาวิทยาลัย", major: "บริหารธุรกิจ (MBA)", year: "2543" }],
    workHistory: [{ id: 1, company: "บริษัท Global Corp จำกัด", position: "รองผู้อำนวยการ", startDate: "2543", endDate: "2558", reason: "ย้ายองค์กร" }],
    username: "thanakorn.b", role: "Executive",
    children: 2, childrenAfter2018: 0, pvdRate: 10,
    taxDeductions: { ...DEFAULT_TAX_DEDUCTION, spouse: 60000, children: 60000, socialSecurity: 9000, lifeInsurance: 100000, pvd: 144000, donation: 20000 },
  },
];

/* ───────────────────── Context ───────────────────── */
interface EmployeeContextType {
  employees: Employee[];
  addEmployee: (emp: Omit<Employee, "id">) => void;
  updateEmployee: (id: string, data: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  getEmployeeById: (id: string) => Employee | undefined;
}

const EmployeeContext = createContext<EmployeeContextType | undefined>(undefined);

export const EmployeeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);

  const addEmployee = useCallback((emp: Omit<Employee, "id">) => {
    const newEmp: Employee = { ...emp, id: crypto.randomUUID() } as Employee;
    setEmployees((prev) => [...prev, newEmp]);
  }, []);

  const updateEmployee = useCallback((id: string, data: Partial<Employee>) => {
    setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, ...data } : e)));
  }, []);

  const deleteEmployee = useCallback((id: string) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const getEmployeeById = useCallback(
    (id: string) => employees.find((e) => e.id === id),
    [employees]
  );

  return (
    <EmployeeContext.Provider value={{ employees, addEmployee, updateEmployee, deleteEmployee, getEmployeeById }}>
      {children}
    </EmployeeContext.Provider>
  );
};

export const useEmployees = () => {
  const ctx = useContext(EmployeeContext);
  if (!ctx) throw new Error("useEmployees must be used within EmployeeProvider");
  return ctx;
};
