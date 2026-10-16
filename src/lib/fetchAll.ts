/**
 * Fetch EVERY row of a Supabase query, paging past PostgREST's ~1000-row cap.
 *
 * A plain `.select()` returns at most ~1000 rows in one response. For tables
 * that grow one row per employee per day (attendance, check-ins) or per request
 * (leave/OT), that cap is hit quickly, and with an `order()` the rows past the
 * cap are silently dropped — e.g. the earliest days of a month vanish and show
 * as "absent". Pass a factory that applies `.range(from, to)` to the query so
 * the ordering/filters repeat on every page; the chunks are concatenated.
 *
 * Throws on the first page error (so React Query / withRetry can retry).
 */
export async function fetchAllRows<T = any>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);
    if (error) throw new Error(error.message || "โหลดข้อมูลไม่สำเร็จ");
    const chunk = data || [];
    all.push(...(chunk as T[]));
    if (chunk.length < pageSize) break;
  }
  return all;
}
