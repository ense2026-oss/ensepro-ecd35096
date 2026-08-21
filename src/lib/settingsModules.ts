// Per-tab permission sub-modules for the Settings page.
// Each Settings tab has its own permission entry in role_permissions
// (module = key), controlling view + edit + scope per role.

export type SettingsAction = "view" | "add" | "edit" | "delete";

export interface SettingsSubModule {
  key: string;
  label: string;
  actions: SettingsAction[];
}

// List-management tabs support full CRUD; form-style tabs only view/edit.
const LIST_ACTIONS: SettingsAction[] = ["view", "add", "edit", "delete"];
const FORM_ACTIONS: SettingsAction[] = ["view", "edit"];

export const SETTINGS_SUBMODULES: SettingsSubModule[] = [
  { key: "settings_company", label: "ข้อมูลบริษัท", actions: FORM_ACTIONS },
  { key: "settings_affiliations", label: "จัดการแผนก", actions: LIST_ACTIONS },
  { key: "settings_locations", label: "พื้นที่เข้างาน", actions: LIST_ACTIONS },
  { key: "settings_roles", label: "สิทธิ์ผู้ใช้งาน", actions: LIST_ACTIONS },
  { key: "settings_admins", label: "ผู้ดูแลระบบ", actions: LIST_ACTIONS },
  { key: "settings_shifts", label: "กะการทำงาน", actions: LIST_ACTIONS },
  { key: "settings_payroll", label: "ตั้งค่าเงินเดือน", actions: FORM_ACTIONS },
  { key: "settings_contracts", label: "ตั้งค่าสัญญาจ้าง", actions: FORM_ACTIONS },
  { key: "settings_modules", label: "ตั้งค่าโมดูล", actions: FORM_ACTIONS },
  { key: "settings_leave_types", label: "ประเภทการลา", actions: LIST_ACTIONS },
  { key: "settings_company_holidays", label: "วันหยุดบริษัท", actions: LIST_ACTIONS },
  { key: "settings_approval", label: "ระบบอนุมัติ", actions: LIST_ACTIONS },
  { key: "settings_facescan", label: "เครื่องสแกนหน้า", actions: FORM_ACTIONS },
  { key: "settings_display", label: "การแสดงผล", actions: FORM_ACTIONS },
];

// Map Settings.tsx tab id -> permission module key
export const SETTINGS_TAB_TO_MODULE: Record<string, string> = {
  company: "settings_company",
  affiliations: "settings_affiliations",
  locations: "settings_locations",
  roles: "settings_roles",
  admins: "settings_admins",
  shifts: "settings_shifts",
  payroll: "settings_payroll",
  contracts: "settings_contracts",
  modules: "settings_modules",
  "leave-types": "settings_leave_types",
  "company-holidays": "settings_company_holidays",
  approval: "settings_approval",
  "face-scan-connect": "settings_facescan",
  display: "settings_display",
};

export const SETTINGS_MODULE_KEYS = SETTINGS_SUBMODULES.map((m) => m.key);

export const isSettingsModule = (module: string) => module.startsWith("settings_");
