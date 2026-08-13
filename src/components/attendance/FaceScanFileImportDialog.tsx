import { useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, AlertCircle, CheckCircle2, XCircle, Download } from "lucide-react";
import { toast } from "sonner";
import { useEmployees } from "@/contexts/EmployeeContext";

interface FaceScanFileImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

interface ParsedRow {
  pin: string;
  name: string;
  serialNumber: string;
  date: string; // yyyy-MM-dd
  time: string; // HH:mm
}

interface DailyRecord {
  employeeId: string;
  date: string;
  checkIn: string;
  checkOut: string;
  serialNumber: string;
  rawName: string;
}

interface PreviewStat {
  totalRows: number;
  validRows: number;
  unmatchedPins: string[];
  dateRange: { from: string; to: string } | null;
  serialNumber: string | null;
  matchedEmployees: number;
}

export const FaceScanFileImportDialog = ({
  open,
  onOpenChange,
  onImported,
}: FaceScanFileImportDialogProps) => {
  const { employees } = useEmployees();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [step, setStep] = useState<"upload" | "preview" | "processing" | "done">("upload");
  const [overwrite, setOverwrite] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState({ inserted: 0, updated: 0, skipped: 0, unmatched: 0 });
  const [processing, setProcessing] = useState(false);

  const pinToEmployee = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of employees) {
      if (e.faceScanId) {
        map.set(e.faceScanId.trim(), e.id);
      }
    }
    return map;
  }, [employees]);

  const employeeName = useCallback(
    (id: string) => {
      const e = employees.find((x) => x.id === id);
      return e ? `${e.firstName} ${e.lastName}` : id;
    },
    [employees]
  );

  const parseFile = useCallback((selectedFile: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const lines = text.split(/\r?\n/);
      const parsed: ParsedRow[] = [];
      let serialNumber: string | null = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (line.startsWith("UDISKLOG")) continue;
        if (line.startsWith("No\t")) continue;

        const parts = line.split("\t");
        if (parts.length < 7) continue;

        const [noRaw, mchn, enNo, name, mode, iomd, dateTimeRaw] = parts;
        if (!enNo || !dateTimeRaw) continue;
        if (!serialNumber) serialNumber = mchn || null;

        const dateTime = dateTimeRaw.trim();
        const match = dateTime.match(/(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
        if (!match) continue;

        const [, yyyy, mm, dd, hh, min] = match;
        parsed.push({
          pin: enNo.trim(),
          name: (name || "").trim(),
          serialNumber: mchn || serialNumber || "",
          date: `${yyyy}-${mm}-${dd}`,
          time: `${hh}:${min}`,
        });
      }

      setRows(parsed);
      setStep("preview");
    };
    reader.readAsText(selectedFile, "UTF-8");
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith(".txt")) {
      toast.error("รองรับเฉพาะไฟล์ .txt ที่ export จากเครื่องสแกน");
      return;
    }
    setFile(selected);
    parseFile(selected);
  };

  const preview = useMemo<PreviewStat>(() => {
    if (rows.length === 0) {
      return { totalRows: 0, validRows: 0, unmatchedPins: [], dateRange: null, serialNumber: null, matchedEmployees: 0 };
    }

    const matchedPins = new Set<string>();
    const unmatchedPins = new Set<string>();
    const dates = rows.map((r) => r.date).sort();
    const serialNumber = rows[0]?.serialNumber || null;

    for (const r of rows) {
      if (pinToEmployee.has(r.pin)) matchedPins.add(r.pin);
      else unmatchedPins.add(r.pin);
    }

    return {
      totalRows: rows.length,
      validRows: rows.length,
      unmatchedPins: Array.from(unmatchedPins).sort(),
      dateRange: dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : null,
      serialNumber,
      matchedEmployees: matchedPins.size,
    };
  }, [rows, pinToEmployee]);

  const dailyRecords = useMemo<DailyRecord[]>(() => {
    const groups = new Map<string, ParsedRow[]>();
    for (const r of rows) {
      if (!pinToEmployee.has(r.pin)) continue;
      const key = `${pinToEmployee.get(r.pin)}|${r.date}`;
      const list = groups.get(key) || [];
      list.push(r);
      groups.set(key, list);
    }

    const records: DailyRecord[] = [];
    for (const [key, list] of groups.entries()) {
      list.sort((a, b) => a.time.localeCompare(b.time));
      const [employeeId, date] = key.split("|");
      records.push({
        employeeId,
        date,
        checkIn: list[0].time,
        checkOut: list.length > 1 ? list[list.length - 1].time : "-",
        serialNumber: list[0].serialNumber,
        rawName: list[0].name,
      });
    }
    return records.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.employeeId.localeCompare(b.employeeId)));
  }, [rows, pinToEmployee]);

  const sampleUnmatched = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (!pinToEmployee.has(r.pin)) {
        map.set(r.pin, r.name);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(0, 20);
  }, [rows, pinToEmployee]);

  const runImport = async () => {
    if (dailyRecords.length === 0) return;
    setProcessing(true);
    setStep("processing");
    setProgress(0);

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let unmatched = 0;

    const batchSize = 100;
    for (let i = 0; i < dailyRecords.length; i += batchSize) {
      const batch = dailyRecords.slice(i, i + batchSize);
      const employeeIds = batch.map((r) => r.employeeId);
      const dates = batch.map((r) => r.date);

      const { data: existingRows } = await supabase
        .from("check_in_records")
        .select("id, employee_id, date")
        .in("employee_id", employeeIds)
        .in("date", dates);

      const existingSet = new Set((existingRows || []).map((x: any) => `${x.employee_id}|${x.date}`));
      const existingMap = new Map((existingRows || []).map((x: any) => [`${x.employee_id}|${x.date}`, x.id]));

      for (const rec of batch) {
        const key = `${rec.employeeId}|${rec.date}`;
        const hasExisting = existingSet.has(key);
        const payload = {
          employee_id: rec.employeeId,
          date: rec.date,
          check_in: rec.checkIn,
          check_out: rec.checkOut,
          location: rec.serialNumber || "Face Scanner",
          within_radius: true,
          source: "face_scan_file",
          remark: rec.rawName,
        };

        if (hasExisting) {
          if (overwrite) {
            const { error } = await supabase
              .from("check_in_records")
              .update(payload)
              .eq("id", existingMap.get(key));
            if (!error) updated++;
            else skipped++;
          } else {
            skipped++;
          }
        } else {
          const { error } = await supabase.from("check_in_records").insert(payload);
          if (!error) inserted++;
          else skipped++;
        }
      }

      setProgress(Math.min(100, Math.round(((i + batch.length) / dailyRecords.length) * 100)));
    }

    // Log the import
    await supabase.from("face_scan_sync_logs").insert({
      device_id: null,
      sync_type: "file_import",
      status: "success",
      records_synced: inserted + updated,
      message: `Inserted ${inserted}, updated ${updated}, skipped ${skipped}, unmatched ${unmatched}. File: ${file?.name || "-"}.`,
      command_payload: {
        file_name: file?.name || null,
        serial_number: preview.serialNumber,
        overwrite,
        total_rows: rows.length,
        daily_records: dailyRecords.length,
      },
    });

    setResult({ inserted, updated, skipped, unmatched: preview.unmatchedPins.length });
    setStep("done");
    setProcessing(false);
    onImported?.();
    toast.success(`นำเข้าเสร็จแล้ว: เพิ่ม ${inserted} / อัปเดต ${updated} / ข้าม ${skipped}`);
  };

  const reset = () => {
    setFile(null);
    setRows([]);
    setStep("upload");
    setOverwrite(false);
    setProgress(0);
    setResult({ inserted: 0, updated: 0, skipped: 0, unmatched: 0 });
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>นำเข้าข้อมูลจากเครื่องสแกนใบหน้า</DialogTitle>
          <DialogDescription>
            อัปโหลดไฟล์ .txt ที่ export จากเครื่องสแกนหน้า (UDISKLOG) แล้วระบบจะเทียบ EnNo กับรหัสพนักงานในระบบ
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {step === "upload" && (
            <div className="space-y-4">
              <Card className="border-dashed border-2 p-8 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <Upload className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-medium mb-1">เลือกไฟล์ .txt</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  ไฟล์ต้องเป็นรูปแบบ UDISKLOG ที่ export จากเครื่องสแกน (คั่นด้วย Tab)
                </p>
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer"
                  style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}>
                  <FileText className="w-4 h-4" />
                  เลือกไฟล์
                  <input type="file" accept=".txt" className="hidden" onChange={handleFileChange} />
                </label>
              </Card>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="font-mono">
                  <FileText className="w-3 h-3 mr-1" />
                  {file?.name}
                </Badge>
                <Badge variant="outline">
                  {preview.totalRows.toLocaleString()} บรรทัด
                </Badge>
                {preview.dateRange && (
                  <Badge variant="outline">
                    {preview.dateRange.from} ถึง {preview.dateRange.to}
                  </Badge>
                )}
                {preview.serialNumber && (
                  <Badge variant="outline" className="font-mono">
                    SN: {preview.serialNumber}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="p-3 text-center">
                  <div className="text-2xl font-bold text-primary">{preview.matchedEmployees}</div>
                  <div className="text-xs text-muted-foreground">จับคู่ได้</div>
                </Card>
                <Card className="p-3 text-center">
                  <div className="text-2xl font-bold">{dailyRecords.length}</div>
                  <div className="text-xs text-muted-foreground">วัน-พนักงาน</div>
                </Card>
                <Card className="p-3 text-center">
                  <div className="text-2xl font-bold" style={{ color: preview.unmatchedPins.length > 0 ? "hsl(0 84% 50%)" : undefined }}>
                    {preview.unmatchedPins.length}
                  </div>
                  <div className="text-xs text-muted-foreground">รหัสไม่จับคู่</div>
                </Card>
                <Card className="p-3 text-center">
                  <div className="text-2xl font-bold">{rows.length}</div>
                  <div className="text-xs text-muted-foreground">รายการแสกน</div>
                </Card>
              </div>

              {preview.unmatchedPins.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                      รหัสต่อไปนี้ยังไม่ได้จับคู่กับพนักงาน ({preview.unmatchedPins.length} รหัส)
                    </span>
                  </div>
                  <div className="max-h-32 overflow-y-auto text-xs space-y-1">
                    {sampleUnmatched.map(([pin, name]) => (
                      <div key={pin} className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">{pin}</Badge>
                        <span className="text-muted-foreground truncate">{name || "(ไม่มีชื่อ)"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 rounded-lg border p-3">
                <Checkbox
                  id="overwrite"
                  checked={overwrite}
                  onCheckedChange={(checked) => setOverwrite(checked === true)}
                />
                <label htmlFor="overwrite" className="text-sm cursor-pointer">
                  เขียนทับข้อมูลที่มีอยู่แล้วในวันเดียวกัน (ค่าเริ่มต้นคือข้าม)
                </label>
              </div>
            </div>
          )}

          {step === "processing" && (
            <div className="space-y-4 text-center py-6">
              <div className="text-sm font-medium">กำลังนำเข้าข้อมูล...</div>
              <Progress value={progress} className="w-full" />
              <div className="text-xs text-muted-foreground">{progress}%</div>
            </div>
          )}

          {step === "done" && (
            <div className="space-y-4 text-center py-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-2">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <div className="text-lg font-medium">นำเข้าเสร็จสิ้น</div>
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-3">
                  <div className="text-xl font-bold text-green-600">{result.inserted}</div>
                  <div className="text-xs text-muted-foreground">เพิ่มใหม่</div>
                </Card>
                <Card className="p-3">
                  <div className="text-xl font-bold text-blue-600">{result.updated}</div>
                  <div className="text-xs text-muted-foreground">เขียนทับ</div>
                </Card>
                <Card className="p-3">
                  <div className="text-xl font-bold text-amber-600">{result.skipped}</div>
                  <div className="text-xs text-muted-foreground">ข้าม</div>
                </Card>
              </div>
              {result.unmatched > 0 && (
                <div className="text-xs text-amber-600 flex items-center justify-center gap-1">
                  <XCircle className="w-3 h-3" />
                  มี {result.unmatched} รหัสจากเครื่องยังไม่ได้จับคู่กับพนักงาน
                </div>
              )}
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>
                ยกเลิก
              </Button>
              <Button onClick={runImport} disabled={dailyRecords.length === 0}>
                <Download className="w-4 h-4 mr-1" />
                ยืนยันนำเข้า ({dailyRecords.length.toLocaleString()} รายการ)
              </Button>
            </>
          )}
          {(step === "upload" || step === "done") && (
            <Button variant="outline" onClick={() => handleClose(false)}>
              {step === "done" ? "ปิด" : "ยกเลิก"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FaceScanFileImportDialog;
