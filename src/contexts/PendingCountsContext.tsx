import { createContext, useContext, useState, ReactNode } from "react";

interface PendingCountsContextType {
  leavePending: number;
  attendancePending: number;
  overtimePending: number;
  notificationCount: number;
  setLeavePending: (count: number) => void;
  setAttendancePending: (count: number) => void;
  setOvertimePending: (count: number) => void;
  setNotificationCount: (count: number) => void;
}

const PendingCountsContext = createContext<PendingCountsContextType>({
  leavePending: 2,
  attendancePending: 1,
  overtimePending: 2,
  notificationCount: 5,
  setLeavePending: () => {},
  setAttendancePending: () => {},
  setOvertimePending: () => {},
  setNotificationCount: () => {},
});

export const usePendingCounts = () => useContext(PendingCountsContext);

export const PendingCountsProvider = ({ children }: { children: ReactNode }) => {
  const [leavePending, setLeavePending] = useState(2);
  const [attendancePending, setAttendancePending] = useState(1);
  const [overtimePending, setOvertimePending] = useState(2);
  const [notificationCount, setNotificationCount] = useState(5);

  return (
    <PendingCountsContext.Provider value={{ leavePending, attendancePending, overtimePending, notificationCount, setLeavePending, setAttendancePending, setOvertimePending, setNotificationCount }}>
      {children}
    </PendingCountsContext.Provider>
  );
};
