import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Types
export type ModuleKey = "leave" | "ot" | "attendance" | "check-in" | "employee" | "organization" | "shiftManagement" | "day_off" | "payroll" | "reports" | "settings" | "contracts" | "notifications";
export type ActionKey = "view" | "add" | "edit" | "delete" | "approve";
export type Scope = "self" | "department" | "all";

export interface RolePermission {
  id: string;
  role_name: string;
  role_description: string;
  module: string;
  can_view: boolean;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
  scope: string;
}

// Module ↔ route mapping
const moduleToRoutes: Record<string, string[]> = {
  leave: ["/leave"],
  ot: ["/overtime"],
  attendance: ["/attendance"],
  "check-in": ["/check-in"],
  employee: ["/employees"],
  organization: ["/organization"],
  shiftManagement: ["/shift-management"],
  day_off: ["/day-off"],
  payroll: ["/payroll"],
  reports: ["/reports"],
  settings: ["/settings"],
  contracts: ["/contracts"],
  notifications: ["/notifications"],
};

const routeToModule: Record<string, string> = {};
Object.entries(moduleToRoutes).forEach(([mod, routes]) => {
  routes.forEach((r) => { routeToModule[r] = mod; });
});

// Always-accessible routes (no permission check needed)
const alwaysAccessible = ["/dashboard", "/notifications", "/profile"];

interface PermissionsContextType {
  permissions: RolePermission[];
  loading: boolean;
  canAccessRoute: (role: string, path: string) => boolean;
  canAction: (role: string, module: string, action: ActionKey) => boolean;
  getScope: (role: string, module: string) => Scope;
  isSelfOnly: (role: string, path: string) => boolean;
  getModuleForRoute: (path: string) => string | undefined;
  refreshPermissions: () => Promise<void>;
  getRolePermissions: (role: string) => RolePermission[];
  getAllRoles: () => { name: string; description: string }[];
}

const PermissionsContext = createContext<PermissionsContextType | null>(null);

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchPermissions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("*")
        .order("role_name");
      if (error) throw error;
      setPermissions((data as RolePermission[]) || []);
    } catch (e) {
      console.error("Failed to load permissions:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const canAccessRoute = useCallback((role: string, path: string): boolean => {
    const normalized = "/" + path.split("/")[1];
    if (alwaysAccessible.includes(normalized)) return true;
    const mod = routeToModule[normalized];
    if (!mod) return true; // unknown routes accessible by default
    // Permissions not loaded yet: allow to avoid false lockout during initial fetch
    if (permissions.length === 0) return true;
    const perm = permissions.find((p) => p.role_name === role.toLowerCase() && p.module === mod);
    if (!perm) return false; // no permission record for a known module = deny access
    return perm.can_view;
  }, [permissions]);

  const canAction = useCallback((role: string, module: string, action: ActionKey): boolean => {
    const perm = permissions.find((p) => p.role_name === role.toLowerCase() && p.module === module);
    if (!perm) return false;
    switch (action) {
      case "view": return perm.can_view;
      case "add": return perm.can_add;
      case "edit": return perm.can_edit;
      case "delete": return perm.can_delete;
      case "approve": return perm.can_approve;
      default: return false;
    }
  }, [permissions]);

  const getScope = useCallback((role: string, module: string): Scope => {
    const perm = permissions.find((p) => p.role_name === role.toLowerCase() && p.module === module);
    return (perm?.scope as Scope) || "self";
  }, [permissions]);

  const isSelfOnly = useCallback((role: string, path: string): boolean => {
    const r = role.toLowerCase();
    if (["admin", "hr", "manager"].includes(r)) return false;
    const normalized = "/" + path.split("/")[1];
    const mod = routeToModule[normalized];
    if (!mod) return false;
    const scope = getScope(r, mod);
    return scope === "self";
  }, [getScope]);

  const getModuleForRoute = useCallback((path: string): string | undefined => {
    const normalized = "/" + path.split("/")[1];
    return routeToModule[normalized];
  }, []);

  const getRolePermissions = useCallback((role: string): RolePermission[] => {
    return permissions.filter((p) => p.role_name === role.toLowerCase());
  }, [permissions]);

  const getAllRoles = useCallback((): { name: string; description: string }[] => {
    const seen = new Map<string, string>();
    permissions.forEach((p) => {
      if (!seen.has(p.role_name)) {
        seen.set(p.role_name, p.role_description);
      }
    });
    return Array.from(seen.entries()).map(([name, description]) => ({ name, description }));
  }, [permissions]);

  return (
    <PermissionsContext.Provider value={{
      permissions,
      loading,
      canAccessRoute,
      canAction,
      getScope,
      isSelfOnly,
      getModuleForRoute,
      refreshPermissions: fetchPermissions,
      getRolePermissions,
      getAllRoles,
    }}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error("usePermissions must be inside PermissionsProvider");
  return ctx;
};
