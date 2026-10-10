import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { DehydrateOptions, Query } from "@tanstack/react-query";
import type { PersistedClient } from "@tanstack/react-query-persist-client";

import { GROUPS_CACHE_MAX_AGE } from "@/lib/query-client";

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

export function createGroupsPersistence(userId: string, storage: CacheStorage, isCurrentAccount: () => boolean) {
  const key = `tripwise:query-cache:v1:${userId}`;
  let removed = false;
  const canUseCache = () => !removed && isCurrentAccount();
  const isGroupsKey = (queryKey: readonly unknown[]) =>
    queryKey.length === 2 && queryKey[0] === "groups" && queryKey[1] === userId;
  const isUnexpired = (updatedAt: number) =>
    Number.isFinite(updatedAt) && updatedAt > 0 && Date.now() - updatedAt <= GROUPS_CACHE_MAX_AGE;
  const dehydrateOptions: DehydrateOptions = {
    shouldDehydrateMutation: () => false,
    // A failed background refresh still has the last successful result.
    shouldDehydrateQuery: (query: Query) => isGroupsKey(query.queryKey) &&
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
        throw new Error("Invalid saved groups cache");
      }
      return { ...snapshot, clientState: { mutations: [], queries: snapshot.clientState.queries.filter((query) =>
        Array.isArray(query.queryKey) && isGroupsKey(query.queryKey) &&
        Array.isArray(query.state?.data) && isUnexpired(query.state.dataUpdatedAt)
      ) } };
    },
  });

  return {
    persistOptions: { persister, maxAge: GROUPS_CACHE_MAX_AGE, buster: "groups-v1", dehydrateOptions },
    remove: () => {
      removed = true; // Also blocks saves still waiting in the adapter's throttle.
      return inOrder(key, () => storage.removeItem(key));
    },
  };
}
