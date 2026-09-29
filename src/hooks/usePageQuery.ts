import { useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { beginLoad, endLoad } from "@/lib/loadProgress";

// Page-level data loading on top of React Query, shaped to fit the existing
// pages with minimal change: a page keeps its own useState fields and just
// hands us (1) a loader that returns everything it needs and (2) an `apply`
// that writes that payload into its states.
//
// What this buys every page that adopts it:
//  - Revisiting a page renders instantly from cache (no spinner, no blank
//    flash) and refetches in the background only when the data is stale, so
//    only new data is applied.
//  - Failed loads (Supabase 504 "upstream request timeout" under burst load)
//    are retried automatically with backoff before the page ever shows an
//    error, instead of failing on the first attempt.
//  - Realtime handlers and mutations call `refetch()` (a cache invalidation)
//    instead of re-running the whole load with a loading flash.
export function usePageQuery<T>(
  queryKey: QueryKey,
  loader: () => Promise<T>,
  apply: (data: T) => void,
  options?: { enabled?: boolean },
) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey,
    queryFn: loader,
    enabled: options?.enabled ?? true,
    // Keep showing the last payload while a refetch (or key change) is in flight.
    placeholderData: (prev) => prev,
  });

  // Latest `apply` without re-subscribing the effect on every render.
  const applyRef = useRef(apply);
  applyRef.current = apply;
  useEffect(() => {
    if (query.data !== undefined) applyRef.current(query.data);
  }, [query.data]);

  // Report only the initial (uncached) load to the global preloader; cached
  // revisits and background refetches stay silent.
  const initialLoading = query.isPending && query.data === undefined;
  useEffect(() => {
    if (!initialLoading) return;
    beginLoad();
    return () => endLoad();
  }, [initialLoading]);

  const refetch = useCallback(
    // Accepts (and ignores) the old `showLoading` boolean so existing call sites compile unchanged.
    (_showLoading?: boolean) => queryClient.invalidateQueries({ queryKey }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, JSON.stringify(queryKey)],
  );

  return {
    // true only when there is nothing cached yet — a revisit never shows the spinner
    loading: query.isPending && query.data === undefined,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
  };
}

// Unwraps a batch of Supabase results, throwing the first error so React Query
// treats the load as failed and retries it — instead of silently applying
// empty arrays the way the old `setX(res.data || [])` pattern did on a 504.
export function unwrapAll<const R extends readonly { data: unknown; error: { message: string } | null }[]>(
  results: R,
): { [K in keyof R]: NonNullable<R[K]["data"]> } {
  for (const r of results) {
    if (r.error) throw new Error(r.error.message || "โหลดข้อมูลไม่สำเร็จ");
  }
  return results.map((r) => r.data ?? ([] as unknown)) as { [K in keyof R]: NonNullable<R[K]["data"]> };
}
