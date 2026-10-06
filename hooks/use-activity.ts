import { useInfiniteQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

import { activityQueryKey, activityQueryOptions } from "@/lib/activity-query";
import { membersQueryOptions } from "@/lib/group-data-query";
import { useAuthStore } from "@/store/use-auth-store";
import { useSharedGroups } from "@/hooks/use-shared-groups";

export function useActivity() {
  const userId = useAuthStore((state) => state.session?.user.id ?? null);
  const client = useQueryClient();
  const groups = useSharedGroups();
  const query = useInfiniteQuery(activityQueryOptions(userId));
  // Offset pages can overlap if another member adds an event while loading more.
  const events = [...new Map(
    query.data?.pages.flatMap((page) => page.events).map((event) => [event.id, event])
  ).values()];
  const groupIds = [...new Set(events.filter((event) =>
    event.actorId !== userId || event.eventType === "payment_recorded" || event.eventType === "payment_deleted"
  ).map((event) => event.groupId))];
  const memberQueries = useQueries({ queries: groupIds.map((groupId) => membersQueryOptions(userId, groupId)) });
  const names = new Map(groupIds.map((groupId, index) => [
    groupId, new Map(memberQueries[index].data?.map((member) => [member.userId, member.name])),
  ]));
  const groupById = new Map(groups.groups.map((group) => [group.id, group]));
  const items = query.data ? events.flatMap((event) => {
    const group = groupById.get(event.groupId);
    if (!group) return [];
    const memberNames = names.get(group.id);
    return [{
      event, group,
      actorName: event.actorId === userId ? "You" : memberNames?.get(event.actorId) ?? "A member",
      payerName: event.paymentFromId === userId ? "you" : memberNames?.get(event.paymentFromId ?? "") ?? "a member",
      recipientName: event.paymentToId === userId ? "you" : memberNames?.get(event.paymentToId ?? "") ?? "a member",
    }];
  }) : null;

  useFocusEffect(useCallback(() => {
    if (userId) void client.refetchQueries(
      { queryKey: activityQueryKey(userId), stale: true, type: "active" },
      { cancelRefetch: false }
    );
  }, [client, userId]));

  async function refresh() {
    // Refresh both sources; keep the current timeline visible if either read fails.
    await Promise.allSettled([groups.loadGroups(true), query.refetch()]);
  }

  function loadMore() {
    if (query.hasNextPage && !query.isFetching) return query.fetchNextPage({ cancelRefetch: false });
  }

  return {
    items,
    isLoading: !!userId && (query.isPending || groups.isLoading),
    isRefreshing: query.isRefetching || groups.isRefreshing,
    isLoadingMore: query.isFetchingNextPage,
    isFetching: query.isFetching,
    hasMore: query.hasNextPage,
    error: groups.error ?? groups.refreshError ?? (!query.isFetchNextPageError ? query.error?.message ?? null : null),
    pageError: query.isFetchNextPageError ? query.error?.message ?? null : null,
    refresh, loadMore,
  };
}
