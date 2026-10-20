import { useState, useRef } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Search, ChevronDown, X, Check } from "lucide-react";
import EmployeeAvatar from "@/components/ui/employee-avatar";

interface SearchableSelectOption {
  value: string;
  label: string;
  subtitle?: string;
  photoUrl?: string;
  avatar?: string;
  avatarColor?: string;
  avatarTextColor?: string;
  firstName?: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  allowClear?: boolean;
}

const SearchableSelect = ({
  value,
  onChange,
  options,
  placeholder = "เลือก...",
  className = "",
  disabled = false,
  allowClear = false,
}: SearchableSelectProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  const filtered = search.trim()
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(search.toLowerCase()) ||
          (o.subtitle && o.subtitle.toLowerCase().includes(search.toLowerCase()))
      )
    : options;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setSearch("");
  };

  return (
    // ใช้ Popover (portal ไปที่ body) เพื่อให้รายการลอยพ้นกรอบของ Dialog/การ์ดที่มี overflow ได้
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
    <div className={className}>
      <PopoverPrimitive.Trigger asChild>
      <button
        type="button"
        disabled={disabled}
        className="w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-xl border outline-none bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={`flex items-center gap-2 min-w-0 ${selectedOption ? "text-foreground" : "text-muted-foreground"}`}>
          {selectedOption && (selectedOption.photoUrl || selectedOption.firstName || selectedOption.avatar) && (
            <EmployeeAvatar
              photoUrl={selectedOption.photoUrl}
              avatar={selectedOption.avatar}
              avatarColor={selectedOption.avatarColor}
              avatarTextColor={selectedOption.avatarTextColor}
              firstName={selectedOption.firstName}
              size="sm"
            />
          )}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {allowClear && value && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
                setSearch("");
              }}
              className="p-0.5 rounded-full hover:bg-muted transition-colors"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          collisionPadding={8}
          // Dialog (react-remove-scroll) บล็อก wheel/touch ที่อยู่นอก content ของมัน — กันไม่ให้เลื่อนรายการไม่ได้
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}
          className="z-[100] w-[var(--radix-popover-trigger-width)] rounded-xl border bg-popover text-popover-foreground shadow-lg overflow-hidden outline-none animate-in fade-in-0 zoom-in-95"
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหา..."
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="p-0.5">
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          <div className="max-h-[min(14rem,var(--radix-popover-content-available-height))] overflow-y-auto custom-scroll">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">ไม่พบผลลัพธ์</div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent/50 transition-colors ${
                    opt.value === value ? "bg-accent/30 font-medium" : ""
                  }`}
                >
                  <Check className={`w-4 h-4 shrink-0 ${opt.value === value ? "text-primary" : "text-transparent"}`} />
                  {(opt.photoUrl || opt.firstName || opt.avatar) && (
                    <EmployeeAvatar
                      photoUrl={opt.photoUrl}
                      avatar={opt.avatar}
                      avatarColor={opt.avatarColor}
                      avatarTextColor={opt.avatarTextColor}
                      firstName={opt.firstName}
                      size="sm"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="block truncate">{opt.label}</span>
                    {opt.subtitle && (
                      <span className="block text-xs text-muted-foreground truncate">{opt.subtitle}</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </div>
    </PopoverPrimitive.Root>
  );
};

export default SearchableSelect;
