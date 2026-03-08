import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Circle, Send, FileDown, Paperclip, X, Eye, Trash2, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useContracts, STATUS_LABELS } from "@/contexts/ContractContext";
import { useEmployees } from "@/contexts/EmployeeContext";
import ContractStatusBadge from "@/components/contracts/ContractStatusBadge";
import SignatureDialog from "@/components/contracts/SignatureDialog";
import { toast } from "sonner";

const ContractDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { contracts, getTimeline, getContractSignatures, getContractAttachments, advanceStatus, addSignature, sendToEmployee, addAttachment, removeAttachment } = useContracts();
  const { employees } = useEmployees();
  const [signOpen, setSignOpen] = useState(false);

  const contract = contracts.find((c) => c.id === id);
  if (!contract) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p>ไม่พบสัญญาจ้าง</p>
        <Button variant="link" onClick={() => navigate("/contracts")}>กลับไปหน้ารายการ</Button>
      </div>
    );
  }

  const timeline = getTimeline(contract);
  const sigs = getContractSignatures(contract.id);
  const atts = getContractAttachments(contract.id);

  const emp = (empId: string | null) => {
    if (!empId) return "—";
    const e = employees.find((x) => x.id === empId);
    return e ? `${e.firstName} ${e.lastName}` : empId;
  };

  const empInitials = (empId: string | null) => {
    if (!empId) return "?";
    const e = employees.find((x) => x.id === empId);
    return e ? `${e.firstName[0]}${e.lastName[0]}` : "?";
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

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      addAttachment({
        contractId: contract.id,
        fileName: file.name,
        fileUrl: ev.target?.result as string,
        fileType: file.type,
        uploadedBy: "h0k8i9j1-8901-2345-67h2-345678901234",
      });
      toast.success("แนบไฟล์เรียบร้อย");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const roleLabels: Record<string, string> = {
    employee: "ลายเซ็นพนักงาน",
    witness_1: "พยานคนที่ 1",
    witness_2: "พยานคนที่ 2",
    executive: "ผู้บริหาร",
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/contracts")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold font-display">สัญญาเลขที่ {contract.contractNumber}</h2>
              <ContractStatusBadge status={contract.status} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canSendToEmployee && (
            <Button onClick={() => { sendToEmployee(contract.id); toast.success("ส่งให้พนักงานเรียบร้อย"); }} className="gap-1.5" size="sm">
              <Send className="w-4 h-4" />ส่งให้พนักงานลงนาม
            </Button>
          )}
          {canSign && (
            <Button onClick={() => setSignOpen(true)} className="gap-1.5" size="sm">
              <FileDown className="w-4 h-4" />ลงนาม ({getSignerName()})
            </Button>
          )}
          {canAdvance && (
            <Button onClick={() => { advanceStatus(contract.id); toast.success("ส่งต่อเรียบร้อย"); }} className="gap-1.5" size="sm">
              <Send className="w-4 h-4" />ตรวจสอบเรียบร้อย ส่งต่อ
            </Button>
          )}
        </div>
      </div>

      {/* Main Layout - 2 columns on lg */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
        {/* Left Sidebar */}
        <div className="space-y-5">
          {/* Employee Card */}
          <div className="card-base p-5">
            <div className="flex flex-col items-center text-center">
              <Avatar className="w-20 h-20 mb-3">
                <AvatarFallback className="text-xl bg-primary/10 text-primary">
                  {empInitials(contract.employeeId)}
                </AvatarFallback>
              </Avatar>
              <p className="font-semibold">{emp(contract.employeeId)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">เลขที่สัญญา: {contract.contractNumber}</p>
            </div>
          </div>

          {/* Timeline */}
          <div className="card-base p-5">
            <h4 className="font-semibold mb-4 text-sm">ขั้นตอนการดำเนินการ</h4>
            <div className="relative space-y-0">
              {timeline.map((step, i) => (
                <div key={step.status} className="flex items-start gap-3 relative pb-4 last:pb-0">
                  {/* Vertical line */}
                  {i < timeline.length - 1 && (
                    <div className={`absolute left-[11px] top-6 w-0.5 h-[calc(100%-12px)] ${step.done ? "bg-green-400" : "bg-border"}`} />
                  )}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                    step.done ? "bg-green-500 text-white" : step.current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {step.done ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-3 h-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-tight ${step.current ? "font-semibold text-foreground" : step.done ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}>
                      {step.label}
                    </p>
                    {step.date && (
                      <p className="text-xs text-muted-foreground mt-0.5">{step.date}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Signatures */}
          <div className="card-base p-5">
            <h4 className="font-semibold mb-3 text-sm">ลายเซ็น</h4>
            {sigs.length > 0 ? (
              <div className="space-y-3">
                {sigs.map((s) => (
                  <div key={s.id}>
                    <p className="text-xs text-muted-foreground mb-1">{roleLabels[s.signerRole] || s.signerRole}</p>
                    <div className="border rounded-lg p-3 bg-muted/30">
                      {s.signatureData && (
                        <img src={s.signatureData} alt="signature" className="h-12 mx-auto bg-white rounded mb-2" />
                      )}
                      <p className="text-xs font-medium text-center">{emp(s.signerId)}</p>
                      <p className="text-xs text-muted-foreground text-center">
                        วันที่ลงนาม: {new Date(s.signedAt).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">ยังไม่มีลายเซ็น</p>
            )}
          </div>
        </div>

        {/* Right Content */}
        <div className="space-y-5">
          {/* Contract Info */}
          <div className="card-base p-5">
            <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              ข้อมูลสัญญา
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">เลขที่สัญญา</p>
                <p className="font-medium">{contract.contractNumber}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">วันที่ทำสัญญา</p>
                <p className="font-medium">{new Date(contract.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">ประเภทสัญญา</p>
                <p className="font-medium">{contract.contractType}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">วันที่เริ่มสัญญา</p>
                <p className="font-medium text-primary">{contract.startDate}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">วันที่สิ้นสุดสัญญา</p>
                <p className="font-medium text-primary">{contract.endDate}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">เงินเดือน</p>
                <p className="font-medium">{contract.salary.toLocaleString()} บาท</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">ผู้บริหาร</p>
                <p className="font-medium">{emp(contract.executiveId)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">พยานคนที่ 1</p>
                <p className="font-medium">{emp(contract.witness1Id)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">พยานคนที่ 2</p>
                <p className="font-medium">{emp(contract.witness2Id)}</p>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="text-xs text-muted-foreground">
              สร้างโดย: {emp(contract.createdBy)} • {new Date(contract.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>

          {/* Employee Info */}
          <div className="card-base p-5">
            <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
              👤 ข้อมูลพนักงาน
            </h3>
            {(() => {
              const e = employees.find((x) => x.id === contract.employeeId);
              if (!e) return <p className="text-sm text-muted-foreground">ไม่พบข้อมูลพนักงาน</p>;
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">ชื่อ-นามสกุล</p>
                    <p className="font-medium">{e.firstName} {e.lastName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">ตำแหน่ง</p>
                    <p className="font-medium">{e.position || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">แผนก</p>
                    <p className="font-medium">{e.department || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">อีเมล</p>
                    <p className="font-medium">{e.email || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">เบอร์โทรศัพท์</p>
                    <p className="font-medium">{e.phone || "—"}</p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Attachments */}
          <div className="card-base p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-primary" />
                เอกสารแนบ
              </h3>
              <label className="cursor-pointer">
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <span><Paperclip className="w-3.5 h-3.5" />แนบไฟล์</span>
                </Button>
                <input type="file" className="hidden" onChange={handleFileAttach} />
              </label>
            </div>
            {atts.length > 0 ? (
              <div className="space-y-2">
                {atts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between border rounded-lg px-4 py-2.5 bg-muted/20">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm truncate">{a.fileName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeAttachment(a.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">ยังไม่มีเอกสารแนบ</p>
              </div>
            )}
          </div>

          {/* Contract Details / Additional Info */}
          {Object.keys(contract.details).length > 0 && (
            <div className="card-base p-5">
              <h3 className="font-semibold text-base mb-4">รายละเอียดเพิ่มเติม</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
                {Object.entries(contract.details).map(([key, value]) => (
                  <div key={key}>
                    <p className="text-muted-foreground text-xs mb-0.5">{key}</p>
                    <p className="font-medium">{String(value)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <SignatureDialog
        open={signOpen}
        onOpenChange={setSignOpen}
        onSign={handleSign}
        signerName={getSignerName()}
      />
    </div>
  );
};

export default ContractDetail;
