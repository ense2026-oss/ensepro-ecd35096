import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from "@/components/ui/dialog";
import EmployeeAvatar from "@/components/ui/employee-avatar";
import type { LeaveRecord } from "@/components/leave/LeaveTable";
import type { LeaveType } from "@/components/leave/LeaveQuotaCards";

interface LeaveCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaves: LeaveRecord[];
  leaveTypes: LeaveType[];
}

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const THAI_DAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

// Parse "DD/MM/YYYY" (Thai BE or CE) or "YYYY-MM-DD" -> Date (local, midnight CE)
const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const slash = dateStr.split("/");
  if (slash.length === 3) {
    const day = parseInt(slash[0]);
    const month = parseInt(slash[1]);
    let year = parseInt(slash[2]);
    if (year > 2400) year -= 543;
    return new Date(year, month - 1, day);
  }
  const iso = dateStr.split("-");
  if (iso.length === 3) {
    let year = parseInt(iso[0]);
    if (year > 2400) year -= 543;
    return new Date(year, parseInt(iso[1]) - 1, parseInt(iso[2]));
  }
  return null;
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const LeaveCalendarDialog: React.FC<LeaveCalendarDialogProps> = ({
  open,
  onOpenChange,
  leaves,
  leaveTypes,
}) => {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const colorMap = useMemo(() => {
    const m = new Map<string, string>();
    leaveTypes.forEach((lt) => m.set(lt.name, lt.color));
    return m;
  }, [leaveTypes]);

  const approved = useMemo(
    () => leaves.filter((l) => l.status === "approved"),
    [leaves],
  );

  // For each leave, precompute its date range
  const leaveRanges = useMemo(() => {
    return approved
      .map((l) => {
        const from = parseDate(l.from);
        const to = parseDate(l.to);
        if (!from || !to) return null;
        return { record: l, from: startOfDay(from), to: startOfDay(to) };
      })
      .filter((x): x is { record: LeaveRecord; from: Date; to: Date } => x !== null);
  }, [approved]);

  // Map day-of-month -> leaves active on that day (for current view month)
  const leavesByDay = useMemo(() => {
    const map = new Map<number, LeaveRecord[]>();
    const monthStart = new Date(viewYear, viewMonth, 1);
    const monthEnd = new Date(viewYear, viewMonth + 1, 0);
    leaveRanges.forEach(({ record, from, to }) => {
      if (to < monthStart || from > monthEnd) return;
      const start = from < monthStart ? monthStart : from;
      const end = to > monthEnd ? monthEnd : to;
      for (let d = start.getDate(); d <= end.getDate(); d++) {
        const arr = map.get(d) || [];
        arr.push(record);
        map.set(d, arr);
      }
    });
    return map;
  }, [leaveRanges, viewYear, viewMonth]);

  // Build calendar grid
  const cells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const result: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) result.push(null);
    for (let d = 1; d <= daysInMonth; d++) result.push(d);
    while (result.length % 7 !== 0) result.push(null);
    return result;
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    setSelectedDay(null);
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    setSelectedDay(null);
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };
  const goToday = () => {
    setSelectedDay(null);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  const isToday = (day: number) =>
    today.getFullYear() === viewYear &&
    today.getMonth() === viewMonth &&
    today.getDate() === day;

  const monthTotal = useMemo(() => {
    const ids = new Set<string>();
    leavesByDay.forEach((arr) => arr.forEach((r) => ids.add(r.id)));
    return ids.size;
  }, [leavesByDay]);

  const selectedLeaves = selectedDay ? leavesByDay.get(selectedDay) || [] : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] w-[96vw] sm:max-w-[96vw] h-[94vh] max-h-[94vh] p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))" }}
              >
                <CalendarDays className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <DialogTitle className="text-lg">ปฏิทินวันลา</DialogTitle>
                <DialogDescription className="text-xs">
                  การลาที่อนุมัติแล้วทั้งหมดในแต่ละวัน · เดือนนี้ {monthTotal} รายการ
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={goToday}
                className="px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted transition-colors"
              >
                วันนี้
              </button>
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <button onClick={prevMonth} className="p-1.5 rounded-md hover:bg-background transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-bold min-w-[140px] text-center">
                  {THAI_MONTHS[viewMonth]} {viewYear + 543}
                </span>
                <button onClick={nextMonth} className="p-1.5 rounded-md hover:bg-background transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Legend */}
          {leaveTypes.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
              {leaveTypes.map((lt) => (
                <div key={lt.id} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: lt.color }} />
                  <span className="text-xs text-muted-foreground">{lt.name}</span>
                </div>
              ))}
            </div>
          )}
        </DialogHeader>

        <DialogBody className="p-0 flex flex-col">
          {/* Weekday header */}
          <div className="grid grid-cols-7 border-b bg-muted/40 shrink-0">
            {THAI_DAYS.map((d, i) => (
              <div
                key={d}
                className="py-2 text-center text-xs font-semibold"
                style={{ color: i === 0 ? "hsl(0 84% 55%)" : i === 6 ? "hsl(220 70% 55%)" : undefined }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 flex-1 auto-rows-fr">
            {cells.map((day, idx) => {
              const dow = idx % 7;
              const dayLeaves = day ? leavesByDay.get(day) || [] : [];
              const todayCell = day && isToday(day);
              return (
                <div
                  key={idx}
                  onClick={() => day && dayLeaves.length > 0 && setSelectedDay(day)}
                  className={`border-b border-r min-h-[90px] p-1.5 flex flex-col gap-1 overflow-hidden transition-colors ${
                    day ? "" : "bg-muted/20"
                  } ${dayLeaves.length > 0 ? "cursor-pointer hover:bg-muted/50" : ""}`}
                  style={dow === 0 ? { borderLeft: "1px solid hsl(var(--border))" } : undefined}
                >
                  {day && (
                    <>
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                            todayCell ? "text-primary-foreground" : ""
                          }`}
                          style={{
                            background: todayCell ? "hsl(var(--primary))" : undefined,
                            color: todayCell
                              ? "hsl(var(--primary-foreground))"
                              : dow === 0
                                ? "hsl(0 84% 55%)"
                                : dow === 6
                                  ? "hsl(220 70% 55%)"
                                  : undefined,
                          }}
                        >
                          {day}
                        </span>
                        {dayLeaves.length > 0 && (
                          <span className="text-[10px] font-bold text-muted-foreground">
                            {dayLeaves.length}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col gap-0.5 overflow-hidden">
                        {dayLeaves.slice(0, 3).map((l) => (
                          <div
                            key={l.id}
                            className="flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium truncate"
                            style={{
                              background: `${colorMap.get(l.type) || "hsl(var(--primary))"}20`,
                              borderLeft: `2px solid ${colorMap.get(l.type) || "hsl(var(--primary))"}`,
                            }}
                            title={`${l.name} · ${l.type}`}
                          >
                            <span className="truncate">{l.name}</span>
                          </div>
                        ))}
                        {dayLeaves.length > 3 && (
                          <span className="text-[10px] text-muted-foreground pl-1">
                            +{dayLeaves.length - 3} เพิ่มเติม
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </DialogBody>

        {/* Selected day detail panel */}
        {selectedDay && (
          <div className="absolute right-0 top-0 h-full w-full sm:w-[340px] bg-background border-l shadow-2xl flex flex-col animate-in slide-in-from-right">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div>
                <p className="text-sm font-bold">
                  {selectedDay} {THAI_MONTHS[viewMonth]} {viewYear + 543}
                </p>
                <p className="text-xs text-muted-foreground">{selectedLeaves.length} คนลางาน</p>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="p-1.5 rounded-md hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {selectedLeaves.map((l) => (
                <div key={l.id} className="flex items-center gap-2 rounded-xl border p-2">
                  <EmployeeAvatar src={l.photoUrl} name={l.name} className="w-9 h-9" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{l.name}</p>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: colorMap.get(l.type) || "hsl(var(--primary))" }}
                      />
                      <span className="text-xs text-muted-foreground truncate">
                        {l.type} · {l.days} วัน
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {l.from} – {l.to}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default LeaveCalendarDialog;
