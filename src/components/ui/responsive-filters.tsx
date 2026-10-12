import { useState, type ReactNode } from "react";
import { ListFilter } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";

interface ResponsiveFiltersProps {
  /** The filter controls (search box, selects, date pickers, …). Pass the raw
      controls — the layout wrapper is applied here. */
  children: ReactNode;
  /** Number of active (non-default) filters, shown as a badge on the mobile button. */
  activeCount?: number;
  /** Dialog/button label. */
  title?: string;
  /** Extra classes for the desktop card wrapper. */
  className?: string;
}

/**
 * One consistent filter UI across the app (modeled on the "พนักงาน" page):
 * - Desktop: the controls render inline in a card, exactly like before.
 * - Mobile: the controls are hidden behind a full-width "ตัวกรอง" button that
 *   opens a dialog, so the filter bar never crowds the small screen.
 *
 * Only ONE copy of the controls is rendered (chosen by viewport), so the inputs
 * keep a single source of truth and never fight over focus.
 */
export default function ResponsiveFilters({
  children,
  activeCount = 0,
  title = "ตัวกรอง",
  className = "",
}: ResponsiveFiltersProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (!isMobile) {
    return (
      <div className={`card-base p-3 ${className}`}>
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative w-full flex items-center justify-center gap-2 h-11 rounded-xl border bg-card text-sm font-medium hover:bg-muted transition-colors"
      >
        <ListFilter className="w-4 h-4" /> {title}
        {activeCount > 0 && (
          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="sr-only">{title}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            {/* Force every control full-width so they stack cleanly in the dialog. */}
            <div className="flex flex-col gap-3 [&>*]:!w-full">{children}</div>
          </DialogBody>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full px-4 py-2 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              เสร็จสิ้น
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
