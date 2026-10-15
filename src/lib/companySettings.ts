// Shared cache for company_settings reads.
//
// Many contexts/hooks (branding, module settings, field options, payroll config,
// locations, ...) each used to fire their own SELECT per key on every page load.
// With high per-request backend latency that stacked up to several seconds.
// This module dedupes concurrent fetches (single-flight) and caches results
// for a short TTL, so a page load costs at most one request per key.

import { supabase } from "@/integrations/supabase/client";

const TTL_MS = 60_000;

const cache = new Map<string, { value: unknown; ts: number }>();
const inflight = new Map<string, Promise<unknown>>();

export async function getCompanySetting<T = unknown>(key: string): Promise<T | null> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.value as T | null;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T | null>;

  const promise = (async () => {
    try {
      const { data, error } = await supabase
        .from("company_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (error) return (cache.get(key)?.value ?? null) as T | null;
      const value = (data?.value ?? null) as T | null;
      cache.set(key, { value, ts: Date.now() });
      return value;
    } catch {
      return (cache.get(key)?.value ?? null) as T | null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise as Promise<T | null>;
}

/** Update the cache after a successful write so readers don't refetch. */
export function setCompanySettingCache(key: string, value: unknown): void {
  cache.set(key, { value, ts: Date.now() });
}

/** Force the next read to hit the database. */
export function invalidateCompanySetting(key: string): void {
  cache.delete(key);
}
