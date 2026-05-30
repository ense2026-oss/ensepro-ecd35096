import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { useEmployees } from "@/contexts/EmployeeContext";
import { useOrg } from "@/contexts/OrgContext";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ImportEmployeesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedRow {
  prefix: string;
  firstName: string;
  lastName: string;
  nickname: string;
  phone: string;
  email: string;
  dept: string;
  position: string;
  employeeType: string;
  salary: string;
  startDate: string;
  status: string;
}

interface ValidationResult {
  row: number;
  data: ParsedRow;
  errors: string[];
  valid: boolean;
}

const TEMPLATE_COLUMNS = [
  "คำนำหน้า", "ชื่อ", "นามสกุล", "ชื่อเล่น",
  "เบอร์โทร", "อีเมล", "สังกัด", "ตำแหน่ง",
  "ประเภทพนักงาน", "เงินเดือน", "วันเริ่มงาน", "สถานะ",
];

const SAMPLE_DATA = [
  ["นาย", "สมชาย", "ใจดี", "ชาย", "0812345678", "somchai@email.com", "รถไฟฟ้าขสมช", "นายสถานี", "พนักงานประจำ", "25000", "2025-01-15", "active"],
  ["นางสาว", "สมหญิง", "รักงาน", "หญิง", "0898765432", "somying@email.com", "เตาเผาขยะสวนดอก", "ช่างเทคนิค", "พนักงานประจำ", "22000", "2025-02-01", "active"],
];

