import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

/* ───────────────────── Types ───────────────────── */
export type ContractStatus =
  | "draft"
  | "pending_employee"
  | "pending_hr_review"
  | "pending_witness_1"
  | "pending_witness_2"
  | "pending_executive"
  | "pending_final_review"
  | "completed";

export type ContractType = "จ้างงาน" | "ทดลองงาน" | "ต่อสัญญา";

export type SignerRole = "employee" | "witness_1" | "witness_2" | "executive";
export type SignatureType = "draw" | "upload";

export interface ContractSignature {
  id: string;
  contractId: string;
  signerId: string;
  signerRole: SignerRole;
  signatureType: SignatureType;
  signatureData: string;
  signedAt: string;
}

export interface ContractAttachment {
  id: string;
  contractId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface ContractNotification {
  id: string;
  contractId: string;
  recipientId: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface Contract {
  id: string;
  contractNumber: string;
  employeeId: string;
  title: string;
  contractType: ContractType;
  startDate: string;
  endDate: string;
  salary: number;
  details: Record<string, any>;
  status: ContractStatus;
  witness1Id: string | null;
  witness2Id: string | null;
  executiveId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContractSettings {
  witnessCount: 1 | 2;
  defaultExecutiveId: string;
}

export interface ContractTimelineEvent {
  status: ContractStatus;
  label: string;
  date?: string;
  done: boolean;
  current: boolean;
}

/* ───────────────────── Status helpers ───────────────────── */
export const STATUS_LABELS: Record<ContractStatus, string> = {
  draft: "แบบร่าง",
  pending_employee: "รอพนักงานลงนาม",
  pending_hr_review: "รอ HR ตรวจสอบ",
  pending_witness_1: "รอพยานคนที่ 1 ลงนาม",
  pending_witness_2: "รอพยานคนที่ 2 ลงนาม",
  pending_executive: "รอผู้บริหารลงนาม",
  pending_final_review: "รอ HR ตรวจสอบขั้นสุดท้าย",
  completed: "เสร็จสิ้น",
};

export const STATUS_COLORS: Record<ContractStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_employee: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  pending_hr_review: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  pending_witness_1: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  pending_witness_2: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  pending_executive: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  pending_final_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

/* ───────────────────── DB ↔ Frontend Mappers ───────────────────── */
const dbToContract = (r: any): Contract => ({
  id: r.id,
  contractNumber: r.contract_number,
  employeeId: r.employee_id,
  title: r.title,
  contractType: r.contract_type as ContractType,
  startDate: r.start_date,
  endDate: r.end_date,
  salary: Number(r.salary),
  details: r.details || {},
  status: r.status as ContractStatus,
  witness1Id: r.witness_1_id,
  witness2Id: r.witness_2_id,
  executiveId: r.executive_id,
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const dbToSignature = (r: any): ContractSignature => ({
  id: r.id,
  contractId: r.contract_id,
  signerId: r.signer_id,
  signerRole: r.signer_role as SignerRole,
  signatureType: r.signature_type as SignatureType,
  signatureData: r.signature_data,
  signedAt: r.signed_at,
});

const dbToAttachment = (r: any): ContractAttachment => ({
  id: r.id,
  contractId: r.contract_id,
  fileName: r.file_name,
  fileUrl: r.file_url,
  fileType: r.file_type,
  uploadedBy: r.uploaded_by,
  uploadedAt: r.uploaded_at,
});

const dbToNotification = (r: any): ContractNotification => ({
  id: r.id,
  contractId: r.contract_id,
  recipientId: r.recipient_id,
  message: r.message,
  isRead: r.is_read,
  createdAt: r.created_at,
});

/* ───────────────────── Context ───────────────────── */
interface ContractContextType {
  contracts: Contract[];
  signatures: ContractSignature[];
  attachments: ContractAttachment[];
  notifications: ContractNotification[];
  settings: ContractSettings;
  loading: boolean;
  addContract: (contract: Omit<Contract, "id" | "createdAt" | "updatedAt">) => Promise<Contract | null>;
  updateContract: (id: string, updates: Partial<Contract>) => Promise<void>;
  deleteContract: (id: string) => Promise<void>;
  sendToEmployee: (contractId: string) => Promise<void>;
  advanceStatus: (contractId: string) => Promise<void>;
  addSignature: (sig: Omit<ContractSignature, "id" | "signedAt">) => Promise<void>;
  addAttachment: (att: Omit<ContractAttachment, "id" | "uploadedAt">) => Promise<void>;
  removeAttachment: (id: string) => Promise<void>;
  addNotification: (notif: Omit<ContractNotification, "id" | "createdAt" | "isRead">) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  updateSettings: (s: Partial<ContractSettings>) => Promise<void>;
  getTimeline: (contract: Contract) => ContractTimelineEvent[];
  getContractSignatures: (contractId: string) => ContractSignature[];
  getContractAttachments: (contractId: string) => ContractAttachment[];
}

const ContractContext = createContext<ContractContextType | null>(null);

export const useContracts = () => {
  const ctx = useContext(ContractContext);
  if (!ctx) throw new Error("useContracts must be used within ContractProvider");
  return ctx;
};

/* ───────────────────── Provider ───────────────────── */
export const ContractProvider = ({ children }: { children: ReactNode }) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [signatures, setSignatures] = useState<ContractSignature[]>([]);
  const [attachments, setAttachments] = useState<ContractAttachment[]>([]);
  const [notifications, setNotifications] = useState<ContractNotification[]>([]);
  const [settings, setSettings] = useState<ContractSettings>({ witnessCount: 1, defaultExecutiveId: "" });
  const [loading, setLoading] = useState(true);

  /* ─── Fetch All ─── */
  const fetchAll = useCallback(async () => {
    const [cRes, sRes, aRes, nRes, stRes] = await Promise.all([
      supabase.from("contracts").select("*").order("created_at", { ascending: false }),
      supabase.from("contract_signatures").select("*"),
      supabase.from("contract_attachments").select("*"),
      supabase.from("contract_notifications").select("*").order("created_at", { ascending: false }),
      supabase.from("contract_settings").select("*").limit(1).single(),
    ]);

    setContracts((cRes.data || []).map(dbToContract));
    setSignatures((sRes.data || []).map(dbToSignature));
    setAttachments((aRes.data || []).map(dbToAttachment));
    setNotifications((nRes.data || []).map(dbToNotification));

    if (stRes.data) {
      setSettings({
        witnessCount: (stRes.data.witness_count === 2 ? 2 : 1) as 1 | 2,
        defaultExecutiveId: stRes.data.default_executive_id || "",
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ─── Contract CRUD ─── */
  const addContract = useCallback(async (data: Omit<Contract, "id" | "createdAt" | "updatedAt">): Promise<Contract | null> => {
    const { data: row, error } = await supabase.from("contracts").insert({
      contract_number: data.contractNumber,
      employee_id: data.employeeId,
      title: data.title,
      contract_type: data.contractType,
      start_date: data.startDate,
      end_date: data.endDate,
      salary: data.salary,
      details: data.details,
      status: data.status,
      witness_1_id: data.witness1Id || null,
      witness_2_id: data.witness2Id || null,
      executive_id: data.executiveId,
      created_by: data.createdBy,
    }).select().single();
    if (error || !row) { console.error("addContract error:", error); return null; }
    await fetchAll();
    return dbToContract(row);
  }, [fetchAll]);

  const updateContract = useCallback(async (id: string, updates: Partial<Contract>) => {
    const dbUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (updates.contractNumber !== undefined) dbUpdates.contract_number = updates.contractNumber;
    if (updates.employeeId !== undefined) dbUpdates.employee_id = updates.employeeId;
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.contractType !== undefined) dbUpdates.contract_type = updates.contractType;
    if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
    if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate;
    if (updates.salary !== undefined) dbUpdates.salary = updates.salary;
    if (updates.details !== undefined) dbUpdates.details = updates.details;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.witness1Id !== undefined) dbUpdates.witness_1_id = updates.witness1Id;
    if (updates.witness2Id !== undefined) dbUpdates.witness_2_id = updates.witness2Id;
    if (updates.executiveId !== undefined) dbUpdates.executive_id = updates.executiveId;

    await supabase.from("contracts").update(dbUpdates).eq("id", id);
    await fetchAll();
  }, [fetchAll]);

  const deleteContract = useCallback(async (id: string) => {
    await supabase.from("contracts").delete().eq("id", id);
    await fetchAll();
  }, [fetchAll]);

  /* ─── Notification ─── */
  const addNotification = useCallback(async (notif: Omit<ContractNotification, "id" | "createdAt" | "isRead">) => {
    await supabase.from("contract_notifications").insert({
      contract_id: notif.contractId,
      recipient_id: notif.recipientId,
      message: notif.message,
    });
    await fetchAll();
  }, [fetchAll]);

  const markNotificationRead = useCallback(async (id: string) => {
    await supabase.from("contract_notifications").update({ is_read: true }).eq("id", id);
    await fetchAll();
  }, [fetchAll]);

  /* ─── Status flow ─── */
  const getNextStatus = (current: ContractStatus, witnessCount: 1 | 2): ContractStatus => {
    const flow: ContractStatus[] = [
      "draft", "pending_employee", "pending_hr_review",
      "pending_witness_1",
      ...(witnessCount === 2 ? ["pending_witness_2" as ContractStatus] : []),
      "pending_executive", "pending_final_review", "completed",
    ];
    const idx = flow.indexOf(current);
    return idx < flow.length - 1 ? flow[idx + 1] : current;
  };

  const sendToEmployee = useCallback(async (contractId: string) => {
    const contract = contracts.find((c) => c.id === contractId);
    if (!contract) return;
    await updateContract(contractId, { status: "pending_employee" });
    await addNotification({ contractId, recipientId: contract.employeeId, message: `คุณมีสัญญาจ้าง "${contract.title}" รอลงนาม` });
  }, [contracts, updateContract, addNotification]);

  const advanceStatus = useCallback(async (contractId: string) => {
    const contract = contracts.find((c) => c.id === contractId);
    if (!contract) return;
    const next = getNextStatus(contract.status, settings.witnessCount);
    await updateContract(contractId, { status: next });

    let recipientId = "";
    let message = "";
    switch (next) {
      case "pending_employee":
        recipientId = contract.employeeId; message = `สัญญาจ้าง "${contract.title}" รอคุณลงนาม`; break;
      case "pending_hr_review":
      case "pending_final_review":
        recipientId = contract.createdBy; message = `สัญญาจ้าง "${contract.title}" รอคุณตรวจสอบ`; break;
      case "pending_witness_1":
        recipientId = contract.witness1Id || ""; message = `สัญญาจ้าง "${contract.title}" รอคุณลงนามเป็นพยาน`; break;
      case "pending_witness_2":
        recipientId = contract.witness2Id || ""; message = `สัญญาจ้าง "${contract.title}" รอคุณลงนามเป็นพยาน`; break;
      case "pending_executive":
        recipientId = contract.executiveId; message = `สัญญาจ้าง "${contract.title}" รอผู้บริหารลงนาม`; break;
      case "completed":
        recipientId = contract.employeeId; message = `สัญญาจ้าง "${contract.title}" ดำเนินการเสร็จสิ้น`; break;
    }
    if (recipientId) await addNotification({ contractId, recipientId, message });
  }, [contracts, settings.witnessCount, updateContract, addNotification]);

  /* ─── Signatures ─── */
  const addSignature = useCallback(async (sig: Omit<ContractSignature, "id" | "signedAt">) => {
    await supabase.from("contract_signatures").insert({
      contract_id: sig.contractId,
      signer_id: sig.signerId,
      signer_role: sig.signerRole,
      signature_type: sig.signatureType,
      signature_data: sig.signatureData,
    });
    await fetchAll();
  }, [fetchAll]);

  /* ─── Attachments ─── */
  const addAttachment = useCallback(async (att: Omit<ContractAttachment, "id" | "uploadedAt">) => {
    await supabase.from("contract_attachments").insert({
      contract_id: att.contractId,
      file_name: att.fileName,
      file_url: att.fileUrl,
      file_type: att.fileType,
      uploaded_by: att.uploadedBy,
    });
    await fetchAll();
  }, [fetchAll]);

  const removeAttachment = useCallback(async (id: string) => {
    await supabase.from("contract_attachments").delete().eq("id", id);
    await fetchAll();
  }, [fetchAll]);

  /* ─── Settings ─── */
  const updateSettings = useCallback(async (s: Partial<ContractSettings>) => {
    const dbUpdate: Record<string, any> = { updated_at: new Date().toISOString() };
    if (s.witnessCount !== undefined) dbUpdate.witness_count = s.witnessCount;
    if (s.defaultExecutiveId !== undefined) dbUpdate.default_executive_id = s.defaultExecutiveId || null;

    // Update the single settings row
    const { data: existing } = await supabase.from("contract_settings").select("id").limit(1).single();
    if (existing) {
      await supabase.from("contract_settings").update(dbUpdate).eq("id", existing.id);
    }
    await fetchAll();
  }, [fetchAll]);

  /* ─── Derived ─── */
  const getContractSignatures = useCallback((contractId: string) =>
    signatures.filter((s) => s.contractId === contractId), [signatures]);

  const getContractAttachments = useCallback((contractId: string) =>
    attachments.filter((a) => a.contractId === contractId), [attachments]);

  const getTimeline = useCallback((contract: Contract): ContractTimelineEvent[] => {
    const flow: ContractStatus[] = [
      "draft", "pending_employee", "pending_hr_review",
      "pending_witness_1",
      ...(settings.witnessCount === 2 ? ["pending_witness_2" as ContractStatus] : []),
      "pending_executive", "pending_final_review", "completed",
    ];
    const currentIdx = flow.indexOf(contract.status);
    return flow.map((status, i) => ({
      status,
      label: STATUS_LABELS[status],
      done: i < currentIdx || contract.status === "completed",
      current: i === currentIdx,
    }));
  }, [settings.witnessCount]);

  return (
    <ContractContext.Provider
      value={{
        contracts, signatures, attachments, notifications, settings, loading,
        addContract, updateContract, deleteContract,
        sendToEmployee, advanceStatus,
        addSignature, addAttachment, removeAttachment,
        addNotification, markNotificationRead,
        updateSettings, getTimeline,
        getContractSignatures, getContractAttachments,
      }}
    >
      {children}
    </ContractContext.Provider>
  );
};
