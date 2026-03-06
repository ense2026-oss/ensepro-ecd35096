import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

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
  signatureData: string; // base64 or URL
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

/* ───────────────────── Context ───────────────────── */
interface ContractContextType {
  contracts: Contract[];
  signatures: ContractSignature[];
  attachments: ContractAttachment[];
  notifications: ContractNotification[];
  settings: ContractSettings;
  addContract: (contract: Omit<Contract, "id" | "createdAt" | "updatedAt">) => Contract;
  updateContract: (id: string, updates: Partial<Contract>) => void;
  deleteContract: (id: string) => void;
  sendToEmployee: (contractId: string) => void;
  advanceStatus: (contractId: string) => void;
  addSignature: (sig: Omit<ContractSignature, "id" | "signedAt">) => void;
  addAttachment: (att: Omit<ContractAttachment, "id" | "uploadedAt">) => void;
  removeAttachment: (id: string) => void;
  addNotification: (notif: Omit<ContractNotification, "id" | "createdAt" | "isRead">) => void;
  markNotificationRead: (id: string) => void;
  updateSettings: (s: Partial<ContractSettings>) => void;
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

/* ───────────────────── Mock Data ───────────────────── */
const now = new Date().toISOString();

const INITIAL_CONTRACTS: Contract[] = [
  {
    id: "ct-001",
    contractNumber: "CT-2026-001",
    employeeId: "c5f3d4e6-3456-7890-12cd-ef0123456789",
    title: "สัญญาจ้างงาน - มานะ ขยัน",
    contractType: "จ้างงาน",
    startDate: "2026-01-01",
    endDate: "2027-12-31",
    salary: 55000,
    details: { probation: "120 วัน", benefits: "ประกันสังคม, ประกันกลุ่ม" },
    status: "pending_employee",
    witness1Id: "b4e2c3d5-2345-6789-01bc-def012345678",
    witness2Id: null,
    executiveId: "i1l9j0k2-9012-3456-78i3-456789012345",
    createdBy: "h0k8i9j1-8901-2345-67h2-345678901234",
    createdAt: "2026-02-15T09:00:00Z",
    updatedAt: "2026-02-15T09:00:00Z",
  },
  {
    id: "ct-002",
    contractNumber: "CT-2026-002",
    employeeId: "f8i6g7h9-6789-0123-45f0-123456789012",
    title: "สัญญาทดลองงาน - นิดา สุขใจ",
    contractType: "ทดลองงาน",
    startDate: "2026-03-01",
    endDate: "2026-08-31",
    salary: 38000,
    details: { probation: "120 วัน" },
    status: "completed",
    witness1Id: "b4e2c3d5-2345-6789-01bc-def012345678",
    witness2Id: null,
    executiveId: "i1l9j0k2-9012-3456-78i3-456789012345",
    createdBy: "h0k8i9j1-8901-2345-67h2-345678901234",
    createdAt: "2026-01-10T09:00:00Z",
    updatedAt: "2026-02-28T14:00:00Z",
  },
  {
    id: "ct-003",
    contractNumber: "CT-2026-003",
    employeeId: "e7h5f6g8-5678-9012-34ef-012345678901",
    title: "สัญญาต่อสัญญา - วิชัย เก่งมาก",
    contractType: "ต่อสัญญา",
    startDate: "2026-04-01",
    endDate: "2027-03-31",
    salary: 48000,
    details: {},
    status: "draft",
    witness1Id: null,
    witness2Id: null,
    executiveId: "i1l9j0k2-9012-3456-78i3-456789012345",
    createdBy: "h0k8i9j1-8901-2345-67h2-345678901234",
    createdAt: now,
    updatedAt: now,
  },
];

const INITIAL_SIGNATURES: ContractSignature[] = [
  {
    id: "sig-001",
    contractId: "ct-002",
    signerId: "f8i6g7h9-6789-0123-45f0-123456789012",
    signerRole: "employee",
    signatureType: "draw",
    signatureData: "",
    signedAt: "2026-01-15T10:00:00Z",
  },
  {
    id: "sig-002",
    contractId: "ct-002",
    signerId: "b4e2c3d5-2345-6789-01bc-def012345678",
    signerRole: "witness_1",
    signatureType: "draw",
    signatureData: "",
    signedAt: "2026-01-20T10:00:00Z",
  },
  {
    id: "sig-003",
    contractId: "ct-002",
    signerId: "i1l9j0k2-9012-3456-78i3-456789012345",
    signerRole: "executive",
    signatureType: "upload",
    signatureData: "",
    signedAt: "2026-02-01T10:00:00Z",
  },
];

/* ───────────────────── Provider ───────────────────── */
export const ContractProvider = ({ children }: { children: ReactNode }) => {
  const [contracts, setContracts] = useState<Contract[]>(INITIAL_CONTRACTS);
  const [signatures, setSignatures] = useState<ContractSignature[]>(INITIAL_SIGNATURES);
  const [attachments, setAttachments] = useState<ContractAttachment[]>([]);
  const [notifications, setNotifications] = useState<ContractNotification[]>([]);
  const [settings, setSettings] = useState<ContractSettings>({
    witnessCount: 1,
    defaultExecutiveId: "i1l9j0k2-9012-3456-78i3-456789012345",
  });

  const uid = () => crypto.randomUUID();

  const addContract = useCallback((data: Omit<Contract, "id" | "createdAt" | "updatedAt">) => {
    const newContract: Contract = { ...data, id: uid(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setContracts((prev) => [...prev, newContract]);
    return newContract;
  }, []);

  const updateContract = useCallback((id: string, updates: Partial<Contract>) => {
    setContracts((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c)));
  }, []);

  const deleteContract = useCallback((id: string) => {
    setContracts((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const addNotification = useCallback((notif: Omit<ContractNotification, "id" | "createdAt" | "isRead">) => {
    setNotifications((prev) => [...prev, { ...notif, id: uid(), isRead: false, createdAt: new Date().toISOString() }]);
  }, []);

  const sendToEmployee = useCallback((contractId: string) => {
    const contract = contracts.find((c) => c.id === contractId);
    if (!contract) return;
    updateContract(contractId, { status: "pending_employee" });
    addNotification({ contractId, recipientId: contract.employeeId, message: `คุณมีสัญญาจ้าง "${contract.title}" รอลงนาม` });
  }, [contracts, updateContract, addNotification]);

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

  const advanceStatus = useCallback((contractId: string) => {
    const contract = contracts.find((c) => c.id === contractId);
    if (!contract) return;
    const next = getNextStatus(contract.status, settings.witnessCount);
    updateContract(contractId, { status: next });

    // Send notification to next person
    let recipientId = "";
    let message = "";
    switch (next) {
      case "pending_employee":
        recipientId = contract.employeeId;
        message = `สัญญาจ้าง "${contract.title}" รอคุณลงนาม`;
        break;
      case "pending_hr_review":
      case "pending_final_review":
        recipientId = contract.createdBy;
        message = `สัญญาจ้าง "${contract.title}" รอคุณตรวจสอบ`;
        break;
      case "pending_witness_1":
        recipientId = contract.witness1Id || "";
        message = `สัญญาจ้าง "${contract.title}" รอคุณลงนามเป็นพยาน`;
        break;
      case "pending_witness_2":
        recipientId = contract.witness2Id || "";
        message = `สัญญาจ้าง "${contract.title}" รอคุณลงนามเป็นพยาน`;
        break;
      case "pending_executive":
        recipientId = contract.executiveId;
        message = `สัญญาจ้าง "${contract.title}" รอผู้บริหารลงนาม`;
        break;
      case "completed":
        recipientId = contract.employeeId;
        message = `สัญญาจ้าง "${contract.title}" ดำเนินการเสร็จสิ้น`;
        break;
    }
    if (recipientId) {
      addNotification({ contractId, recipientId, message });
    }
  }, [contracts, settings.witnessCount, updateContract, addNotification]);

  const addSignature = useCallback((sig: Omit<ContractSignature, "id" | "signedAt">) => {
    setSignatures((prev) => [...prev, { ...sig, id: uid(), signedAt: new Date().toISOString() }]);
  }, []);

  const addAttachment = useCallback((att: Omit<ContractAttachment, "id" | "uploadedAt">) => {
    setAttachments((prev) => [...prev, { ...att, id: uid(), uploadedAt: new Date().toISOString() }]);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  }, []);

  const updateSettings = useCallback((s: Partial<ContractSettings>) => {
    setSettings((prev) => ({ ...prev, ...s }));
  }, []);

  const getContractSignatures = useCallback((contractId: string) => signatures.filter((s) => s.contractId === contractId), [signatures]);
  const getContractAttachments = useCallback((contractId: string) => attachments.filter((a) => a.contractId === contractId), [attachments]);

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
        contracts, signatures, attachments, notifications, settings,
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
