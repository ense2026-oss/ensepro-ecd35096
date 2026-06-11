// Per-tab permission sub-modules for the Settings page.
// Each Settings tab has its own permission entry in role_permissions
// (module = key), controlling view + edit + scope per role.

export interface SettingsSubModule {
  key: string;
  label: string;
}

export const SETTINGS_SUBMODULES: SettingsSubModule[] = [
  { key: "settings_company", label: "ข้อมูลบริษัท" },
  { key: "settings_affiliations", label: "จัดการแผนก" },
  { key: "settings_locations", label: "พื้นที่เข้างาน" },
  { key: "settings_roles", label: "สิทธิ์ผู้ใช้งาน" },
  { key: "settings_admins", label: "ผู้ดูแลระบบ" },
  { key: "settings_shifts", label: "กะการทำงาน" },
  { key: "settings_payroll", label: "ตั้งค่าเงินเดือน" },
  { key: "settings_modules", label: "ตั้งค่าโมดูล" },
  { key: "settings_leave_types", label: "ประเภทการลา" },
  { key: "settings_company_holidays", label: "วันหยุดบริษัท" },
  { key: "settings_approval", label: "ระบบอนุมัติ" },
  { key: "settings_facescan", label: "เครื่องสแกนหน้า" },
  { key: "settings_display", label: "การแสดงผล" },
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
  modules: "settings_modules",
  "leave-types": "settings_leave_types",
  "company-holidays": "settings_company_holidays",
  approval: "settings_approval",
  "face-scan-connect": "settings_facescan",
  display: "settings_display",
};

export const SETTINGS_MODULE_KEYS = SETTINGS_SUBMODULES.map((m) => m.key);

export const isSettingsModule = (module: string) => module.startsWith("settings_");
