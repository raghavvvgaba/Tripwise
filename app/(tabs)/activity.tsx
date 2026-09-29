import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { useThemeColors } from "@/constants/theme";
import { listGroupActivity, type GroupActivityEvent } from "@/lib/activity";
import { getGroupMembers } from "@/lib/group-invites";
import { useAuthStore } from "@/store/use-auth-store";
import { useSharedGroupsStore } from "@/store/use-shared-groups-store";
import type { SharedGroup } from "@/types/shared-group";
import { formatPaymentDate, formatRelativeTime } from "@/utils/date";
import { formatMoney } from "@/utils/money";
import { confirmAction, showError } from "@/utils/dialogs";

type ActivityItem = {
  event: GroupActivityEvent;
  group: SharedGroup;
  actorName: string;
};

export default function ActivityScreen() {
  const colors = useThemeColors();
  const userId = useAuthStore((state) => state.session?.user.id);
  const loadGroups = useSharedGroupsStore((state) => state.loadGroups);
  const restoreGroup = useSharedGroupsStore((state) => state.restoreGroup);
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
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const loadPage = useCallback(async (offset: number, groups: SharedGroup[], currentUserId: string) => {
    const page = await listGroupActivity(offset);
    const groupById = new Map(groups.map((group) => [group.id, group]));
    const groupIds = [...new Set(
      page.events
        .filter((event) => (event.actorId !== currentUserId || event.eventType === "payment_recorded" || event.eventType === "payment_deleted") && !namesByGroup.current.has(event.groupId))
        .map((event) => event.groupId),
    )];
    const memberResults = await Promise.allSettled(groupIds.map((groupId) => getGroupMembers(groupId)));

    memberResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        namesByGroup.current.set(groupIds[index], new Map(result.value.map((member) => [member.userId, member.name])));
      }
    });

    const pageItems: ActivityItem[] = page.events.flatMap((event) => {
      const group = groupById.get(event.groupId);
      if (!group) return [];
      return [{
        event,
        group,
        actorName: event.actorId === currentUserId
          ? "You"
          : namesByGroup.current.get(group.id)?.get(event.actorId) ?? "A member",
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
        nextOffset.current = page.events.length;
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
        nextOffset.current += page.events.length;
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

  function openItem(item: ActivityItem) {
    const { event, group } = item;
    if (group.deletedAt && event.eventType === "group_deleted") {
      confirmAction(
        "Restore this group?",
        `Restore ${group.name} and all its expenses for every member?`,
        "Restore group",
        () => void restoreFromActivity(group.id),
        false,
      );
    } else if (group.deletedAt) {
      return;
    } else if (event.eventType === "expense_deleted") {
      return;
    } else if (event.eventType === "payment_recorded" || event.eventType === "payment_deleted") {
      router.push(`/groups/${group.id}`);
    } else if ((event.eventType === "expense_added" || event.eventType === "expense_edited") && event.expenseId) {
      router.push({ pathname: "/expenses/[expenseId]", params: { expenseId: event.expenseId, groupId: group.id } });
    } else if (event.eventType === "group_deleted" || event.eventType === "group_restored") {
      router.push(`/groups/${group.id}`);
    }
  }

  async function restoreFromActivity(groupId: string) {
    if (restoringId) return;
    setRestoringId(groupId);
    try {
      await restoreGroup(groupId);
      await refresh();
    } catch (cause) {
      showError("Could not restore group", cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setRestoringId(null);
    }
  }

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
          <Text className="text-sm leading-5 text-muted">Expenses, payments, and group changes across all your groups.</Text>
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
          {items.map((item, index) => {
            const { event, group, actorName } = item;
            const isExpense = event.eventType === "expense_added" || event.eventType === "expense_edited" || event.eventType === "expense_deleted";
            const isPayment = event.eventType === "payment_recorded" || event.eventType === "payment_deleted";
            const isUnavailableExpense = isExpense && !event.expenseId;
            const memberNames = namesByGroup.current.get(group.id);
            const payerName = event.paymentFromId === userId ? "you" : memberNames?.get(event.paymentFromId ?? "") ?? "a member";
            const recipientName = event.paymentToId === userId ? "you" : memberNames?.get(event.paymentToId ?? "") ?? "a member";
            return (
              <View key={event.id}>
                <Pressable
                  accessibilityRole="button"
                  disabled={restoringId !== null || isUnavailableExpense || Boolean(group.deletedAt && event.eventType !== "group_deleted")}
                  onPress={() => openItem(item)}
                  className="flex-row items-center gap-3 py-4 active:opacity-60"
                >
                  <View className="h-11 w-11 items-center justify-center rounded-2xl bg-canvas">
                    <Ionicons name={event.eventType === "expense_deleted" || event.eventType === "group_deleted" || event.eventType === "payment_deleted" ? "trash-outline" : isPayment ? "swap-horizontal-outline" : isExpense ? "receipt-outline" : "refresh-outline"} size={21} color={colors["brand-700"]} />
                  </View>
                  <View className="flex-1 gap-0.5">
                    <Text className="font-semibold text-ink" numberOfLines={1}>
                      {isExpense
                        ? `${actorName} ${event.eventType === "expense_deleted" ? "deleted" : event.eventType === "expense_edited" ? "edited" : "added"} “${event.description}”`
                        : isPayment
                          ? `${actorName} ${event.eventType === "payment_deleted" ? "deleted" : "recorded"} a payment`
                        : `${actorName} ${event.eventType === "group_deleted" ? "deleted" : "restored"} ${group.name}`}
                    </Text>
                    {isPayment ? (
                      <>
                        <Text className="text-xs text-muted" numberOfLines={1}>{group.name} · {event.eventType === "payment_deleted" ? "Deleted" : "Recorded"} {formatRelativeTime(event.createdAt)}</Text>
                        <Text className="text-xs text-muted" numberOfLines={1}>
                          Paid on {event.paymentDate ? formatPaymentDate(event.paymentDate) : "an earlier date"} · {payerName} → {recipientName}
                        </Text>
                      </>
                    ) : (
                      <Text className="text-xs text-muted" numberOfLines={1}>
                        {group.name} · {formatRelativeTime(event.createdAt)}{group.deletedAt && event.eventType === "group_deleted" ? " · Tap to restore" : isUnavailableExpense && event.eventType !== "expense_deleted" ? " · Expense deleted" : ""}
                      </Text>
                    )}
                  </View>
                  {(isExpense || isPayment) && event.amountMinor !== null ? (
                    <Text selectable className="text-base font-bold text-ink">
                      {formatMoney(event.amountMinor / 100, group.currency)}
                    </Text>
                  ) : null}
                </Pressable>
                {index < items.length - 1 ? <View className="h-px bg-line" /> : null}
              </View>
            );
          })}
        </View>
      ) : items && !error && !hasMore ? (
        <EmptyState icon="flash-outline" title="No activity yet" message="Expenses, payments, and group changes will appear here." />
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
