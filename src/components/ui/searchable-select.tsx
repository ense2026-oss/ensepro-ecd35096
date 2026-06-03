import { useState, useRef, useEffect } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  const filtered = search.trim()
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(search.toLowerCase()) ||
          (o.subtitle && o.subtitle.toLowerCase().includes(search.toLowerCase()))
      )
    : options;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
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

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border bg-popover shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95">
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
          <div className="max-h-56 overflow-y-auto custom-scroll">
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
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
