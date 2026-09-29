// Retry a Supabase call that resolves to { data, error } (PostgREST never rejects;
// a 504 "upstream request timeout" comes back as `error`). Used by the context
// providers that load once on login without React Query, so a transient timeout
// no longer leaves the whole app without employees/permissions/org data.
export async function withRetry<T extends { error: { message?: string } | null }>(
  run: () => PromiseLike<T>,
  { retries = 3, baseDelayMs = 800 }: { retries?: number; baseDelayMs?: number } = {},
): Promise<T> {
  let last: T | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    last = await run();
    if (!last.error) return last;
    if (attempt < retries) await new Promise((r) => setTimeout(r, Math.min(baseDelayMs * 2 ** attempt, 8000)));
  }
  return last as T;
}
