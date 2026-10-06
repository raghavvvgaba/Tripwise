import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

import { createGroup, deleteSharedGroup, restoreSharedGroup, updateGroupCover } from "@/lib/groups";
import { groupDataKey } from "@/lib/group-data-query";
import { groupsQueryOptions } from "@/lib/groups-query";
import { refreshActivity } from "@/lib/refresh-activity";
import { useAuthStore } from "@/store/use-auth-store";
import type { CurrencyCode } from "@/types/models";
import type { SharedGroup } from "@/types/shared-group";

const emptyGroups: SharedGroup[] = [];

export function useSharedGroups() {
  const userId = useAuthStore((state) => state.session?.user.id ?? null);
  const client = useQueryClient();
  const query = useQuery(groupsQueryOptions(userId));

  const loadGroups = useCallback(async (force = false) => {
    if (!userId || useAuthStore.getState().session?.user.id !== userId) throw new Error("Sign in required");
    const options = groupsQueryOptions(userId);
    // Forced reads after joining must not reuse a request started before joining.
    if (force) await client.cancelQueries({ queryKey: options.queryKey });
    if (useAuthStore.getState().session?.user.id !== userId) throw new Error("Sign in required");
    return client.fetchQuery({ ...options, staleTime: force ? 0 : options.staleTime });
  }, [client, userId]);

  useFocusEffect(useCallback(() => {
    // fetchQuery shares in-flight requests and skips the network for fresh data.
    if (userId) void loadGroups().catch(() => undefined);
  }, [loadGroups, userId]));

  return {
    groups: query.data ?? emptyGroups,
    userId,
    isLoading: !!userId && query.isPending,
    isRefreshing: query.isFetching && !query.isPending,
    error: query.data === undefined ? query.error?.message ?? null : null,
    refreshError: query.data !== undefined ? query.error?.message ?? null : null,
    loadGroups,
  };
}

export function useGroupActions() {
  const userId = useAuthStore((state) => state.session?.user.id ?? null);
  const client = useQueryClient();
  const queryKey = groupsQueryOptions(userId).queryKey;

  function requireUser() {
    if (!userId || useAuthStore.getState().session?.user.id !== userId) {
      throw new Error("Sign in required");
    }
  }

  async function updateCache(update: (groups: SharedGroup[]) => SharedGroup[]) {
    // Ignore late mutation results if the account changed while saving.
    if (!userId || useAuthStore.getState().session?.user.id !== userId) return;
    await client.cancelQueries({ queryKey });
    if (useAuthStore.getState().session?.user.id !== userId) return;
    client.setQueryData<SharedGroup[]>(queryKey, (groups) => groups ? update(groups) : undefined);
    await Promise.all([client.invalidateQueries({ queryKey }), refreshActivity(client, userId)]);
  }

  const create = useMutation({
    mutationFn: ({ name, currency }: { name: string; currency: CurrencyCode }) => {
      requireUser();
      return createGroup(name, currency);
    },
    onSuccess: (group) => updateCache((groups) => [group, ...groups.filter((item) => item.id !== group.id)]),
  });
  const remove = useMutation({
    mutationFn: (groupId: string) => {
      requireUser();
      return deleteSharedGroup(groupId);
    },
    onSuccess: (deletedAt, groupId) => updateCache((groups) => groups.map((group) =>
      group.id === groupId ? { ...group, deletedAt } : group)),
  });
  const restore = useMutation({
    mutationFn: (groupId: string) => {
      requireUser();
      return restoreSharedGroup(groupId);
    },
    onSuccess: async (_, groupId) => {
      await updateCache((groups) => groups.map((group) => group.id === groupId ? { ...group, deletedAt: null } : group));
      if (userId && useAuthStore.getState().session?.user.id === userId) {
        await client.invalidateQueries({ queryKey: groupDataKey(userId, groupId) });
      }
    },
  });
  const cover = useMutation({
    mutationFn: ({ groupId, coverPath, coverThumbnailPath }: {
      groupId: string; coverPath: string | null; coverThumbnailPath: string | null;
    }) => {
      requireUser();
      return updateGroupCover(groupId, coverPath, coverThumbnailPath);
    },
    onSuccess: (_, { groupId, coverPath, coverThumbnailPath }) => updateCache((groups) => groups.map((group) =>
      group.id === groupId ? { ...group, coverPath, coverThumbnailPath } : group)),
  });

  return {
    createGroup: (name: string, currency: CurrencyCode) => create.mutateAsync({ name, currency }),
    deleteGroup: remove.mutateAsync,
    restoreGroup: restore.mutateAsync,
    setCover: (groupId: string, coverPath: string | null, coverThumbnailPath: string | null) =>
      cover.mutateAsync({ groupId, coverPath, coverThumbnailPath }),
  };
}
