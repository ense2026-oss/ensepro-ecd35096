// Shared React Query cache for reference tables that several pages all need
// (shifts, shift assignments, day-off patterns/overrides, company holidays).
//
// Before this, ShiftManagement / OvertimeManagement / DayOff / Dashboard each
// fetched the same tables under their own page-level query key, so navigating
// between those pages re-paid 3-5 full network round trips every time. With
// high per-request backend latency that stacked up to several seconds.
//
// These helpers go through queryClient.fetchQuery with one stable key per
// table: the first page to need a table fetches it, every other page reuses
// the cached result instantly, and realtime handlers invalidate the "shared"
// prefix to refresh all of them at once.

import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_MS = 5 * 60_000;

export const SHARED_KEY_PREFIX = ["shared"] as const;

const sharedKeys = {
  holidays: [...SHARED_KEY_PREFIX, "company-holidays"],
  dayoffPatterns: [...SHARED_KEY_PREFIX, "dayoff-patterns"],
  dayoffOverrides: [...SHARED_KEY_PREFIX, "dayoff-overrides"],
  shifts: [...SHARED_KEY_PREFIX, "shifts"],
  shiftAssignments: [...SHARED_KEY_PREFIX, "shift-assignments"],
} as const;

async function run<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message || "โหลดข้อมูลไม่สำเร็จ");
  return (data ?? ([] as unknown)) as T;
}

export const fetchCompanyHolidays = <T = any[]>(qc: QueryClient) =>
  qc.fetchQuery({
    queryKey: sharedKeys.holidays,
    staleTime: STALE_MS,
    queryFn: () => run<T>(supabase.from("company_holidays").select("*")),
  });

export const fetchDayoffPatterns = <T = any[]>(qc: QueryClient) =>
  qc.fetchQuery({
    queryKey: sharedKeys.dayoffPatterns,
    staleTime: STALE_MS,
    queryFn: () => run<T>(supabase.from("employee_dayoff_patterns").select("*")),
  });

export const fetchDayoffOverrides = <T = any[]>(qc: QueryClient) =>
  qc.fetchQuery({
    queryKey: sharedKeys.dayoffOverrides,
    staleTime: STALE_MS,
    queryFn: () => run<T>(supabase.from("employee_dayoff_overrides").select("*")),
  });

export const fetchShifts = <T = any[]>(qc: QueryClient) =>
  qc.fetchQuery({
    queryKey: sharedKeys.shifts,
    staleTime: STALE_MS,
    queryFn: () => run<T>(supabase.from("shifts").select("*").order("sort_order")),
  });

export const fetchShiftAssignments = <T = any[]>(qc: QueryClient) =>
  qc.fetchQuery({
    queryKey: sharedKeys.shiftAssignments,
    staleTime: STALE_MS,
    queryFn: () => run<T>(supabase.from("shift_assignments").select("*").order("created_at", { ascending: false })),
  });
