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

/** Display name in English for a role_name coming from the settings page. */
export const roleDisplayName = (roleName: string): string =>
  ROLE_NAME_TO_VALUE[roleName.toLowerCase()] ??
  roleName
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

/**
 * Builds the role dropdown options from the "สิทธิ์ผู้ใช้งาน" settings page
 * (role_permissions). Reflects additions/edits/deletions automatically and
 * respects the display order configured there.
 */
export const useRoleOptions = (): RoleOption[] => {
  const { getAllRoles } = usePermissions();

  return useMemo(
    () =>
      getAllRoles().map((r) => {
        const value = ROLE_NAME_TO_VALUE[r.name.toLowerCase()] ?? r.name;
        const name = roleDisplayName(r.name);
        return {
          value,
          label: r.description ? `${name} — ${r.description}` : name,
        };
      }),
    [getAllRoles]
  );
};

/**
 * Finds the option matching a stored employees.role value, ignoring casing
 * differences between employees.role ("HR") and role_permissions.role_name ("hr").
 */
export const matchRoleOption = (
  options: RoleOption[],
  storedRole: string | undefined | null
): RoleOption | undefined => {
  if (!storedRole) return undefined;
  const target = storedRole.trim().toLowerCase();
  return options.find((o) => o.value.toLowerCase() === target);
};
