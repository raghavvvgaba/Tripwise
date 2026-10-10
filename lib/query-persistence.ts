import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { DehydrateOptions, Query } from "@tanstack/react-query";
import type { PersistedClient } from "@tanstack/react-query-persist-client";

import { OFFLINE_CACHE_MAX_AGE } from "@/lib/query-client";

export type CacheStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

// Serialize storage operations so a pending save cannot undo logout's removal.
const pendingStorage = new Map<string, Promise<void>>();
function inOrder<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const result = (pendingStorage.get(key) ?? Promise.resolve()).then(operation);
  const settled = result.then(() => undefined, () => undefined);
  pendingStorage.set(key, settled);
  void settled.then(() => {
    if (pendingStorage.get(key) === settled) pendingStorage.delete(key);
  });
  return result;
}

export function createQueryPersistence(userId: string, storage: CacheStorage, isCurrentAccount: () => boolean) {
  const key = `tripwise:query-cache:v1:${userId}`;
  let removed = false;
  const canUseCache = () => !removed && isCurrentAccount();
  // Persist lists only; expense details reuse the saved expense list.
  const isPersistedKey = (queryKey: readonly unknown[]) => {
    if (queryKey[1] !== userId) return false;
    if (queryKey[0] === "groups") return queryKey.length === 2;
    return queryKey[0] === "group-data" && queryKey.length === 4 &&
      typeof queryKey[2] === "string" && queryKey[2].length > 0 &&
      (queryKey[3] === "members" || queryKey[3] === "expenses" || queryKey[3] === "payments");
  };
  const isUnexpired = (updatedAt: number) =>
    Number.isFinite(updatedAt) && updatedAt > 0 && Date.now() - updatedAt <= OFFLINE_CACHE_MAX_AGE;
  const dehydrateOptions: DehydrateOptions = {
    shouldDehydrateMutation: () => false,
    // A failed background refresh still has the last successful result.
    shouldDehydrateQuery: (query: Query) => isPersistedKey(query.queryKey) &&
      query.state.data !== undefined && isUnexpired(query.state.dataUpdatedAt),
  };
  const persister = createAsyncStoragePersister({
    key,
    storage: {
      getItem: (cacheKey) => inOrder(cacheKey, async () => {
        if (!canUseCache()) return null;
        const value = await storage.getItem(cacheKey);
        return canUseCache() ? value : null;
      }),
      setItem: (cacheKey, value) => inOrder(cacheKey, async () => {
        if (canUseCache()) await storage.setItem(cacheKey, value);
      }),
      removeItem: (cacheKey) => inOrder(cacheKey, async () => {
        if (canUseCache()) await storage.removeItem(cacheKey);
      }),
    },
    serialize: (snapshot) => JSON.stringify({
      ...snapshot,
      clientState: { ...snapshot.clientState, mutations: [], queries: snapshot.clientState.queries.map((query) => ({
        ...query,
        state: { ...query.state, status: "success", error: null, fetchFailureCount: 0, fetchFailureReason: null },
      })) },
    }),
    deserialize: (value) => {
      const snapshot: PersistedClient = JSON.parse(value);
      if (!snapshot || !Number.isFinite(snapshot.timestamp) || !Array.isArray(snapshot.clientState?.queries)) {
        throw new Error("Invalid saved query cache");
      }
      return { ...snapshot, clientState: { mutations: [], queries: snapshot.clientState.queries.filter((query) =>
        Array.isArray(query.queryKey) && isPersistedKey(query.queryKey) &&
        Array.isArray(query.state?.data) && isUnexpired(query.state.dataUpdatedAt)
      ) } };
    },
  });

  return {
    // Keep the Phase 1 storage version so existing saved groups still restore.
    persistOptions: { persister, maxAge: OFFLINE_CACHE_MAX_AGE, buster: "groups-v1", dehydrateOptions },
    remove: () => {
      removed = true; // Also blocks saves still waiting in the adapter's throttle.
      return inOrder(key, () => storage.removeItem(key));
    },
  };
}
