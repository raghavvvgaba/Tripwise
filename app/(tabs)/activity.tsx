import { Ionicons } from "@expo/vector-icons";
import { Link, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { useThemeColors } from "@/constants/theme";
import { getGroupMembers } from "@/lib/group-invites";
import { listActivityExpenses, type ActivityExpense } from "@/lib/expenses";
import { useAuthStore } from "@/store/use-auth-store";
import { useSharedGroupsStore } from "@/store/use-shared-groups-store";
import type { SharedGroup } from "@/types/shared-group";
import { formatRelativeTime } from "@/utils/date";
import { formatMoney } from "@/utils/money";

type ActivityItem = {
  expense: ActivityExpense;
  group: SharedGroup;
  creatorName: string;
};

export default function ActivityScreen() {
  const colors = useThemeColors();
  const userId = useAuthStore((state) => state.session?.user.id);
  const loadGroups = useSharedGroupsStore((state) => state.loadGroups);
  const requestId = useRef(0);
  const nextOffset = useRef(0);
  const loadingMore = useRef(false);
  const namesByGroup = useRef(new Map<string, Map<string, string>>());
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const loadPage = useCallback(async (offset: number, groups: SharedGroup[], currentUserId: string) => {
    const page = await listActivityExpenses(offset);
    const groupById = new Map(groups.map((group) => [group.id, group]));
    const groupIds = [...new Set(
      page.expenses
        .filter((expense) => expense.createdById !== currentUserId && !namesByGroup.current.has(expense.groupId))
        .map((expense) => expense.groupId),
    )];
    const memberResults = await Promise.allSettled(groupIds.map((groupId) => getGroupMembers(groupId)));

    memberResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        namesByGroup.current.set(groupIds[index], new Map(result.value.map((member) => [member.userId, member.name])));
      }
    });

    const pageItems: ActivityItem[] = page.expenses.flatMap((expense) => {
      const group = groupById.get(expense.groupId);
      if (!group) return [];
      return [{
        expense,
        group,
        creatorName: expense.createdById === currentUserId
          ? "You"
          : namesByGroup.current.get(group.id)?.get(expense.createdById) ?? "A member",
      }];
    });

    return { ...page, pageItems };
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const currentRequest = ++requestId.current;
    nextOffset.current = 0;
    loadingMore.current = false;
    namesByGroup.current.clear();
    setIsLoading(true);
    setIsLoadingMore(false);
    setHasMore(false);
    setError(null);
    setPageError(null);
    setItems(null);

    try {
      const groupsLoaded = await loadGroups(userId);
      if (!groupsLoaded) {
        throw new Error(useSharedGroupsStore.getState().error ?? "Could not load your groups.");
      }

      const groups = useSharedGroupsStore.getState().groups;
      const page = await loadPage(0, groups, userId);
      if (requestId.current === currentRequest) {
        nextOffset.current = page.expenses.length;
        setItems(page.pageItems);
        setHasMore(page.hasMore);
      }
    } catch (loadError) {
      if (requestId.current === currentRequest) {
        setError(loadError instanceof Error ? loadError.message : "Could not load activity.");
      }
    } finally {
      if (requestId.current === currentRequest) setIsLoading(false);
    }
  }, [loadGroups, loadPage, userId]);

  const loadMore = useCallback(async () => {
    if (!userId || !hasMore || loadingMore.current) return;
    const currentRequest = requestId.current;
    loadingMore.current = true;
    setIsLoadingMore(true);
    setPageError(null);

    try {
      const groups = useSharedGroupsStore.getState().groups;
      const page = await loadPage(nextOffset.current, groups, userId);
      if (requestId.current === currentRequest) {
        nextOffset.current += page.expenses.length;
        setItems((previous) => [...(previous ?? []), ...page.pageItems]);
        setHasMore(page.hasMore);
      }
    } catch (loadError) {
      if (requestId.current === currentRequest) {
        setPageError(loadError instanceof Error ? loadError.message : "Could not load more activity.");
      }
    } finally {
      if (requestId.current === currentRequest) {
        loadingMore.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [hasMore, loadPage, userId]);

  useFocusEffect(useCallback(() => {
    void refresh();
    return () => { requestId.current += 1; };
  }, [refresh]));

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="w-full max-w-5xl self-center gap-6 px-5 pb-12 pt-5 md:px-8 lg:py-10"
      showsVerticalScrollIndicator={false}
    >
      <View className="flex-row items-start justify-between gap-4 px-1">
        <View className="flex-1 gap-1">
          <Text className="text-2xl font-bold text-ink lg:text-3xl">Recent Activity</Text>
          <Text className="text-sm leading-5 text-muted">New expenses across all your groups.</Text>
        </View>
        <Pressable accessibilityRole="button" disabled={isLoading} onPress={() => void refresh()} className="min-h-11 justify-center">
          <Text className="font-semibold text-brand-700">Refresh</Text>
        </Pressable>
      </View>

      {isLoading ? <ActivityIndicator color={colors["brand-600"]} /> : null}
      {error ? (
        <View className="card gap-3 p-5">
          <Text selectable className="text-sm text-coral">{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => void refresh()}>
            <Text className="font-semibold text-brand-700">Try again</Text>
          </Pressable>
        </View>
      ) : null}

      {items && items.length > 0 ? (
        <View className="card px-4">
          {items.map(({ expense, group, creatorName }, index) => (
            <View key={expense.id}>
              <Link
                href={{ pathname: "/expenses/[expenseId]", params: { expenseId: expense.id, groupId: group.id } }}
                asChild
              >
                <Pressable className="flex-row items-center gap-3 py-4 active:opacity-60">
                  <View className="h-11 w-11 items-center justify-center rounded-2xl bg-canvas">
                    <Ionicons name="receipt-outline" size={21} color={colors["brand-700"]} />
                  </View>
                  <View className="flex-1 gap-0.5">
                    <Text className="font-semibold text-ink" numberOfLines={1}>
                      {creatorName} added “{expense.description}”
                    </Text>
                    <Text className="text-xs text-muted" numberOfLines={1}>
                      {group.name}{group.archivedAt ? " (archived)" : ""} · {formatRelativeTime(expense.createdAt)}
                    </Text>
                  </View>
                  <Text selectable className="text-base font-bold text-ink">
                    {formatMoney(expense.amountMinor / 100, group.currency)}
                  </Text>
                </Pressable>
              </Link>
              {index < items.length - 1 ? <View className="h-px bg-line" /> : null}
            </View>
          ))}
        </View>
      ) : items && !error && !hasMore ? (
        <EmptyState icon="flash-outline" title="No activity yet" message="Expenses added to your groups will appear here." />
      ) : null}

      {pageError ? <Text selectable className="text-center text-sm text-coral">{pageError}</Text> : null}
      {items && hasMore ? (
        <Pressable
          accessibilityRole="button"
          disabled={isLoadingMore}
          onPress={() => void loadMore()}
          className="min-h-11 items-center justify-center rounded-2xl border border-line bg-surface px-5 py-3 active:opacity-60"
        >
          {isLoadingMore ? <ActivityIndicator color={colors["brand-600"]} /> : <Text className="font-semibold text-brand-700">Load more</Text>}
        </Pressable>
      ) : null}
    </ScrollView>
  );
}
