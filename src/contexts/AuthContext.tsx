import React, { createContext, useContext, useState, useCallback } from "react";
import { useEmployees, type Employee } from "./EmployeeContext";

interface AuthContextType {
  currentUser: Employee | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  isAdmin: boolean;
  isManager: boolean;
  isHR: boolean;
  isEmployee: boolean;
  isAccountant: boolean;
  hasAdminAccess: boolean;
}

// Demo credentials mapped by username
const DEMO_CREDENTIALS: Record<string, { password: string }> = {
  "kanchana.s": { password: "admin1234" },
  "somying.r": { password: "hr1234" },
  "somchai.j": { password: "mgr1234" },
  "mana.k": { password: "emp1234" },
  "suda.d": { password: "acc1234" },
  "thanakorn.b": { password: "exec1234" },
  "wichai.k": { password: "emp1234" },
  "nida.s": { password: "emp1234" },
  "prasit.t": { password: "emp1234" },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { employees } = useEmployees();
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);

  const login = useCallback(
    (username: string, password: string): boolean => {
      const demo = DEMO_CREDENTIALS[username];
      if (demo) {
        if (demo.password !== password) return false;
        const emp = employees.find((e) => e.username === username);
        if (!emp) return false;
        setCurrentUser(emp);
        return true;
      }
      // Try matching by username directly (no password check for non-demo)
      const emp = employees.find((e) => e.username === username);
      if (emp) {
        setCurrentUser(emp);
        return true;
      }
      return false;
    },
    [employees]
  );

  const logout = useCallback(() => {
    setCurrentUser(null);
  }, []);

  const role = currentUser?.role || "";
  const isAdmin = role === "Admin";
  const isManager = role === "Manager";
  const isHR = role === "HR";
  const isEmployee = role === "Employee";
  const isAccountant = role === "Accountant";
  const hasAdminAccess = isAdmin || isManager || isHR || isAccountant;

  return (
    <AuthContext.Provider
      value={{ currentUser, login, logout, isAdmin, isManager, isHR, isEmployee, isAccountant, hasAdminAccess }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
