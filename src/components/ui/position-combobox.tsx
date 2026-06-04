import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Plus, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useOrg, type Position } from "@/contexts/OrgContext";
import { toast } from "@/hooks/use-toast";

interface PositionComboboxProps {
  /** Currently selected position name */
  value: string;
  /** Called with the chosen (or newly created) position name */
  onChange: (value: string) => void;
  /** Department (affiliation) name the position belongs to */
  deptName: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const flattenPositionNames = (positions: Position[]): string[] => {
  const names: string[] = [];
  const walk = (list: Position[]) => {
    for (const p of list) {
      names.push(p.name);
      if (p.children?.length) walk(p.children);
    }
  };
  walk(positions);
  return names;
};

/**
 * Combobox for selecting a job position scoped to a department.
 * - Lists existing positions of the selected department
 * - Allows searching
 * - Allows adding a brand new position (persisted to that department)
 */
const PositionCombobox = ({
  value,
  onChange,
  deptName,
  label,
  placeholder = "เลือกหรือเพิ่มตำแหน่ง",
  disabled,
  className,
}: PositionComboboxProps) => {
  const { affiliations, addPosition } = useOrg();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const aff = useMemo(
    () => affiliations.find((a) => a.name === deptName),
    [affiliations, deptName],
  );

  const options = useMemo(() => {
    if (aff) return flattenPositionNames(aff.positions);
    // No matching dept yet → show all known positions as suggestions
    const all = new Set<string>();
    affiliations.forEach((a) => flattenPositionNames(a.positions).forEach((n) => all.add(n)));
    return Array.from(all);
  }, [aff, affiliations]);

  const trimmed = search.trim();
  const exactExists = options.some((o) => o.toLowerCase() === trimmed.toLowerCase());
  const canCreate = trimmed.length > 0 && !exactExists;

  const handleSelect = (name: string) => {
    onChange(name);
    setSearch("");
    setOpen(false);
  };

  const handleCreate = async () => {
    if (!trimmed) return;
    if (!aff) {
      toast({ title: "กรุณาเลือกแผนกก่อน", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await addPosition(aff.id, null, trimmed);
      toast({ title: "เพิ่มตำแหน่งสำเร็จ", description: trimmed });
      handleSelect(trimmed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "ไม่สามารถเพิ่มตำแหน่งได้";
      toast({ title: "เพิ่มตำแหน่งไม่สำเร็จ", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <label className="text-xs font-medium text-muted-foreground">{label}</label>}
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
        <PopoverTrigger asChild disabled={disabled}>
          <button
            type="button"
            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-xl border border-border bg-muted/30 outline-none focus:ring-2 focus:ring-primary/30 transition-all disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value || placeholder}
            </span>
            <ChevronsUpDown className="w-4 h-4 opacity-50 flex-shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={true}>
            <CommandInput
              placeholder="ค้นหาหรือพิมพ์ตำแหน่งใหม่..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {!canCreate && <CommandEmpty>ไม่พบตำแหน่ง</CommandEmpty>}
              {options.length > 0 && (
                <CommandGroup heading="ตำแหน่งที่มีอยู่">
                  {options.map((name) => (
                    <CommandItem key={name} value={name} onSelect={() => handleSelect(name)}>
                      <Briefcase className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 truncate">{name}</span>
                      {value === name && <Check className="ml-2 h-4 w-4 text-primary" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {canCreate && (
                <CommandGroup heading="เพิ่มใหม่">
                  <CommandItem
                    value={`__create__${trimmed}`}
                    onSelect={handleCreate}
                    disabled={saving}
                  >
                    <Plus className="mr-2 h-4 w-4 text-primary" />
                    <span>เพิ่มตำแหน่ง: "{trimmed}"</span>
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default PositionCombobox;
