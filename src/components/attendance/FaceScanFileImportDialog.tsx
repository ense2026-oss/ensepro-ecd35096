import { useState, useMemo, useCallback, useEffect } from "react";
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
import SearchableSelect from "@/components/ui/searchable-select";
import { fetchAllRows } from "@/lib/fetchAll";
import { dedupePunches, pairPunches, buildShiftResolver, parseReportRows, resolveSingleScan, type ShiftRow, type ShiftAssignmentRow, type ReportDayRow } from "@/lib/scanPunches";

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
  const { employees, updateEmployee } = useEmployees();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [step, setStep] = useState<"upload" | "preview" | "processing" | "done">("upload");
  const [overwrite, setOverwrite] = useState(true);
  const [manualLinks, setManualLinks] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState({ inserted: 0, updated: 0, skipped: 0, linked: 0, unmatched: 0 });
  const [processing, setProcessing] = useState(false);
  // กะของพนักงาน — ใช้ผูกคู่เข้า-ออกของกะข้ามเที่ยงคืน (โหลดตอนเปิดหน้าต่าง ถ้าโหลดไม่ได้ก็ทำงานแบบตามวันปฏิทินเหมือนเดิม)
  // ไฟล์ Excel รายงานเข้า-ออก: มีเวลาเข้า/ออกรายวันอยู่แล้ว (ไม่ใช่รายการสแกนดิบ) จึงไม่ต้องจับคู่จากลำดับเวลา
  const [dayRows, setDayRows] = useState<ReportDayRow[]>([]);
  const [shiftRows, setShiftRows] = useState<ShiftRow[]>([]);
  const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignmentRow[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const [shifts, assigns] = await Promise.all([
          fetchAllRows<ShiftRow>((from, to) => supabase.from("shifts").select("id, name, start_time, end_time").range(from, to)),
          fetchAllRows<ShiftAssignmentRow>((from, to) => supabase.from("shift_assignments").select("employee_id, shift_id, start_date, end_date").range(from, to)),
        ]);
        if (!cancelled) { setShiftRows(shifts); setShiftAssignments(assigns); }
      } catch {
        /* ไม่มีข้อมูลกะ — ใช้การจัดวันตามปฏิทินแบบเดิม */
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const pinToEmployee = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of employees) {
      if (e.faceScanId) {
        map.set(e.faceScanId.trim(), e.id);
      }
    }
    return map;
  }, [employees]);

  // ชื่อที่ตัดคำนำหน้า/ช่องว่างออก สำหรับจับคู่ชื่อในไฟล์กับพนักงาน
  const normName = (s: string) => {
    let t = (s || "").trim();
    const prefixes = ["นางสาว", "นาง", "นาย", "น.ส.", "ด.ช.", "ด.ญ.", "ว่าที่ร้อยตรี", "ว่าที่ ร.ต."];
    for (const p of prefixes) { if (t.startsWith(p)) { t = t.slice(p.length); break; } }
    return t.replace(/\s+/g, "").toLowerCase();
  };

  // ชื่อ(ไม่มีคำนำหน้า) -> รายชื่อ employeeId (ใช้เช็กความกำกวม)
  const empByName = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const e of employees) {
      const k = normName(`${e.firstName ?? ""} ${e.lastName ?? ""}`);
      if (!k) continue;
      const arr = map.get(k) || [];
      arr.push(e.id);
      map.set(k, arr);
    }
    return map;
  }, [employees]);

  // EnNo ที่ยังไม่ผูก แต่จับชื่อในไฟล์ได้ตรงกับพนักงานคนเดียวแบบไม่กำกวม
  // และพนักงานคนนั้นยังไม่มี face_scan_id -> จะ "เรียนรู้" ผูกรหัสให้อัตโนมัติ
  const autoLinks = useMemo(() => {
    const pinName = new Map<string, string>();
    for (const r of rows) {
      if (pinToEmployee.has(r.pin)) continue;      // ผูกด้วย id อยู่แล้ว
      if (!pinName.has(r.pin)) pinName.set(r.pin, r.name || "");
      else if (!pinName.get(r.pin) && r.name) pinName.set(r.pin, r.name); // เติมชื่อถ้าอันแรกว่าง
    }
    const empWithScan = new Set(
      employees.filter((e) => e.faceScanId && e.faceScanId.trim()).map((e) => e.id)
    );
    const tentative: { pin: string; employeeId: string; name: string }[] = [];
    const claims = new Map<string, number>(); // employeeId -> จำนวน pin ที่อ้างสิทธิ์
    for (const [pin, name] of pinName.entries()) {
      const k = normName(name);
      if (!k) continue;
      const cands = empByName.get(k) || [];
      if (cands.length !== 1) continue;            // ไม่เจอ หรือ ชื่อซ้ำ -> ไม่เดา
      const employeeId = cands[0];
      if (empWithScan.has(employeeId)) continue;   // มีรหัสเดิมอยู่แล้ว -> ไม่ทับ
      tentative.push({ pin, employeeId, name });
      claims.set(employeeId, (claims.get(employeeId) || 0) + 1);
    }
    // ถ้าพนักงานคนเดียวถูกหลาย pin อ้าง -> กำกวม ตัดทิ้งทั้งหมด
    return tentative.filter((t) => (claims.get(t.employeeId) || 0) === 1);
  }, [rows, pinToEmployee, empByName, employees]);

  // แผนที่รวม: รหัสที่ผูกแล้ว + รหัสที่จะเรียนรู้ใหม่ + รหัสที่ HR เลือกผูกเองในหน้า Preview
  const effectivePinToEmployee = useMemo(() => {
    const m = new Map(pinToEmployee);
    for (const a of autoLinks) m.set(a.pin, a.employeeId);
    for (const [pin, empId] of Object.entries(manualLinks)) {
      if (empId) m.set(pin, empId);
    }
    return m;
  }, [pinToEmployee, autoLinks, manualLinks]);

  // ตัวเลือกพนักงานสำหรับผูกรหัสเอง (เฉพาะคนที่ยังไม่มี face_scan_id)
  const linkableEmployeeOptions = useMemo(
    () =>
      employees
        .filter((e) => !e.faceScanId || !e.faceScanId.trim())
        .map((e) => ({
          value: e.id,
          label: `${e.firstName} ${e.lastName}`,
          subtitle: `${e.dept ?? ""} · ${e.position ?? ""}`,
        })),
    [employees]
  );

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

      setDayRows([]);
      setRows(parsed);
      setStep("preview");
    };
    reader.readAsText(selectedFile, "UTF-8");
  }, []);

  const parseExcelFile = useCallback(async (selectedFile: File) => {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await selectedFile.arrayBuffer(), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
      const days = parseReportRows(aoa);
      if (!days) {
        toast.error("ไม่พบหัวคอลัมน์ รหัสที่เครื่อง / วันที่ / เข้า / ออก ในไฟล์ Excel");
        return;
      }
      const used = days.filter((d) => d.checkIn || d.checkOut);
      setDayRows(used);
      setRows(used.map((d) => ({ pin: d.pin, name: d.name, serialNumber: "Excel", date: d.date, time: d.checkIn || d.checkOut })));
      setStep("preview");
    } catch {
      toast.error("อ่านไฟล์ Excel ไม่สำเร็จ");
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    const lower = selected.name.toLowerCase();
    const isExcel = lower.endsWith(".xlsx") || lower.endsWith(".xls");
    if (!isExcel && !lower.endsWith(".txt")) {
      toast.error("รองรับไฟล์ .txt (UDISKLOG) หรือ .xlsx รายงานเข้า-ออก");
      return;
    }
    setFile(selected);
    if (isExcel) void parseExcelFile(selected);
    else parseFile(selected);
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
      if (effectivePinToEmployee.has(r.pin)) matchedPins.add(r.pin);
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
  }, [rows, effectivePinToEmployee]);

  // รวมสแกนเป็นรายวัน: กรองสแกนซ้ำ (ภายใน 2 นาที) + ผูกคู่เข้า-ออกของกะข้ามเที่ยงคืนตามกะของพนักงาน
  const processed = useMemo(() => {
    const shiftText = new Map(employees.map((e) => [e.id, e.shift || ""]));
    const shiftOf = buildShiftResolver(shiftRows, shiftAssignments, shiftText);

    const perEmployee = new Map<string, ParsedRow[]>();
    for (const r of rows) {
      const empId = effectivePinToEmployee.get(r.pin);
      if (!empId) continue;
      const list = perEmployee.get(empId) || [];
      list.push(r);
      perEmployee.set(empId, list);
    }

    const records: DailyRecord[] = [];
    let dupRemoved = 0;
    let overnightPaired = 0;
    let singleResolved = 0;

    if (dayRows.length > 0) {
      // รายงาน Excel: เวลาเข้า/ออกรายวันมาครบแล้ว — เข้า=ออก (สแกนครั้งเดียว) ตัดสินตามกะ, ออก<เข้า คือกะข้ามเที่ยงคืน
      const merged = new Map<string, DailyRecord>();
      for (const d of dayRows) {
        const employeeId = effectivePinToEmployee.get(d.pin);
        if (!employeeId) continue;
        let inT = d.checkIn;
        let outT = d.checkOut;
        if (inT && outT && inT === outT) {
          singleResolved++;
          if (resolveSingleScan(inT, shiftOf(employeeId, d.date)) === "in") outT = "";
          else inT = "";
        }
        if (inT && outT && outT < inT) overnightPaired++;
        const key = `${employeeId}|${d.date}`;
        const prev = merged.get(key);
        if (prev) {
          if (inT && (prev.checkIn === "-" || inT < prev.checkIn)) prev.checkIn = inT;
          if (outT && (prev.checkOut === "-" || outT > prev.checkOut)) prev.checkOut = outT;
        } else {
          merged.set(key, { employeeId, date: d.date, checkIn: inT || "-", checkOut: outT || "-", serialNumber: "Excel", rawName: d.name });
        }
      }
      records.push(...merged.values());
      records.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.employeeId.localeCompare(b.employeeId)));
      return { records, dupRemoved, overnightPaired, singleResolved };
    }

    for (const [employeeId, list] of perEmployee.entries()) {
      const { kept, removed } = dedupePunches(list.map((r) => ({ date: r.date, time: r.time })));
      dupRemoved += removed;
      const paired = pairPunches(kept, (date) => shiftOf(employeeId, date));
      overnightPaired += paired.overnightPaired;
      const first = list[0];
      for (const d of paired.days) {
        records.push({
          employeeId,
          date: d.date,
          checkIn: d.checkIn,
          checkOut: d.checkOut,
          serialNumber: first.serialNumber,
          rawName: first.name,
        });
      }
    }
    records.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.employeeId.localeCompare(b.employeeId)));
    return { records, dupRemoved, overnightPaired, singleResolved };
  }, [rows, dayRows, effectivePinToEmployee, employees, shiftRows, shiftAssignments]);
  const dailyRecords = processed.records;

  const sampleUnmatched = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (!effectivePinToEmployee.has(r.pin)) {
        map.set(r.pin, r.name);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(0, 20);
  }, [rows, effectivePinToEmployee]);

  // ตัวอย่างรายการที่จะผูกรหัสให้อัตโนมัติ (จับด้วยชื่อ)
  const sampleAutoLinks = useMemo(
    () => autoLinks.map((a) => ({ pin: a.pin, name: employeeName(a.employeeId) })).slice(0, 20),
    [autoLinks, employeeName]
  );

  const runImport = async () => {
    if (dailyRecords.length === 0) return;
    setProcessing(true);
    setStep("processing");
    setProgress(0);

    // เรียนรู้รหัสจากไฟล์: ผูก face_scan_id = EnNo ให้พนักงานที่จับด้วยชื่อได้
    // (ครั้งต่อไปจะจับด้วย id ตรง ๆ ไม่ต้องจับชื่ออีก) — ลงเวลาใช้ employeeId จึงลงได้แม้ขั้นนี้พลาด
    // ผูกรหัสแบบขนาน (ไม่รอทีละคน) เพื่อลดเวลารอเครือข่าย
    const linkJobs: Promise<boolean>[] = [];
    for (const a of autoLinks) {
      linkJobs.push(updateEmployee(a.employeeId, { faceScanId: a.pin }).then(() => true).catch(() => false));
    }
    // ผูกรหัสที่ HR เลือกเองในหน้า Preview — บันทึกถาวรลงโปรไฟล์พนักงาน
    for (const [pin, empId] of Object.entries(manualLinks)) {
      if (!empId) continue;
      linkJobs.push(updateEmployee(empId, { faceScanId: pin }).then(() => true).catch(() => false));
    }
    const linkResults = await Promise.all(linkJobs);
    const linked = linkResults.filter(Boolean).length;

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
        .select("id, employee_id, date, check_in, check_out")
        .in("employee_id", employeeIds)
        .in("date", dates);

      const existingMap = new Map((existingRows || []).map((x: any) => [`${x.employee_id}|${x.date}`, x]));

      // รวมเป็นก้อนแล้วเขียนทีเดียวต่อ batch (ไม่ยิงทีละแถว) เพื่อลดรอบการรอเครือข่าย
      const updatePayloads: any[] = [];
      const insertPayloads: any[] = [];
      let batchSkipped = 0;

      for (const rec of batch) {
        const key = `${rec.employeeId}|${rec.date}`;
        const existing = existingMap.get(key);
        const hasExisting = !!existing;

        // Smart Merge: เวลาเข้าเลือกเช้าสุด, เวลาออกเลือกดึกสุด, ไฟล์ไม่มีเวลาออกให้คงค่าเดิม
        let checkIn = rec.checkIn;
        let checkOut = rec.checkOut;
        if (hasExisting && overwrite) {
          const exIn = existing.check_in && existing.check_in !== "-" ? existing.check_in : null;
          const exOut = existing.check_out && existing.check_out !== "-" ? existing.check_out : null;
          if (checkIn === "-") checkIn = exIn || "-"; // กะข้ามคืนที่มีแต่สแกนออก: คงเวลาเข้าเดิม
          else if (exIn && exIn < checkIn) checkIn = exIn;
          if (checkOut === "-") checkOut = exOut || "-";
          else if (exOut && exOut > checkOut) checkOut = exOut;
        }

        const payload = {
          employee_id: rec.employeeId,
          date: rec.date,
          check_in: checkIn,
          check_out: checkOut,
          location: rec.serialNumber || "Face Scanner",
          within_radius: true,
          source: "face_scan_file",
          remark: rec.rawName,
        };

        if (hasExisting) {
          if (overwrite) updatePayloads.push({ id: existing.id, ...payload });
          else batchSkipped++;
        } else {
          insertPayloads.push(payload);
        }
      }

      const [updRes, insRes] = await Promise.all([
        updatePayloads.length
          ? supabase.from("check_in_records").upsert(updatePayloads, { onConflict: "id" })
          : Promise.resolve({ error: null }),
        insertPayloads.length
          ? supabase.from("check_in_records").insert(insertPayloads)
          : Promise.resolve({ error: null }),
      ]);
      if (updRes.error || insRes.error) {
        // ถ้าเขียนก้อนไม่ผ่าน ลองทีละแถวเพื่อกู้เท่าที่ทำได้
        for (const p of updatePayloads) {
          const { error } = await supabase.from("check_in_records").update(p).eq("id", p.id);
          if (!error) updated++; else skipped++;
        }
        for (const p of insertPayloads) {
          const { error } = await supabase.from("check_in_records").insert(p);
          if (!error) inserted++; else skipped++;
        }
      } else {
        updated += updatePayloads.length;
        inserted += insertPayloads.length;
      }
      skipped += batchSkipped;

      setProgress(Math.min(100, Math.round(((i + batch.length) / dailyRecords.length) * 100)));
    }

    // Log the import
    await supabase.from("face_scan_sync_logs").insert({
      device_id: null,
      sync_type: "file_import",
      status: "success",
      records_synced: inserted + updated,
      message: `Inserted ${inserted}, updated ${updated}, skipped ${skipped}, linked ${linked}, unmatched ${preview.unmatchedPins.length}. File: ${file?.name || "-"}.`,
      command_payload: {
        file_name: file?.name || null,
        serial_number: preview.serialNumber,
        overwrite,
        total_rows: rows.length,
        daily_records: dailyRecords.length,
      },
    });

    setResult({ inserted, updated, skipped, linked, unmatched: preview.unmatchedPins.length });
    setStep("done");
    setProcessing(false);
    onImported?.();
    toast.success(`นำเข้าเสร็จแล้ว: เพิ่ม ${inserted} / อัปเดต ${updated} / ข้าม ${skipped}${linked ? ` / ผูกรหัสใหม่ ${linked}` : ""}`);
  };

  const reset = () => {
    setFile(null);
    setRows([]);
    setDayRows([]);
    setStep("upload");
    setOverwrite(true);
    setManualLinks({});
    setProgress(0);
    setResult({ inserted: 0, updated: 0, skipped: 0, linked: 0, unmatched: 0 });
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
            อัปโหลดไฟล์ .txt ที่ export จากเครื่องสแกนหน้า (UDISKLOG) ระบบจะเทียบ EnNo กับรหัสพนักงาน และถ้ายังไม่ผูก จะจับจากชื่อในไฟล์แล้วผูกรหัสให้อัตโนมัติ
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {step === "upload" && (
            <div className="space-y-4">
              <Card className="border-dashed border-2 p-8 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <Upload className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-medium mb-1">เลือกไฟล์ .txt หรือ .xlsx</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  .txt = UDISKLOG ที่ export จากเครื่องสแกน (คั่นด้วย Tab) · .xlsx = รายงานเข้า-ออกที่มีคอลัมน์ รหัสที่เครื่อง, วันที่, เข้า, ออก
                </p>
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer"
                  style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}>
                  <FileText className="w-4 h-4" />
                  เลือกไฟล์
                  <input type="file" accept=".txt,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
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
                {processed.dupRemoved > 0 && (
                  <Badge variant="outline">กรองสแกนซ้ำ {processed.dupRemoved} ครั้ง</Badge>
                )}
                {processed.singleResolved > 0 && (
                  <Badge variant="outline">สแกนครั้งเดียว {processed.singleResolved} วัน (ตัดสินเข้า/ออกตามกะ)</Badge>
                )}
                {processed.overnightPaired > 0 && (
                  <Badge variant="outline">ผูกคู่กะข้ามเที่ยงคืน {processed.overnightPaired} วัน</Badge>
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
                  <div className="text-2xl font-bold" style={{ color: autoLinks.length > 0 ? "hsl(142 71% 40%)" : undefined }}>{autoLinks.length}</div>
                  <div className="text-xs text-muted-foreground">ผูกรหัสใหม่ (จับชื่อ)</div>
                </Card>
              </div>

              {autoLinks.length > 0 && (
                <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-400">
                      จะผูกรหัส (EnNo) ให้พนักงานอัตโนมัติจากชื่อในไฟล์ ({autoLinks.length} รหัส) — ครั้งหน้าจับด้วยรหัสได้เลย
                    </span>
                  </div>
                  <div className="max-h-32 overflow-y-auto text-xs space-y-1">
                    {sampleAutoLinks.map((a) => (
                      <div key={a.pin} className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">{a.pin}</Badge>
                        <span className="text-muted-foreground truncate">{a.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {preview.unmatchedPins.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                      รหัสต่อไปนี้ยังไม่ได้จับคู่กับพนักงาน ({preview.unmatchedPins.length} รหัส) — เลือกพนักงานเพื่อผูกรหัสได้ทันที
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto text-xs space-y-2">
                    {sampleUnmatched.map(([pin, name]) => (
                      <div key={pin} className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="font-mono shrink-0">{pin}</Badge>
                        <span className="text-muted-foreground truncate min-w-[80px]">{name || "(ไม่มีชื่อ)"}</span>
                        <div className="flex-1 min-w-[180px]">
                          <SearchableSelect
                            value={manualLinks[pin] || ""}
                            onChange={(v) =>
                              setManualLinks((prev) => {
                                const next = { ...prev };
                                if (v) next[pin] = v;
                                else delete next[pin];
                                return next;
                              })
                            }
                            options={linkableEmployeeOptions}
                            placeholder="เลือกพนักงานเพื่อผูกรหัส..."
                            allowClear
                          />
                        </div>
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
                  เขียนทับข้อมูลที่มีอยู่แล้วในวันเดียวกัน (รวมเวลาอัตโนมัติ: เข้าเช้าสุด / ออกดึกสุด)
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
              {result.linked > 0 && (
                <div className="text-xs text-green-600 flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  ผูกรหัส (EnNo) ให้พนักงานใหม่ {result.linked} คน จากการจับชื่อ
                </div>
              )}
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
