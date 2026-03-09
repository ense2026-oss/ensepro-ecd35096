import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useContracts, Contract, ContractStatus } from "@/contexts/ContractContext";
import { useEmployees } from "@/contexts/EmployeeContext";
import ContractStatusBadge from "./ContractStatusBadge";
import SignatureDialog from "./SignatureDialog";
import { Check, Circle, Send, FileDown, Paperclip, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { processFileUpload } from "@/utils/fileCompression";
import LazyImage from "@/components/ui/lazy-image";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: Contract;
}

const ContractDetailDialog = ({ open, onOpenChange, contract }: Props) => {
  const { getTimeline, getContractSignatures, getContractAttachments, advanceStatus, addSignature, sendToEmployee, addAttachment, removeAttachment } = useContracts();
  const { employees } = useEmployees();
  const [signOpen, setSignOpen] = useState(false);
  const [currentSignerRole, setCurrentSignerRole] = useState<"employee" | "witness_1" | "witness_2" | "executive">("employee");

  const timeline = getTimeline(contract);
  const sigs = getContractSignatures(contract.id);
  const atts = getContractAttachments(contract.id);

  const emp = (id: string | null) => {
    if (!id) return "—";
    const e = employees.find((x) => x.id === id);
    return e ? `${e.firstName} ${e.lastName}` : id;
  };

  const getSignerRole = (): "employee" | "witness_1" | "witness_2" | "executive" => {
    switch (contract.status) {
      case "pending_employee": return "employee";
      case "pending_witness_1": return "witness_1";
      case "pending_witness_2": return "witness_2";
      case "pending_executive": return "executive";
      default: return "employee";
    }
  };

  const getSignerName = () => {
    switch (contract.status) {
      case "pending_employee": return emp(contract.employeeId);
      case "pending_witness_1": return emp(contract.witness1Id);
      case "pending_witness_2": return emp(contract.witness2Id);
      case "pending_executive": return emp(contract.executiveId);
      default: return "";
    }
  };

  const canSign = ["pending_employee", "pending_witness_1", "pending_witness_2", "pending_executive"].includes(contract.status);
  const canSendToEmployee = contract.status === "draft";
  const canAdvance = ["pending_hr_review", "pending_final_review"].includes(contract.status);

  const handleSign = (type: "draw" | "upload", data: string) => {
    const role = getSignerRole();
    let signerId = "";
    switch (role) {
      case "employee": signerId = contract.employeeId; break;
      case "witness_1": signerId = contract.witness1Id || ""; break;
      case "witness_2": signerId = contract.witness2Id || ""; break;
      case "executive": signerId = contract.executiveId; break;
    }
    addSignature({ contractId: contract.id, signerId, signerRole: role, signatureType: type, signatureData: data });
    advanceStatus(contract.id);
    toast.success("ลงนามเรียบร้อยแล้ว");
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const imageOpts = file.type.startsWith("image/") ? { maxWidth: 1200, maxHeight: 1200, quality: 0.7 } : undefined;
    const result = await processFileUpload(file, imageOpts);
    if (!result) return;
    addAttachment({
      contractId: contract.id,
      fileName: file.name,
      fileUrl: result,
      fileType: file.type,
      uploadedBy: "h0k8i9j1-8901-2345-67h2-345678901234",
    });
    toast.success("แนบไฟล์เรียบร้อย");
    e.target.value = "";
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {contract.title}
              <ContractStatusBadge status={contract.status} />
            </DialogTitle>
          </DialogHeader>

          {/* Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">เลขที่:</span> {contract.contractNumber}</div>
            <div><span className="text-muted-foreground">ประเภท:</span> {contract.contractType}</div>
            <div><span className="text-muted-foreground">พนักงาน:</span> {emp(contract.employeeId)}</div>
            <div><span className="text-muted-foreground">เงินเดือน:</span> {contract.salary.toLocaleString()} ฿</div>
            <div><span className="text-muted-foreground">เริ่มต้น:</span> {contract.startDate}</div>
            <div><span className="text-muted-foreground">สิ้นสุด:</span> {contract.endDate}</div>
            <div><span className="text-muted-foreground">พยาน 1:</span> {emp(contract.witness1Id)}</div>
            <div><span className="text-muted-foreground">พยาน 2:</span> {emp(contract.witness2Id)}</div>
            <div><span className="text-muted-foreground">ผู้บริหาร:</span> {emp(contract.executiveId)}</div>
            <div><span className="text-muted-foreground">สร้างโดย:</span> {emp(contract.createdBy)}</div>
          </div>

          <Separator />

          {/* Timeline */}
          <div>
            <h4 className="font-semibold mb-3 text-sm">สถานะการดำเนินงาน</h4>
            <div className="space-y-2">
              {timeline.map((step, i) => (
                <div key={step.status} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    step.done ? "bg-green-500 text-white" : step.current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {step.done ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-3 h-3" />}
                  </div>
                  <span className={`text-sm ${step.current ? "font-semibold text-foreground" : step.done ? "text-muted-foreground line-through" : "text-muted-foreground"}`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Signatures */}
          {sigs.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2 text-sm">ลายเซ็นที่ลงนามแล้ว</h4>
              <div className="grid grid-cols-2 gap-2">
                {sigs.map((s) => (
                  <div key={s.id} className="border rounded-lg p-2 text-xs">
                    <p className="font-medium">{emp(s.signerId)} ({s.signerRole})</p>
                    <p className="text-muted-foreground">{new Date(s.signedAt).toLocaleDateString("th-TH")} • {s.signatureType === "draw" ? "วาดลายเซ็น" : "อัพโหลด"}</p>
                    {s.signatureData && <LazyImage src={s.signatureData} alt="sig" className="h-10 mt-1 bg-white rounded" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-sm">เอกสารแนบ</h4>
              <label className="cursor-pointer">
                <Button variant="ghost" size="sm" className="gap-1" asChild><span><Paperclip className="w-3.5 h-3.5" />แนบไฟล์</span></Button>
                <input type="file" className="hidden" onChange={handleFileAttach} />
              </label>
            </div>
            {atts.length > 0 ? (
              <div className="space-y-1">
                {atts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-sm border rounded px-3 py-1.5">
                    <span className="truncate">{a.fileName}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeAttachment(a.id)}><X className="w-3.5 h-3.5" /></Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">ยังไม่มีเอกสารแนบ</p>
            )}
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {canSendToEmployee && (
              <Button onClick={() => { sendToEmployee(contract.id); toast.success("ส่งให้พนักงานเรียบร้อย"); }} className="gap-1.5">
                <Send className="w-4 h-4" />ส่งให้พนักงานลงนาม
              </Button>
            )}
            {canSign && (
              <Button onClick={() => setSignOpen(true)} className="gap-1.5">
                <FileDown className="w-4 h-4" />ลงนาม ({getSignerName()})
              </Button>
            )}
            {canAdvance && (
              <Button onClick={() => { advanceStatus(contract.id); toast.success("ส่งต่อเรียบร้อย"); }} className="gap-1.5">
                <Send className="w-4 h-4" />ตรวจสอบเรียบร้อย ส่งต่อ
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <SignatureDialog
        open={signOpen}
        onOpenChange={setSignOpen}
        onSign={handleSign}
        signerName={getSignerName()}
      />
    </>
  );
};

export default ContractDetailDialog;
