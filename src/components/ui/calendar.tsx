import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { th } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const THAI_WEEKDAYS_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const formatWeekdayName = (date: Date) => {
  return THAI_WEEKDAYS_SHORT[date.getDay()];
};

// Custom caption with month/year dropdowns
function CaptionWithDropdowns({ displayMonth, onChange }: { displayMonth: Date; onChange: (date: Date) => void }) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 111 }, (_, i) => currentYear - 100 + i);
  const [showMonths, setShowMonths] = React.useState(false);
  const [showYears, setShowYears] = React.useState(false);
  const monthRef = React.useRef<HTMLDivElement>(null);
  const yearRef = React.useRef<HTMLDivElement>(null);
  const yearGridRef = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (monthRef.current && !monthRef.current.contains(e.target as Node)) setShowMonths(false);
      if (yearRef.current && !yearRef.current.contains(e.target as Node)) setShowYears(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Scroll to selected year when opening
  React.useEffect(() => {
    if (showYears && yearGridRef.current) {
      const selected = yearGridRef.current.querySelector('[data-selected="true"]');
      if (selected) selected.scrollIntoView({ block: "center" });
    }
  }, [showYears]);

  return (
    <div className="flex items-center gap-1 px-1 pt-1">
      {/* Month picker */}
      <div ref={monthRef} className="relative">
        <button
          type="button"
          onClick={() => { setShowMonths(!showMonths); setShowYears(false); }}
          className="text-sm font-medium hover:text-primary transition-colors cursor-pointer px-1"
        >
          {THAI_MONTHS[displayMonth.getMonth()]}
        </button>
        {showMonths && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg p-2 w-[220px]">
            <div className="grid grid-cols-3 gap-1">
              {THAI_MONTHS.map((m, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    const d = new Date(displayMonth);
                    d.setMonth(i);
                    onChange(d);
                    setShowMonths(false);
                  }}
                  className={cn(
                    "text-xs py-1.5 px-1 rounded-md transition-colors",
                    i === displayMonth.getMonth()
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Year picker */}
      <div ref={yearRef} className="relative">
        <button
          type="button"
          onClick={() => { setShowYears(!showYears); setShowMonths(false); }}
          className="text-sm font-medium hover:text-primary transition-colors cursor-pointer px-1"
        >
          {displayMonth.getFullYear() + 543}
        </button>
        {showYears && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg p-2 w-[220px]">
            <div ref={yearGridRef} className="grid grid-cols-4 gap-1 max-h-[200px] overflow-y-auto">
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  data-selected={y === displayMonth.getFullYear()}
                  onClick={() => {
                    const d = new Date(displayMonth);
                    d.setFullYear(y);
                    onChange(d);
                    setShowYears(false);
                  }}
                  className={cn(
                    "text-xs py-1.5 px-1 rounded-md transition-colors",
                    y === displayMonth.getFullYear()
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  )}
                >
                  {y + 543}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  const [month, setMonth] = React.useState<Date>(props.month || props.selected as Date || new Date());

  // Sync with external month prop
  React.useEffect(() => {
    if (props.month) setMonth(props.month);
  }, [props.month]);

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      locale={th}
      month={month}
      onMonthChange={setMonth}
      formatters={{ formatWeekdayName }}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "hidden",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-transparent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-full hover:bg-green-500/20 hover:text-green-700"),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground rounded-full hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground rounded-full",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
        Caption: ({ displayMonth }) => (
          <div className="flex justify-center pt-1 relative items-center">
            <div className="absolute left-1">
              <button
                type="button"
                onClick={() => {
                  const prev = new Date(displayMonth);
                  prev.setMonth(prev.getMonth() - 1);
                  setMonth(prev);
                }}
                className={cn(buttonVariants({ variant: "outline" }), "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100")}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
            <CaptionWithDropdowns displayMonth={displayMonth} onChange={setMonth} />
            <div className="absolute right-1">
              <button
                type="button"
                onClick={() => {
                  const next = new Date(displayMonth);
                  next.setMonth(next.getMonth() + 1);
                  setMonth(next);
                }}
                className={cn(buttonVariants({ variant: "outline" }), "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100")}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
