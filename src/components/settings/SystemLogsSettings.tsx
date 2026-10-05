import { Fragment, useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useAuth } from "@/contexts/AuthContext";
import PaginationBar from "@/components/ui/pagination-bar";
import { RefreshCw, Search, AlertTriangle, Info, XCircle, Trash2, ChevronDown } from "lucide-react";
import { toast } from "sonner";

interface LogRow {
  id: string;
  created_at: string;
  level: "error" | "warning" | "info" | string;
  category: string;
  message: string;
  details: any;
  source: string | null;
  user_email: string | null;
  url: string | null;
}

const PAGE_SIZE = 20;

const levelConf: Record<string, { label: string; cls: string; icon: any }> = {
  error: { label: "Error", cls: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400", icon: XCircle },
  warning: { label: "Warning", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400", icon: AlertTriangle },
  info: { label: "Info", cls: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400", icon: Info },
};

const fmtDateTime = (s: string) => {
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const be = d.getFullYear() + 543;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${be} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const SystemLogsSettings = () => {
  const { role } = useAuth();
  const { canAction } = usePermissions();
  const canDelete = canAction(role, "settings_logs", "delete");

  const [rows, setRows] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [level, setLevel] = useState("all");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [categories, setCategories] = useState<string[]>([]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let q = (supabase as any)
        .from("system_logs")
        .select("id, created_at, level, category, message, details, source, user_email, url", { count: "exact" })
        .order("created_at", { ascending: false });

      if (level !== "all") q = q.eq("level", level);
      if (category !== "all") q = q.eq("category", category);
      if (search.trim()) q = q.ilike("message", `%${search.trim()}%`);
      if (fromDate) q = q.gte("created_at", `${fromDate}T00:00:00`);
      if (toDate) q = q.lte("created_at", `${toDate}T23:59:59`);

      const start = (page - 1) * PAGE_SIZE;
      q = q.range(start, start + PAGE_SIZE - 1);

      const { data, error: e, count } = await q;
      if (e) throw e;
      setRows((data as LogRow[]) || []);
      setTotal(count || 0);
    } catch (e: any) {
      setError(e?.message || "โหลดบันทึกเหตุการณ์ไม่สำเร็จ");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [level, category, search, fromDate, toDate, page]);

  // Load the distinct categories once (for the filter dropdown).
  const loadCategories = useCallback(async () => {
    try {
      const { data } = await (supabase as any)
        .from("system_logs")
        .select("category")
        .order("created_at", { ascending: false })
        .limit(1000);
      const set = Array.from(new Set((data || []).map((r: any) => String(r.category)).filter(Boolean))).sort() as string[];
      setCategories(set);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { loadCategories(); }, [loadCategories]);
  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [level, category, search, fromDate, toDate]);

  const handleClearOld = async () => {
    if (!confirm("ลบบันทึกที่เก่ากว่า 90 วันทั้งหมด? (ย้อนกลับไม่ได้)")) return;
    try {
      const cutoff = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
      const { error: e } = await (supabase as any).from("system_logs").delete().lt("created_at", cutoff);
      if (e) throw e;
      toast.success("ลบบันทึกเก่าแล้ว");
      fetchLogs();
    } catch (e: any) {
      toast.error("ลบไม่สำเร็จ: " + (e?.message || ""));
    }
  };

  const notReady = error && /relation|does not exist|schema cache|not find the table/i.test(error);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold font-display">บันทึกเหตุการณ์ระบบ</h3>
          <p className="text-sm text-muted-foreground mt-0.5">เก็บ error / การทำงานล้มเหลว และเหตุการณ์ต่าง ๆ ในระบบ</p>
        </div>
        <div className="flex items-center gap-2">
          {canDelete && !notReady && (
            <button onClick={handleClearOld} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm text-destructive hover:bg-destructive/10 transition-colors">
              <Trash2 className="w-4 h-4" /> ลบที่เก่ากว่า 90 วัน
            </button>
          )}
          <button onClick={fetchLogs} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm hover:bg-muted transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> รีเฟรช
          </button>
        </div>
      </div>

      {notReady ? (
        <div className="card-base p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">ยังไม่ได้สร้างตารางเก็บบันทึก (system_logs)</p>
          <p>กรุณารัน SQL สร้างตาราง <code className="px-1 rounded bg-muted">system_logs</code> ใน Supabase ก่อน แล้วระบบจะเริ่มเก็บบันทึกอัตโนมัติ</p>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="card-base p-4 flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input type="text" placeholder="ค้นหาข้อความ..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border bg-muted/30 outline-none" />
            </div>
            <select value={level} onChange={(e) => setLevel(e.target.value)} className="min-w-[120px] px-3 py-2 text-sm rounded-xl border bg-muted/30 outline-none cursor-pointer">
              <option value="all">ทุกระดับ</option>
              <option value="error">Error</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="min-w-[130px] px-3 py-2 text-sm rounded-xl border bg-muted/30 outline-none cursor-pointer">
              <option value="all">ทุกประเภท</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} title="ตั้งแต่วันที่" className="px-3 py-2 text-sm rounded-xl border bg-muted/30 outline-none cursor-pointer" />
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} title="ถึงวันที่" className="px-3 py-2 text-sm rounded-xl border bg-muted/30 outline-none cursor-pointer" />
          </div>

          <div className="card-base overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: "hsl(var(--border))" }}>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">เวลา</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase">ระดับ</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase">ประเภท</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase">ข้อความ</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">ผู้ใช้</th>
                    <th className="px-2 py-3 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading && rows.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">กำลังโหลด...</td></tr>
                  )}
                  {!loading && rows.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">ไม่พบบันทึกตามเงื่อนไข</td></tr>
                  )}
                  {rows.map((r) => {
                    const lc = levelConf[r.level] || { label: r.level, cls: "bg-muted text-muted-foreground", icon: Info };
                    const LIcon = lc.icon;
                    const isOpen = expanded === r.id;
                    const hasDetails = r.details != null || r.source || r.url;
                    return (
                      <Fragment key={r.id}>
                        <tr className="border-b hover:bg-muted/30 transition-colors align-top" style={{ borderColor: "hsl(var(--border))" }}>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap tabular-nums">{fmtDateTime(r.created_at)}</td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${lc.cls}`}>
                              <LIcon className="w-3 h-3" /> {lc.label}
                            </span>
                          </td>
                          <td className="px-3 py-2.5"><span className="text-xs px-2 py-0.5 rounded-lg bg-muted">{r.category}</span></td>
                          <td className="px-3 py-2.5 max-w-[420px]"><p className="break-words">{r.message}</p></td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{r.user_email || "-"}</td>
                          <td className="px-2 py-2.5 text-center">
                            {hasDetails && (
                              <button onClick={() => setExpanded(isOpen ? null : r.id)} className="p-1 rounded hover:bg-muted text-muted-foreground" title="รายละเอียด">
                                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                              </button>
                            )}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-muted/20" style={{ borderColor: "hsl(var(--border))" }}>
                            <td colSpan={6} className="px-4 py-3">
                              <div className="text-xs space-y-1">
                                {r.source && <div><span className="text-muted-foreground">ที่มา:</span> {r.source}</div>}
                                {r.url && <div><span className="text-muted-foreground">หน้า:</span> {r.url}</div>}
                                {r.details != null && (
                                  <pre className="mt-1 p-2 rounded-lg bg-background border overflow-x-auto whitespace-pre-wrap break-words max-h-64">{typeof r.details === "string" ? r.details : JSON.stringify(r.details, null, 2)}</pre>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {total > 0 && (
              <div className="px-4 py-3 border-t" style={{ borderColor: "hsl(var(--border))" }}>
                <PaginationBar page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default SystemLogsSettings;
