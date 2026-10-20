import { useMemo } from "react";
import { X } from "lucide-react";
import SearchableSelect from "@/components/ui/searchable-select";
import EmployeeAvatar from "@/components/ui/employee-avatar";
import { useEmployees } from "@/contexts/EmployeeContext";

interface Props {
  value: string[];
  onChange: (ids: string[]) => void;
  // ห้ามเลือกตัวเองเป็นผู้อนุมัติของตัวเอง
  excludeEmployeeId?: string;
  placeholder?: string;
  disabled?: boolean;
}

// เลือกผู้อนุมัติได้หลายคน — แสดงเป็น chip (รูป + ชื่อ + ตำแหน่ง) กด x เพื่อเอาออก
// ใช้ทั้งในฟอร์มแก้ไขพนักงานและหน้าตั้งค่าผู้อนุมัติ
export default function ApproverMultiSelect({
  value,
  onChange,
  excludeEmployeeId,
  placeholder = "เพิ่มผู้อนุมัติ...",
  disabled,
}: Props) {
  const { employees } = useEmployees();

  const byId = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const options = useMemo(
    () =>
      employees
        .filter((e) => e.status !== "inactive" && e.id !== excludeEmployeeId && !value.includes(e.id))
        .map((e) => ({
          value: e.id,
          label: `${e.prefix || ""}${e.firstName} ${e.lastName}`.trim(),
          subtitle: [e.position, e.dept].filter(Boolean).join(" · "),
          photoUrl: e.photoUrl,
          avatar: e.avatar,
          avatarColor: e.avatarColor,
          avatarTextColor: e.avatarTextColor,
          firstName: e.firstName,
        })),
    [employees, excludeEmployeeId, value],
  );

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => {
            const e = byId.get(id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 pl-1 pr-1.5 py-1 rounded-full bg-muted/60 text-xs font-medium"
              >
                <EmployeeAvatar
                  photoUrl={e?.photoUrl}
                  avatar={e?.avatar}
                  avatarColor={e?.avatarColor}
                  avatarTextColor={e?.avatarTextColor}
                  firstName={e?.firstName}
                  size="xs"
                  rounded="full"
                />
                <span className="max-w-[160px] truncate">
                  {e ? `${e.prefix || ""}${e.firstName} ${e.lastName}`.trim() : "ไม่พบพนักงาน"}
                  {e?.position ? <span className="text-muted-foreground font-normal"> · {e.position}</span> : null}
                </span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => onChange(value.filter((v) => v !== id))}
                    className="p-0.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    title="เอาออก"
                    aria-label="เอาผู้อนุมัติออก"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}
      {!disabled && (
        <SearchableSelect
          value=""
          onChange={(id) => { if (id && !value.includes(id)) onChange([...value, id]); }}
          options={options}
          placeholder={placeholder}
        />
      )}
      {value.length === 0 && (
        <p className="text-[10px] text-muted-foreground">
          ยังไม่ได้กำหนด — ใช้ผู้อนุมัติเดิมตามสิทธิ์ของ role (admin/hr)
        </p>
      )}
    </div>
  );
}
