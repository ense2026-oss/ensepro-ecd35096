import { useState, useEffect } from "react";
import { Upload, X, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ThaiDatePicker } from "@/components/ui/thai-date-picker";
import SearchableSelect from "@/components/ui/searchable-select";
import type { LeaveType } from "./LeaveQuotaCards";
import type { LeaveRecord } from "./LeaveTable";

interface LeaveRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaveTypes: LeaveType[];
  onSubmit: (record: Omit<LeaveRecord, "id">, file?: File, removeExistingFile?: boolean) => void;
  canSelectEmployee?: boolean;
  currentUserName?: string;
  employeeNames?: string[];
  allEmployeeNames?: string[];
  editingRecord?: LeaveRecord | null;
}

const LeaveRequestDialog = ({ open, onOpenChange, leaveTypes, onSubmit, canSelectEmployee, currentUserName, employeeNames = [], allEmployeeNames = [], editingRecord }: LeaveRequestDialogProps) => {
  const [leaveType, setLeaveType] = useState(leaveTypes[0]?.name || "");
  const [selectedEmployee, setSelectedEmployee] = useState(currentUserName || "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [substitute, setSubstitute] = useState("no_substitute");
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [existingFileUrl, setExistingFileUrl] = useState<string | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const selectedType = leaveTypes.find((lt) => lt.name === leaveType);
  const requireDoc = selectedType?.requireDoc ?? false;
  const substituteList = (allEmployeeNames.length > 0 ? allEmployeeNames : employeeNames).filter((n) => n !== (selectedEmployee || currentUserName));

  useEffect(() => {
    if (editingRecord && open) {
      setLeaveType(editingRecord.type);
      setSelectedEmployee(editingRecord.name);
      setReason(editingRecord.reason);
      setExistingFileUrl(editingRecord.fileUrl || null);
      setRemoveExisting(false);
      setFileName("");
      setFile(null);
      setStartDate(parseThaiDate(editingRecord.from));
      setEndDate(parseThaiDate(editingRecord.to));
    } else if (!editingRecord && open) {
      resetForm();
    }
  }, [editingRecord, open]);

  const parseThaiDate = (thaiDate: string): string => {
    if (!thaiDate) return "";
    const parts = thaiDate.split("/");
    if (parts.length !== 3) return "";
    const [day, month, yearBE] = parts;
    const yearCE = parseInt(yearBE) - 543;
    return `${yearCE}-${month}-${day}`;
  };

  const resetForm = () => {
    setLeaveType(leaveTypes[0]?.name || "");
    setSelectedEmployee(currentUserName || "");
    setStartDate("");
    setEndDate("");
    setReason("");
    setSubstitute("no_substitute");
    setFileName("");
    setFile(null);
    setExistingFileUrl(null);
    setRemoveExisting(false);
    setErrors({});
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setFileName(e.target.files[0].name);
      setRemoveExisting(true);
    }
  };

  const handleRemoveExistingFile = () => {
    setExistingFileUrl(null);
    setRemoveExisting(true);
  };

  const handleRemoveNewFile = () => {
    setFile(null);
    setFileName("");
  };

  const calculateDays = (from: string, to: string): number => {
    if (!from || !to) return 0;
    const f = new Date(from);
    const t = new Date(to);
    const diff = Math.ceil((t.getTime() - f.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 0;
  };

  const formatDateThai = (dateStr: string): string => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear() + 543;
    return `${day}/${month}/${year}`;
  };

  const hasFile = !!fileName || (!!existingFileUrl && !removeExisting);

  const handleSubmit = () => {
    const newErrors: Record<string, boolean> = {};
    if (!leaveType) newErrors.leaveType = true;
    if (!startDate) newErrors.startDate = true;
    if (!endDate) newErrors.endDate = true;
    if (!reason.trim()) newErrors.reason = true;
    if (requireDoc && !hasFile) newErrors.file = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const days = calculateDays(startDate, endDate);

    onSubmit({
      name: selectedEmployee || currentUserName || "คุณ (ตัวเอง)",
      type: leaveType,
      from: formatDateThai(startDate),
      to: formatDateThai(endDate),
      days,
      reason,
      status: "pending",
      file: hasFile,
    }, file || undefined, removeExisting);

    resetForm();
    onOpenChange(false);
  };

  const isEditing = !!editingRecord;
  const showExistingFile = isEditing && existingFileUrl && !removeExisting && !file;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground" style={{ background: "hsl(var(--primary))" }}>
              {isEditing ? "✎" : "+"}
            </span>
            {isEditing ? "แก้ไขคำขอลา" : "ยื่นคำขอลา"}
          </DialogTitle>
          <DialogDescription className="sr-only">กรอกข้อมูลคำขอลางาน</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          {canSelectEmployee && employeeNames.length > 0 && !isEditing && (
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold mb-1.5">พนักงาน <span className="text-destructive">*</span></label>
              <SearchableSelect
                value={selectedEmployee}
                onChange={setSelectedEmployee}
                options={employeeNames.map((name) => ({ value: name, label: name }))}
                placeholder="เลือกพนักงาน"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold mb-1.5">ประเภทการลา <span className="text-destructive">*</span></label>
            <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className={`w-full px-3 py-2.5 text-sm rounded-xl border outline-none bg-muted/30 cursor-pointer ${errors.leaveType ? "border-destructive" : ""}`}>
              {leaveTypes.map((lt) => <option key={lt.id}>{lt.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">ผู้ทดแทน</label>
            <SearchableSelect
              value={substitute}
              onChange={setSubstitute}
              options={[
                { value: "", label: "เลือกผู้ทดแทน" },
                ...substituteList.map((emp) => ({ value: emp, label: emp })),
                { value: "no_substitute", label: "ไม่มีผู้ทดแทน" },
              ]}
              placeholder="เลือกผู้ทดแทน"
              allowClear
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">วันที่เริ่มลา <span className="text-destructive">*</span></label>
            <ThaiDatePicker value={startDate} onChange={setStartDate} placeholder="เลือกวันที่เริ่มลา" className={errors.startDate ? "border-destructive" : ""} />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">วันที่สิ้นสุด <span className="text-destructive">*</span></label>
            <ThaiDatePicker value={endDate} onChange={setEndDate} placeholder="เลือกวันที่สิ้นสุด" className={errors.endDate ? "border-destructive" : ""} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold mb-1.5">เหตุผล <span className="text-destructive">*</span></label>
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={`w-full px-3 py-2.5 text-sm rounded-xl border outline-none bg-muted/30 resize-none ${errors.reason ? "border-destructive" : ""}`} placeholder="ระบุเหตุผลการลา..." />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold mb-1.5">
              เอกสารแนบ {requireDoc && <span className="text-destructive">* (บังคับสำหรับ{leaveType})</span>}
            </label>

            {showExistingFile && (
              <div className="flex items-center gap-3 p-3 rounded-xl border bg-muted/30 mb-3">
                <FileText className="w-5 h-5 text-primary shrink-0" />
                <span className="text-sm font-medium text-foreground flex-1 truncate">ไฟล์แนบเดิม</span>
                <button type="button" onClick={handleRemoveExistingFile} className="p-1 rounded-full hover:bg-destructive/10 text-destructive transition-colors" title="ลบไฟล์แนบ">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {file && fileName && (
              <div className="flex items-center gap-3 p-3 rounded-xl border bg-muted/30 mb-3">
                <FileText className="w-5 h-5 text-primary shrink-0" />
                <span className="text-sm font-medium text-primary flex-1 truncate">{fileName}</span>
                <button type="button" onClick={handleRemoveNewFile} className="p-1 rounded-full hover:bg-destructive/10 text-destructive transition-colors" title="ลบไฟล์">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {!showExistingFile && !file && (
              <label className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors block ${errors.file ? "border-destructive" : ""}`} style={{ borderColor: errors.file ? undefined : "hsl(var(--primary))" }}>
                <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf,.docx" onChange={handleFileChange} />
                <Upload className="w-8 h-8 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium">คลิกเพื่ออัปโหลดไฟล์</p>
                <p className="text-xs text-muted-foreground mt-1">รองรับ JPEG, JPG, PNG, PDF, DOCX (สูงสุด 10MB)</p>
              </label>
            )}
          </div>
        </div>

        {Object.keys(errors).length > 0 && (
          <p className="text-sm text-destructive font-medium">กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน</p>
        )}

        <DialogFooter className="mt-4">
          <button type="button" onClick={() => { resetForm(); onOpenChange(false); }} className="px-5 py-2.5 rounded-xl border text-sm font-semibold hover:bg-muted transition-colors">
            ยกเลิก
          </button>
          <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSubmit(); }} className="px-5 py-2.5 rounded-xl text-sm font-bold text-primary-foreground" style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}>
            {isEditing ? "บันทึกการแก้ไข" : "ส่งคำขอ"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LeaveRequestDialog;
