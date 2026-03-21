// Role-based access configuration for menu items and routes
// Defines which roles can access each feature

export type AppRole = "admin" | "hr" | "manager" | "employee" | "accountant" | "executive";

export interface MenuAccess {
  path: string;
  allowedRoles: AppRole[]; // roles that can see this menu/access this route
  selfOnly?: boolean; // employee sees only their own data (e.g. /employees → own profile)
  labelOverride?: Partial<Record<AppRole, string>>; // role-specific label overrides
}

// Which roles can access each route/menu
export const menuAccessMap: MenuAccess[] = [
  { path: "/dashboard", allowedRoles: ["admin", "hr", "manager", "employee", "accountant", "executive"] },
  { path: "/employees", allowedRoles: ["admin", "hr", "manager", "employee"], selfOnly: true },
  { path: "/organization", allowedRoles: ["admin", "hr", "manager"] },
  { path: "/contracts", allowedRoles: ["admin", "hr", "manager", "executive", "employee"], labelOverride: { employee: "สัญญาจ้างของฉัน" } },
  { path: "/attendance", allowedRoles: ["admin", "hr", "manager"] },
  { path: "/leave", allowedRoles: ["admin", "hr", "manager", "employee"] },
  { path: "/overtime", allowedRoles: ["admin", "hr", "manager", "employee"] },
  { path: "/check-in", allowedRoles: ["admin", "hr", "manager", "employee"] },
  { path: "/shift-management", allowedRoles: ["admin", "hr", "manager"] },
  { path: "/payroll", allowedRoles: ["admin", "hr", "accountant"] },
  { path: "/reports", allowedRoles: ["admin", "hr", "manager", "accountant"] },
  { path: "/notifications", allowedRoles: ["admin", "hr", "manager", "employee", "accountant", "executive"] },
  { path: "/settings", allowedRoles: ["admin"] },
  { path: "/profile", allowedRoles: ["admin", "hr", "manager", "employee", "accountant", "executive"] },
];

/** Check if a role can access a given path */
export function canAccess(role: AppRole, path: string): boolean {
  const entry = menuAccessMap.find((m) => m.path === path);
  if (!entry) return true; // unknown paths are allowed by default
  return entry.allowedRoles.includes(role);
}

/** Check if a role should only see their own data for a path */
export function isSelfOnly(role: AppRole, path: string): boolean {
  if (["admin", "hr", "manager"].includes(role)) return false;
  const entry = menuAccessMap.find((m) => m.path === path);
  return entry?.selfOnly ?? false;
}

/** Get label override for a role, if any */
export function getLabelForRole(role: AppRole, path: string, defaultLabel: string): string {
  const entry = menuAccessMap.find((m) => m.path === path);
  return entry?.labelOverride?.[role] ?? defaultLabel;
}

/** Paths that require management-level access (used for route guards) */
export function getRestrictedPaths(role: AppRole): string[] {
  return menuAccessMap
    .filter((m) => !m.allowedRoles.includes(role))
    .map((m) => m.path);
}
