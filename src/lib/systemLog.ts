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

let lastSig = "";
let lastTs = 0;

const trunc = (s: unknown, n: number) => (s == null ? "" : String(s)).slice(0, n);

// Events are written one-at-a-time through a queue (not concurrently), so that
// capturing *every* event never drops one the way the old re-entrancy guard did,
// and a burst of events can't fire many overlapping inserts.
interface QueuedLog { level: LogLevel; category: string; message: string; details: unknown; source?: string; }
const queue: QueuedLog[] = [];
let draining = false;
const MAX_QUEUE = 300; // hard cap so a runaway loop can't grow memory unbounded

export async function logEvent(input: LogInput): Promise<void> {
  const message = trunc(input.message, 2000);
  if (!message) return;
  const level = input.level || "error";
  const category = input.category || "general";

  // De-dupe identical back-to-back events (e.g. an error firing in a render loop,
  // or a double navigation). Keyed on the exact text, so distinct actions — which
  // carry names/ids — are never collapsed.
  const sig = `${level}|${category}|${message}`;
  const now = Date.now();
  if (sig === lastSig && now - lastTs < 1500) return;
  lastSig = sig;
  lastTs = now;

  if (queue.length >= MAX_QUEUE) return; // backpressure: drop the overflow
  queue.push({ level, category, message, details: input.details, source: input.source });
  void drainQueue();
}

async function drainQueue(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    while (queue.length) {
      const item = queue.shift()!;
      await writeOne(item);
    }
  } finally {
    draining = false;
  }
}

async function writeOne(item: QueuedLog): Promise<void> {
  try {
    let userId: string | null = null;
    let userEmail: string | null = null;
    try {
      const { data } = await supabase.auth.getSession();
      userId = data?.session?.user?.id ?? null;
      userEmail = data?.session?.user?.email ?? null;
    } catch { /* ignore */ }

    let details: any = item.details;
    if (details instanceof Error) {
      details = { name: details.name, message: details.message, stack: trunc(details.stack, 4000) };
    }
    try {
      details = details === undefined ? null : JSON.parse(JSON.stringify(details));
    } catch {
      details = { note: "unserializable", value: trunc(details, 1000) };
    }

    await (supabase as any).from("system_logs").insert({
      level: item.level,
      category: item.category,
      message: item.message,
      details,
      source: item.source || "frontend",
      user_id: userId,
      user_email: userEmail,
      url: typeof location !== "undefined" ? location.pathname + location.search : null,
      user_agent: typeof navigator !== "undefined" ? trunc(navigator.userAgent, 300) : null,
    });
  } catch {
    // Logging must never surface an error of its own.
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

  // Capture console.error AND console.warn — the app logs most caught failures
  // through console.error, and warnings are events worth keeping too.
  const patchConsole = (method: "error" | "warn", level: LogLevel) => {
    const orig = (console[method] as (...a: any[]) => void).bind(console);
    console[method] = (...args: any[]) => {
      try {
        const msg = args
          .map((a) =>
            a instanceof Error ? a.message : typeof a === "string" ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })(),
          )
          .join(" ");
        // never log our own insert failures (avoid recursion/noise)
        if (msg && !/system_logs/i.test(msg)) {
          void logEvent({ level, category: "console", message: msg, source: `console.${method}` });
        }
      } catch { /* ignore */ }
      orig(...args);
    };
  };
  patchConsole("error", "error");
  patchConsole("warn", "warning");
}

/**
 * Convenience for recording a normal (non-error) event — a successful action,
 * a login, a navigation, etc. Fire-and-forget; never throws.
 *
 * Example: logInfo("leave", "ยื่นคำขอลา", { employee, type, days })
 */
export function logInfo(category: string, message: string, details?: unknown): void {
  void logEvent({ level: "info", category, message, details });
}

/** Record an event at an explicit level (error | warning | info). */
export function logAction(level: LogLevel, category: string, message: string, details?: unknown): void {
  void logEvent({ level, category, message, details });
}

/**
 * Write one event and AWAIT its insert — for critical audit events that are
 * immediately followed by a page reload/navigation (login-as, logout), where a
 * fire-and-forget insert would be cut off by the reload. Never throws.
 */
export async function logEventSync(input: LogInput): Promise<void> {
  const message = trunc(input.message, 2000);
  if (!message) return;
  await writeOne({
    level: input.level || "info",
    category: input.category || "general",
    message,
    details: input.details,
    source: input.source,
  });
}
