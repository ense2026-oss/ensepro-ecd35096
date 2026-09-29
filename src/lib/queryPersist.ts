import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";

// Persists the React Query cache so page data survives a full reload (F5): the
// app renders from the saved snapshot immediately and refetches in the
// background only if the data is stale. Stored in IndexedDB, not localStorage —
// a snapshot with every attendance/leave row is already several MB and grows
// monthly, which would blow localStorage's ~5 MB quota.

export const QUERY_CACHE_KEY = "ensepro-query-cache";
const OWNER_KEY = "ensepro-query-cache-owner";
// Bump when the shape of any cached query payload changes incompatibly.
export const QUERY_CACHE_VERSION = "2026-09-29.2";
export const QUERY_CACHE_MAX_AGE = 30 * 60_000;

// An earlier build kept the snapshot in localStorage under the same key; drop
// that multi-MB leftover so it doesn't sit in the quota forever.
try {
  localStorage.removeItem(QUERY_CACHE_KEY);
} catch {}

// Supabase keeps the session under sb-<ref>-auth-token; read the user id from
// it synchronously so the check needs no React context.
function currentAuthUserId(): string | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !/^sb-.*-auth-token$/.test(k)) continue;
      const raw = localStorage.getItem(k);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.user?.id ?? parsed?.currentSession?.user?.id ?? null;
    }
  } catch {}
  return null;
}

const readOwner = () => {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
};
const writeOwner = (uid: string | null) => {
  try {
    if (uid) localStorage.setItem(OWNER_KEY, uid);
    else localStorage.removeItem(OWNER_KEY);
  } catch {}
};

export async function clearPersistedQueryCache() {
  writeOwner(null);
  try {
    await idbDel(QUERY_CACHE_KEY);
  } catch {}
}

// The snapshot must never be shown to a different account: after a logout, a
// fresh login, or a "Login as" switch (all of which reload the page) the owner
// check happens inside the read itself, so a foreign snapshot is discarded
// before the client can restore it — no race with an async delete.
export const queryPersister = createAsyncStoragePersister({
  key: QUERY_CACHE_KEY,
  throttleTime: 1000,
  storage: {
    getItem: async (key) => {
      const uid = currentAuthUserId();
      if (!uid || readOwner() !== uid) {
        await clearPersistedQueryCache();
        writeOwner(uid);
        return null;
      }
      return (await idbGet<string>(key)) ?? null;
    },
    setItem: async (key, value) => {
      writeOwner(currentAuthUserId());
      await idbSet(key, value);
    },
    removeItem: async (key) => {
      await idbDel(key);
    },
  },
});
