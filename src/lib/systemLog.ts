// Lightweight system event / error logger.
//
// logEvent(...) writes one row to public.system_logs (fire-and-forget; it never
// throws and never breaks the app). installGlobalErrorLogging() hooks the global
// error channels so uncaught errors, unhandled promise rejections and
// console.error calls are captured automatically. Explicit failures can also be
// logged from catch blocks with logEvent({...}).
//
// If the system_logs table does not exist yet, inserts simply fail silently —
// the feature activates the moment the table is created.

import { supabase } from "@/integrations/supabase/client";

export type LogLevel = "error" | "warning" | "info";

export interface LogInput {
  level?: LogLevel;
  category?: string; // ui | auth | network | console | payroll | import | login_as | ...
  message: string;
  details?: unknown;
  source?: string;
}

let inLog = false;          // re-entrancy guard (never log while logging)
let lastSig = "";
let lastTs = 0;

const trunc = (s: unknown, n: number) => (s == null ? "" : String(s)).slice(0, n);

export async function logEvent(input: LogInput): Promise<void> {
  if (inLog) return;
  const message = trunc(input.message, 2000);
  if (!message) return;
  const level = input.level || "error";
  const category = input.category || "general";

  // De-dupe identical bursts (e.g. an error firing in a render loop).
  const sig = `${level}|${category}|${message}`;
  const now = Date.now();
  if (sig === lastSig && now - lastTs < 3000) return;
  lastSig = sig;
  lastTs = now;

  inLog = true;
  try {
    let userId: string | null = null;
    let userEmail: string | null = null;
    try {
      const { data } = await supabase.auth.getSession();
      userId = data?.session?.user?.id ?? null;
      userEmail = data?.session?.user?.email ?? null;
    } catch { /* ignore */ }

    let details: any = input.details;
    if (details instanceof Error) {
      details = { name: details.name, message: details.message, stack: trunc(details.stack, 4000) };
    }
    try {
      details = details === undefined ? null : JSON.parse(JSON.stringify(details));
    } catch {
      details = { note: "unserializable", value: trunc(details, 1000) };
    }

    await (supabase as any).from("system_logs").insert({
      level,
      category,
      message,
      details,
      source: input.source || "frontend",
      user_id: userId,
      user_email: userEmail,
      url: typeof location !== "undefined" ? location.pathname + location.search : null,
      user_agent: typeof navigator !== "undefined" ? trunc(navigator.userAgent, 300) : null,
    });
  } catch {
    // Logging must never surface an error of its own.
  } finally {
    inLog = false;
  }
}

let installed = false;

export function installGlobalErrorLogging(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (e) => {
    void logEvent({
      level: "error",
      category: "ui",
      message: e.message || "Uncaught error",
      details: { filename: e.filename, lineno: e.lineno, colno: e.colno, stack: trunc((e.error as any)?.stack, 4000) },
      source: "window.onerror",
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    const r: any = e.reason;
    void logEvent({
      level: "error",
      category: "ui",
      message: trunc(r?.message || r, 2000) || "Unhandled promise rejection",
      details: r instanceof Error ? { stack: trunc(r.stack, 4000) } : r,
      source: "unhandledrejection",
    });
  });

  // Capture console.error too — the app logs most caught failures through it.
  const orig = console.error.bind(console);
  console.error = (...args: any[]) => {
    try {
      const msg = args
        .map((a) =>
          a instanceof Error ? a.message : typeof a === "string" ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })(),
        )
        .join(" ");
      // never log our own insert failures (avoid recursion/noise)
      if (msg && !/system_logs/i.test(msg)) {
        void logEvent({ level: "error", category: "console", message: msg, source: "console.error" });
      }
    } catch { /* ignore */ }
    orig(...args);
  };
}
