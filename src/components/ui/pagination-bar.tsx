import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationBarProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

// Shared list pagination footer (same look as the employees table footer):
// "แสดง a–b จาก N รายการ" on the left, prev / numbered pages / next on the right.
export default function PaginationBar({ page, pageSize, total, onPageChange, className = "" }: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (safePage > 3) pages.push("...");
    for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pages.push(i);
    if (safePage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  if (total <= pageSize) {
    return (
      <div className={`flex items-center px-4 py-3 text-sm text-muted-foreground ${className}`}>
        แสดง {from}–{to} จาก {total} รายการ
      </div>
    );
  }

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between px-4 py-3 gap-3 border-t ${className}`} style={{ borderColor: "hsl(var(--border))" }}>
      <div className="text-sm text-muted-foreground">แสดง {from}–{to} จาก {total} รายการ</div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage <= 1}
          aria-label="หน้าก่อนหน้า"
          className="p-1.5 rounded-lg border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {pages.map((pg, i) =>
          pg === "..." ? (
            <span key={`e${i}`} className="px-2 text-muted-foreground text-sm">...</span>
          ) : (
            <button
              key={pg}
              onClick={() => onPageChange(pg)}
              className={`min-w-[32px] h-8 rounded-lg text-xs font-medium transition-colors ${safePage === pg ? "text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              style={safePage === pg ? { background: "hsl(var(--primary))" } : undefined}
            >
              {pg}
            </button>
          ),
        )}
        <button
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage >= totalPages}
          aria-label="หน้าถัดไป"
          className="p-1.5 rounded-lg border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
