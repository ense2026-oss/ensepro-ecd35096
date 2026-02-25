import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export interface TimeEditRequest {
  id: number;
  attendanceId?: number;
  employeeName: string;
  date: string;
  originalCheckIn: string;
  originalCheckOut: string;
  newCheckIn: string;
  newCheckOut: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface AppNotification {
  id: string;
  title: string;
  description: string;
  type: "leave" | "attendance" | "ot" | "employee" | "system" | "approval";
  time: string;
  read: boolean;
  actionLabel?: string;
  targetEmployee?: string;
}

interface TimeEditContextType {
  editRequests: TimeEditRequest[];
  addEditRequest: (req: Omit<TimeEditRequest, "id" | "status" | "createdAt">) => void;
  updateRequestStatus: (id: number, status: "approved" | "rejected") => void;
  notifications: AppNotification[];
  addNotification: (notif: Omit<AppNotification, "id">) => void;
  markNotifRead: (id: string) => void;
  markAllNotifsRead: () => void;
  deleteNotif: (id: string) => void;
  toggleNotifRead: (id: string) => void;
}

const TimeEditContext = createContext<TimeEditContextType | null>(null);

export const useTimeEditRequests = () => {
  const ctx = useContext(TimeEditContext);
  if (!ctx) throw new Error("useTimeEditRequests must be used within TimeEditProvider");
  return ctx;
};

// Initial seed data
const seedRequests: TimeEditRequest[] = [
  { id: 1, attendanceId: 2, employeeName: "สมหญิง รักงาน", date: "20/02/2569", originalCheckIn: "08:45", originalCheckOut: "17:30", newCheckIn: "08:00", newCheckOut: "17:30", reason: "ลืมสแกนนิ้ว เข้ามาถึงก่อน 08:00", status: "pending", createdAt: "20/02/2569 10:30" },
  { id: 2, attendanceId: 7, employeeName: "ประสิทธิ์ ทำได้", date: "19/02/2569", originalCheckIn: "-", originalCheckOut: "-", newCheckIn: "08:00", newCheckOut: "17:00", reason: "ไปทำงานนอกสถานที่ ลืมแจ้ง", status: "rejected", createdAt: "19/02/2569 16:00" },
];

const seedNotifications: AppNotification[] = [
  { id: "1", title: "คำขอลาป่วย", description: "สมชาย ใจดี ส่งคำขอลาป่วย 1 วัน (20 ก.พ. 2569)", type: "leave", time: "5 นาที", read: false, actionLabel: "อนุมัติ", targetEmployee: "สมชาย ใจดี" },
  { id: "2", title: "อนุมัติ OT สำเร็จ", description: "อนุมัติ OT 3 รายการ แผนก IT วันที่ 19 ก.พ.", type: "ot", time: "1 ชม.", read: false },
  { id: "3", title: "พนักงานใหม่รอยืนยัน", description: "มีพนักงานใหม่ 2 คนรอยืนยันข้อมูล", type: "employee", time: "2 ชม.", read: false, actionLabel: "ตรวจสอบ" },
  { id: "4", title: "รายงานประจำเดือนพร้อม", description: "รายงานสรุปเดือน ม.ค. 2569 พร้อมดาวน์โหลด", type: "system", time: "1 วัน", read: false },
  { id: "5", title: "คำขอแก้ไขเวลา", description: "นภา สดใส ขอแก้ไขเวลาเข้างาน 18 ก.พ.", type: "attendance", time: "1 วัน", read: true, actionLabel: "อนุมัติ", targetEmployee: "นภา สดใส" },
  { id: "6", title: "ลาพักร้อนรออนุมัติ", description: "วิชัย เก่งกาจ ขอลาพักร้อน 4 วัน (25-28 ก.พ.)", type: "leave", time: "2 วัน", read: true, actionLabel: "อนุมัติ", targetEmployee: "วิชัย เก่งกาจ" },
  { id: "7", title: "อนุมัติลากิจสำเร็จ", description: "คำขอลากิจของ ประภาส มั่นคง ได้รับการอนุมัติ", type: "approval", time: "2 วัน", read: true, targetEmployee: "ประภาส มั่นคง" },
  { id: "8", title: "แจ้งเตือนวันเกิด", description: "พรุ่งนี้เป็นวันเกิดของ สมหญิง รักงาน (HR)", type: "employee", time: "3 วัน", read: true, targetEmployee: "สมหญิง รักงาน" },
  { id: "9", title: "สรุป OT ประจำสัปดาห์", description: "แผนก Sales มี OT รวม 42 ชม. สูงสุด", type: "ot", time: "3 วัน", read: true },
  { id: "10", title: "อัปเดตระบบ v2.1.0", description: "ระบบอัปเดตเรียบร้อยแล้ว", type: "system", time: "5 วัน", read: true },
  { id: "11", title: "พนักงานมาสายซ้ำ", description: "นภา สดใส มาสายครบ 3 ครั้งในเดือนนี้", type: "attendance", time: "5 วัน", read: true, targetEmployee: "นภา สดใส" },
  { id: "12", title: "ใบรับรองแพทย์", description: "สมชาย ใจดี แนบใบรับรองแพทย์ลาป่วย 2 วัน", type: "approval", time: "1 สัปดาห์", read: true, targetEmployee: "สมชาย ใจดี" },
  // Demo notifications for มานะ ขยัน (Employee)
  { id: "13", title: "อนุมัติลาพักร้อน", description: "คำขอลาพักร้อนของคุณ 3 วัน (3-5 มี.ค. 2569) ได้รับการอนุมัติแล้ว", type: "approval", time: "10 นาที", read: false, targetEmployee: "มานะ ขยัน" },
  { id: "14", title: "แจ้งเตือนเข้างานสาย", description: "คุณเข้างานสายเวลา 08:22 น. วันที่ 19 ก.พ. 2569 (สายเกิน 15 นาที)", type: "attendance", time: "3 ชม.", read: false, targetEmployee: "มานะ ขยัน" },
  { id: "15", title: "คำขอแก้ไขเวลาถูกปฏิเสธ", description: "คำขอแก้ไขเวลาเข้างานวันที่ 15 ก.พ. ถูกปฏิเสธ เหตุผล: หลักฐานไม่เพียงพอ", type: "attendance", time: "2 วัน", read: true, targetEmployee: "มานะ ขยัน" },
  { id: "16", title: "เหลือวันลาพักร้อน", description: "คุณเหลือวันลาพักร้อน 5 วัน จากทั้งหมด 10 วัน สำหรับปี 2569", type: "leave", time: "3 วัน", read: true, targetEmployee: "มานะ ขยัน" },
  { id: "17", title: "กะทำงานเปลี่ยนแปลง", description: "กะทำงานของคุณเปลี่ยนเป็น กะเช้า (08:00-17:00) ตั้งแต่ 1 มี.ค. 2569", type: "approval", time: "5 วัน", read: true, targetEmployee: "มานะ ขยัน" },
];

export const TimeEditProvider = ({ children }: { children: ReactNode }) => {
  const [editRequests, setEditRequests] = useState<TimeEditRequest[]>(seedRequests);
  const [notifications, setNotifications] = useState<AppNotification[]>(seedNotifications);

  const addEditRequest = useCallback((req: Omit<TimeEditRequest, "id" | "status" | "createdAt">) => {
    const now = new Date();
    const thaiYear = now.getFullYear() + 543;
    const createdAt = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${thaiYear} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const newReq: TimeEditRequest = {
      ...req,
      id: Date.now(),
      status: "pending",
      createdAt,
    };
    setEditRequests((prev) => [newReq, ...prev]);

    // Auto-add notification
    const notif: AppNotification = {
      id: `ter-${newReq.id}`,
      title: "คำขอแก้ไขเวลา",
      description: `${req.employeeName} ขอแก้ไขเวลา ${req.date} → เข้า ${req.newCheckIn} / ออก ${req.newCheckOut}`,
      type: "attendance",
      time: "เมื่อสักครู่",
      read: false,
      actionLabel: "ตรวจสอบ",
      targetEmployee: req.employeeName,
    };
    setNotifications((prev) => [notif, ...prev]);
  }, []);

  const updateRequestStatus = useCallback((id: number, status: "approved" | "rejected") => {
    setEditRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }, []);

  const addNotification = useCallback((notif: Omit<AppNotification, "id">) => {
    setNotifications((prev) => [{ ...notif, id: `n-${Date.now()}` }, ...prev]);
  }, []);

  const markNotifRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllNotifsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const deleteNotif = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const toggleNotifRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n)));
  }, []);

  return (
    <TimeEditContext.Provider value={{ editRequests, addEditRequest, updateRequestStatus, notifications, addNotification, markNotifRead, markAllNotifsRead, deleteNotif, toggleNotifRead }}>
      {children}
    </TimeEditContext.Provider>
  );
};