const ImportEmployeesDialog = ({ open, onOpenChange }: ImportEmployeesDialogProps) => {
  const { addEmployee, refetch } = useEmployees();
  const { affiliationNames } = useOrg();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [importResults, setImportResults] = useState<{ success: number; failed: number; failedNames: string[] }>({ success: 0, failed: 0, failedNames: [] });
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");

  const resetState = () => {
    setStep("upload");
    setValidationResults([]);
    setImportResults({ success: 0, failed: 0, failedNames: [] });
    setFileName("");
    setProgress(0);
    setProgressText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = (v: boolean) => {
    if (!v && step !== "importing") resetState();
    if (step === "importing") return; // prevent closing during import
    onOpenChange(v);
  };

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [TEMPLATE_COLUMNS, ...SAMPLE_DATA];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = TEMPLATE_COLUMNS.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, "พนักงาน");
    XLSX.writeFile(wb, "template_import_employees.xlsx");
    toast.success("ดาวน์โหลดไฟล์ตัวอย่างสำเร็จ");
  };

  const validateRow = (row: any[], rowIndex: number): ValidationResult => {
    const data: ParsedRow = {
      prefix: String(row[0] || "").trim(),
      firstName: String(row[1] || "").trim(),
      lastName: String(row[2] || "").trim(),
      nickname: String(row[3] || "").trim(),
      phone: String(row[4] || "").trim(),
      email: String(row[5] || "").replace(/\s+/g, "").trim(),
      dept: String(row[6] || "").trim(),
      position: String(row[7] || "").trim(),
      employeeType: String(row[8] || "พนักงานประจำ").trim(),
      salary: String(row[9] || "0").trim(),
      startDate: String(row[10] || "").trim(),
      status: String(row[11] || "active").trim(),
    };

    const errors: string[] = [];
    if (!data.firstName) errors.push("ไม่มีชื่อ");
    if (!data.lastName) errors.push("ไม่มีนามสกุล");
    if (!data.dept) errors.push("ไม่มีสังกัด");
    if (!data.position) errors.push("ไม่มีตำแหน่ง");
    if (data.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email) || data.email.includes("@.") || data.email.includes(".@")) {
        errors.push(`อีเมล "${data.email}" รูปแบบไม่ถูกต้อง`);
      }
    }
    if (!["นาย", "นาง", "นางสาว", "ดร.", "ผศ.ดร.", ""].includes(data.prefix)) {
      errors.push(`คำนำหน้า "${data.prefix}" ไม่ถูกต้อง`);
    }
    if (!["active", "leave", "inactive"].includes(data.status)) {
      errors.push(`สถานะ "${data.status}" ไม่ถูกต้อง`);
    }

    return { row: rowIndex + 1, data, errors, valid: errors.length === 0 };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        const dataRows = rows.slice(1).filter((r) => r.some((cell) => cell != null && String(cell).trim() !== ""));
        if (dataRows.length === 0) {
          toast.error("ไฟล์ไม่มีข้อมูลพนักงาน");
          return;
        }

        const results = dataRows.map((row, i) => validateRow(row, i));
        setValidationResults(results);
        setStep("preview");
      } catch {
        toast.error("ไม่สามารถอ่านไฟล์ได้ กรุณาใช้ไฟล์ .xlsx หรือ .xls");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    const validRows = validationResults.filter((r) => r.valid);
    if (validRows.length === 0) {
      toast.error("ไม่มีข้อมูลที่ถูกต้องสำหรับนำเข้า");
      return;
    }

    setStep("importing");
    setProgress(0);
    let success = 0;
    let failed = 0;
    const failedNames: string[] = [];
    const total = validRows.length;

    for (let i = 0; i < total; i++) {
      const result = validRows[i];
      const d = result.data;
      const displayName = `${d.prefix}${d.firstName} ${d.lastName}`;
      setProgressText(`กำลังนำเข้า ${displayName} (${i + 1}/${total})`);

      try {
        const hue = Math.floor(Math.random() * 360);
        await addEmployee({
          avatar: d.firstName.charAt(0) || "?",
          avatarColor: `hsl(${hue} 70% 90%)`,
          avatarTextColor: `hsl(${hue} 70% 35%)`,
          photoUrl: "",
          prefix: d.prefix || "นาย",
          firstName: d.firstName,
          lastName: d.lastName,
          nickname: d.nickname,
          birthDate: "",
          gender: "",
          nationalId: "",
          nationality: "ไทย",
          religion: "",
          bloodGroup: "",
          idIssueDate: "",
          idExpireDate: "",
          phone: d.phone,
          email: d.email,
          address: "",
          dept: d.dept,
          position: d.position,
          employeeType: d.employeeType,
          startDate: d.startDate,
          shift: "กะเช้า 08:00-17:00",
          faceScanId: "",
          salary: d.salary,
          status: d.status as "active" | "leave" | "inactive",
          homeAddress: "",
          maritalStatus: "โสด",
          spouseName: "",
          spousePhone: "",
          fatherName: "",
          fatherPhone: "",
          motherName: "",
          motherPhone: "",
          emergencyName: "",
          emergencyRelation: "",
          emergencyPhone: "",
          username: `${d.firstName.toLowerCase()}.${d.lastName.charAt(0).toLowerCase()}`,
          role: "Employee",
          education: [],
          workHistory: [],
        });
        success++;
      } catch {
        failed++;
        failedNames.push(displayName);
      }

      setProgress(Math.round(((i + 1) / total) * 100));
    }

    setImportResults({ success, failed, failedNames });
    setStep("done");
    if (success > 0) await refetch();
  };

  const validCount = validationResults.filter((r) => r.valid).length;
  const invalidCount = validationResults.filter((r) => !r.valid).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-lg font-bold flex items-center gap-2 pb-[10px]">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            นำเข้าข้อมูลพนักงาน
          </DialogTitle>
          <DialogDescription>นำเข้าพนักงานหลายรายการพร้อมกันผ่านไฟล์ Excel</DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6">
          {/* Step: Upload */}
          {step === "upload" && (
            <div className="space-y-5 mt-4">
              <div className="p-4 rounded-xl border border-border bg-muted/30">
                <p className="text-sm font-semibold mb-1">ขั้นตอนที่ 1: ดาวน์โหลดไฟล์ตัวอย่าง</p>
                <p className="text-xs text-muted-foreground mb-3">ดาวน์โหลดไฟล์ตัวอย่างแล้วกรอกข้อมูลพนักงานตามรูปแบบที่กำหนด</p>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-primary text-primary hover:bg-primary/5 transition-colors"
                >
                  <Download className="w-4 h-4" /> ดาวน์โหลดไฟล์ตัวอย่าง (.xlsx)
                </button>
              </div>

              <div className="p-4 rounded-xl border border-border bg-muted/30">
                <p className="text-sm font-semibold mb-1">ขั้นตอนที่ 2: อัพโหลดไฟล์</p>
                <p className="text-xs text-muted-foreground mb-3">เลือกไฟล์ Excel ที่กรอกข้อมูลเรียบร้อยแล้ว</p>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-primary-foreground transition-all"
                  style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}
                >
                  <Upload className="w-4 h-4" /> เลือกไฟล์
                </button>
              </div>

              <div className="p-3 rounded-xl bg-accent/30 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">คอลัมน์ที่รองรับ:</p>
                <p>{TEMPLATE_COLUMNS.join(", ")}</p>
                <p className="mt-1"><span className="text-destructive">*</span> คอลัมน์ที่จำเป็น: ชื่อ, นามสกุล, สังกัด, ตำแหน่ง</p>
              </div>
            </div>
          )}

          {/* Step: Preview */}
          {step === "preview" && (
            <div className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">ไฟล์: {fileName}</span>
                  <span className="text-xs px-2 py-1 rounded-lg bg-muted font-medium">{validationResults.length} รายการ</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {validCount > 0 && (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="w-3.5 h-3.5" /> ถูกต้อง {validCount}
                    </span>
                  )}
                  {invalidCount > 0 && (
                    <span className="flex items-center gap-1 text-destructive">
                      <XCircle className="w-3.5 h-3.5" /> ข้อผิดพลาด {invalidCount}
                    </span>
                  )}
                </div>
              </div>

              <ScrollArea className="max-h-[40vh]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-2 py-2 font-semibold text-muted-foreground">แถว</th>
                      <th className="text-left px-2 py-2 font-semibold text-muted-foreground">สถานะ</th>
                      <th className="text-left px-2 py-2 font-semibold text-muted-foreground">ชื่อ-นามสกุล</th>
                      <th className="text-left px-2 py-2 font-semibold text-muted-foreground">สังกัด</th>
                      <th className="text-left px-2 py-2 font-semibold text-muted-foreground">ตำแหน่ง</th>
                      <th className="text-left px-2 py-2 font-semibold text-muted-foreground">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationResults.map((r, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="px-2 py-2">{r.row}</td>
                        <td className="px-2 py-2">
                          {r.valid ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                          )}
                        </td>
                        <td className="px-2 py-2 font-medium">{r.data.prefix}{r.data.firstName} {r.data.lastName}</td>
                        <td className="px-2 py-2">{r.data.dept}</td>
                        <td className="px-2 py-2">{r.data.position}</td>
                        <td className="px-2 py-2 text-destructive">{r.errors.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={resetState}
                  className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
                >
                  เลือกไฟล์ใหม่
                </button>
                <button
                  onClick={handleImport}
                  disabled={validCount === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-primary-foreground transition-all disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}
                >
                  <Upload className="w-4 h-4" /> นำเข้า {validCount} รายการ
                </button>
              </div>
            </div>
          )}

          {/* Step: Importing with Progress Bar */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-12 gap-5">
              <FileSpreadsheet className="w-10 h-10 text-primary" />
              <div className="w-full max-w-md space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">กำลังนำเข้าข้อมูล...</span>
                  <span className="font-bold text-primary">{progress}%</span>
                </div>
                <Progress value={progress} className="h-3" />
                <p className="text-xs text-muted-foreground text-center">{progressText}</p>
              </div>
              <p className="text-xs text-muted-foreground">กรุณาอย่าปิดหน้าต่างนี้</p>
            </div>
          )}

          {/* Step: Done */}
          {step === "done" && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
              <p className="text-lg font-bold">นำเข้าข้อมูลเสร็จสิ้น</p>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="w-4 h-4" /> สำเร็จ {importResults.success} รายการ
                </span>
                {importResults.failed > 0 && (
                  <span className="flex items-center gap-1 text-destructive">
                    <XCircle className="w-4 h-4" /> ล้มเหลว {importResults.failed} รายการ
                  </span>
                )}
              </div>
              {importResults.failedNames.length > 0 && (
                <div className="w-full max-w-md p-3 rounded-xl bg-destructive/10 text-xs text-destructive space-y-1">
                  <p className="font-semibold">รายชื่อที่นำเข้าไม่สำเร็จ:</p>
                  {importResults.failedNames.map((name, i) => (
                    <p key={i}>• {name}</p>
                  ))}
                </div>
              )}
              <button
                onClick={() => handleClose(false)}
                className="mt-2 px-6 py-2 rounded-xl text-sm font-bold text-primary-foreground transition-all"
                style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}
              >
                ปิด
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportEmployeesDialog;
