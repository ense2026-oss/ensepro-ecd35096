import { useMemo } from "react";
import { usePermissions } from "@/contexts/PermissionsContext";

export interface RoleOption {
  value: string;
  label: string;
}

// Map the lowercase role_name (from role_permissions) to the value stored on
// employees.role. Base roles keep their capitalized form so they sync to the
// app_role enum; custom roles use their role_name verbatim.
const ROLE_NAME_TO_VALUE: Record<string, string> = {
  admin: "Admin",
  hr: "HR",
  manager: "Manager",
  employee: "Employee",
  accountant: "Accountant",
  executive: "Executive",
};

// Desired display order (by role_name). Roles not listed are appended after.
const ROLE_ORDER = [
  "executive",
  "manager",
  "หัวหน้างาน",
  "hr",
  "employee",
  "accountant",
  "admin",
];

/**
 * Builds the role dropdown options from the "สิทธิ์ผู้ใช้งาน" settings page
 * (role_permissions). Reflects additions/edits/deletions automatically and
 * applies the requested display order.
 */
export const useRoleOptions = (): RoleOption[] => {
  const { getAllRoles } = usePermissions();

  return useMemo(() => {
    const roles = getAllRoles();

    const ordered = [...roles].sort((a, b) => {
      const ia = ROLE_ORDER.indexOf(a.name);
      const ib = ROLE_ORDER.indexOf(b.name);
      const ra = ia === -1 ? Number.MAX_SAFE_INTEGER : ia;
      const rb = ib === -1 ? Number.MAX_SAFE_INTEGER : ib;
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });

    return ordered.map((r) => ({
      value: ROLE_NAME_TO_VALUE[r.name] ?? r.name,
      label: r.description || r.name,
    }));
  }, [getAllRoles]);
};
