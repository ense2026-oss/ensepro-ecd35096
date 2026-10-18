// "ผู้บริหาร" — นิยามเดียวกับหน้าแดชบอร์ด/หน้า login:
// role เป็น admin หรือ executive หรืออยู่แผนก "ผู้บริหาร"
// ใช้ซ่อนผู้บริหารออกจากรายชื่อทุกหน้า ยกเว้นหน้าเงินเดือนและหน้าองค์กร
export function isManagementEmployee(
  e: { role?: string | null; dept?: string | null } | null | undefined,
): boolean {
  if (!e) return false;
  const r = (e.role || "").toLowerCase();
  return r === "admin" || r === "executive" || (e.dept || "").trim() === "ผู้บริหาร";
}

/** กรองผู้บริหารออกจากรายการพนักงาน */
export function excludeManagement<T extends { role?: string | null; dept?: string | null }>(
  list: T[],
): T[] {
  return list.filter((e) => !isManagementEmployee(e));
}

/** สร้าง Set ของ employee id ที่เป็นผู้บริหาร — ใช้กรองรายการ record (ลา/OT/เวลา) ด้วย employee_id */
export function managementIdSet(
  employees: { id: string; role?: string | null; dept?: string | null }[],
): Set<string> {
  return new Set(employees.filter(isManagementEmployee).map((e) => e.id));
}
