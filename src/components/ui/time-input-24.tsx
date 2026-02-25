import { useState, useRef, useCallback } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimeInput24Props {
  value: string; // "HH:MM"
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

const TimeInput24 = ({ value, onChange, className, disabled }: TimeInput24Props) => {
  const [h, m] = (value || "00:00").split(":");
  const [hourDraft, setHourDraft] = useState<string | null>(null);
  const [minuteDraft, setMinuteDraft] = useState<string | null>(null);
  const hourRef = useRef<HTMLInputElement>(null);
  const minuteRef = useRef<HTMLInputElement>(null);

  // Display value: draft (while editing) or parent value
  const hourDisplay = hourDraft !== null ? hourDraft : (h || "00");
  const minuteDisplay = minuteDraft !== null ? minuteDraft : (m || "00");

  const commit = useCallback((hVal: string, mVal: string) => {
    const hNum = Math.max(0, Math.min(23, parseInt(hVal || "0", 10)));
    const mNum = Math.max(0, Math.min(59, parseInt(mVal || "0", 10)));
    onChange(`${pad2(hNum)}:${pad2(mNum)}`);
  }, [onChange]);

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
    setHourDraft(raw);
    if (raw.length === 2) {
      // Don't auto-advance, let user see what they typed
      setTimeout(() => {
        minuteRef.current?.focus();
        minuteRef.current?.select();
      }, 0);
    }
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
    setMinuteDraft(raw);
  };

  const handleHourBlur = () => {
    const val = hourDraft !== null ? hourDraft : h;
    const n = Math.max(0, Math.min(23, parseInt(val || "0", 10)));
    setHourDraft(null);
    commit(pad2(n), minuteDraft !== null ? minuteDraft : m);
  };

  const handleMinuteBlur = () => {
    const val = minuteDraft !== null ? minuteDraft : m;
    const n = Math.max(0, Math.min(59, parseInt(val || "0", 10)));
    setMinuteDraft(null);
    commit(hourDraft !== null ? hourDraft : h, pad2(n));
  };

  const handleHourFocus = () => {
    setHourDraft(h || "00");
    setTimeout(() => hourRef.current?.select(), 0);
  };

  const handleMinuteFocus = () => {
    setMinuteDraft(m || "00");
    setTimeout(() => minuteRef.current?.select(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, field: "h" | "m") => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const cur = parseInt(field === "h" ? (hourDraft ?? h ?? "0") : (minuteDraft ?? m ?? "0"), 10);
      const max = field === "h" ? 23 : 59;
      const next = e.key === "ArrowUp" ? (cur >= max ? 0 : cur + 1) : (cur <= 0 ? max : cur - 1);
      const padded = pad2(next);
      if (field === "h") {
        setHourDraft(padded);
      } else {
        setMinuteDraft(padded);
      }
    } else if (e.key === "Backspace" && field === "m" && (minuteDraft === "" || minuteDraft === null)) {
      e.preventDefault();
      hourRef.current?.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-0 px-3 py-2 rounded-xl border bg-background text-sm focus-within:ring-1 focus-within:ring-primary transition-all",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <input
        ref={hourRef}
        type="text"
        inputMode="numeric"
        value={hourDisplay}
        onChange={handleHourChange}
        onFocus={handleHourFocus}
        onBlur={handleHourBlur}
        onKeyDown={(e) => handleKeyDown(e, "h")}
        placeholder="00"
        disabled={disabled}
        className="w-8 text-center bg-transparent outline-none font-mono tabular-nums"
        maxLength={2}
      />
      <span className="text-muted-foreground font-mono select-none">:</span>
      <input
        ref={minuteRef}
        type="text"
        inputMode="numeric"
        value={minuteDisplay}
        onChange={handleMinuteChange}
        onFocus={handleMinuteFocus}
        onBlur={handleMinuteBlur}
        onKeyDown={(e) => handleKeyDown(e, "m")}
        placeholder="00"
        disabled={disabled}
        className="w-8 text-center bg-transparent outline-none font-mono tabular-nums"
        maxLength={2}
      />
      <Clock className="w-4 h-4 text-muted-foreground ml-auto flex-shrink-0" />
    </div>
  );
};

export default TimeInput24;
