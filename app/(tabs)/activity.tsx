import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { useClayTheme } from "@/constants/clay-theme";
import { listGroupActivity, type GroupActivityEvent } from "@/lib/activity";
import { getGroupMembers } from "@/lib/group-invites";
import { useAuthStore } from "@/store/use-auth-store";
import { useSharedGroups, useGroupActions } from "@/hooks/use-shared-groups";
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
  const clay = useClayTheme();
  const userId = useAuthStore((state) => state.session?.user.id);
  const { loadGroups } = useSharedGroups();
  const { restoreGroup } = useGroupActions();
  const requestId = useRef(0);
  const nextOffset = useRef(0);
  const loadingMore = useRef(false);
  const namesByGroup = useRef(new Map<string, Map<string, string>>());
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const loadPage = useCallback(async (offset: number, groups: SharedGroup[], currentUserId: string) => {
    const page = await listGroupActivity(offset);
    const groupById = new Map(groups.map((group) => [group.id, group]));
    const groupIds = [
      ...new Set(
        page.events
          .filter(
            (event) =>
              (event.actorId !== currentUserId ||
                event.eventType === "payment_recorded" ||
                event.eventType === "payment_deleted") &&
              !namesByGroup.current.has(event.groupId)
          )
          .map((event) => event.groupId)
      ),
    ];
    const memberResults = await Promise.allSettled(groupIds.map((groupId) => getGroupMembers(groupId)));

    memberResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        namesByGroup.current.set(groupIds[index], new Map(result.value.map((member) => [member.userId, member.name])));
      }
    });

    const pageItems: ActivityItem[] = page.events.flatMap((event) => {
      const group = groupById.get(event.groupId);
      if (!group) return [];
      return [
        {
          event,
          group,
          actorName:
            event.actorId === currentUserId
              ? "You"
              : namesByGroup.current.get(group.id)?.get(event.actorId) ?? "A member",
        },
      ];
    });

    return { ...page, pageItems };
  }, []);

  const refresh = useCallback(async (isPullRefresh = false) => {
    if (!userId) return;
    const currentRequest = ++requestId.current;
    nextOffset.current = 0;
    loadingMore.current = false;
    namesByGroup.current.clear();
    if (isPullRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
      setItems(null);
    }
    setIsLoadingMore(false);
    setHasMore(false);
    setError(null);
    setPageError(null);

    try {
      const groups = await loadGroups();
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
      if (requestId.current === currentRequest) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [loadGroups, loadPage, userId]);

  const loadMore = useCallback(async () => {
    if (!userId || loadingMore.current || !hasMore || isLoadingMore) return;
    loadingMore.current = true;
    setIsLoadingMore(true);
    setPageError(null);

    try {
      const groups = await loadGroups();
      const page = await loadPage(nextOffset.current, groups, userId);
      nextOffset.current += page.events.length;
      setItems((current) => [...(current ?? []), ...page.pageItems]);
      setHasMore(page.hasMore);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Could not load older activity.");
    } finally {
      loadingMore.current = false;
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, loadGroups, loadPage, userId]);

  function openItem(item: ActivityItem) {
    const { event, group } = item;
    if (group.deletedAt && event.eventType === "group_deleted") {
      confirmAction(
        `Restore ${group.name}?`,
        "This group was deleted. Restore it to view its expenses and balances again.",
        "Restore group",
        () => void restoreFromActivity(group.id),
        false
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

  useFocusEffect(
    useCallback(() => {
      void refresh();
      return () => {
        requestId.current += 1;
      };
    }, [refresh])
  );

  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => void refresh(true)}
          tintColor={clay.isDark ? "#F5D298" : "#2C254E"}
          colors={["#F5D298"]}
        />
      }
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="w-full max-w-5xl self-center gap-6 px-5 pb-12 pt-3 md:px-8 lg:py-8"
      showsVerticalScrollIndicator={false}
      style={{ backgroundColor: clay.canvas }}
    >
      <View className="px-1 gap-0.5">
        <Text style={{ color: clay.textMuted }} className="text-[11px] font-black uppercase tracking-widest">
          Timeline
        </Text>
        <Text style={{ color: clay.textPrimary }} className="text-2xl font-black">
          Recent Activity
        </Text>
      </View>

      {isLoading ? <ActivityIndicator color="#F5D298" className="py-12" /> : null}

      {error ? (
        <View
          style={{ backgroundColor: clay.card, borderColor: clay.errorCardBorder }}
          className="gap-3 rounded-3xl border p-5 shadow-sm"
        >
          <Text selectable style={{ color: clay.errorText }} className="text-sm font-semibold">
            {error}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => void refresh()} className="self-start">
            <Text className="text-sm font-bold text-[#F5D298]">Try again</Text>
          </Pressable>
        </View>
      ) : null}

      {items && items.length > 0 ? (
        <View
          style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
          className="overflow-hidden rounded-3xl border px-4 py-1 shadow-sm"
        >
          {items.map((item, index) => {
            const { event, group, actorName } = item;
            const isExpense =
              event.eventType === "expense_added" ||
              event.eventType === "expense_edited" ||
              event.eventType === "expense_deleted";
            const isPayment = event.eventType === "payment_recorded" || event.eventType === "payment_deleted";
            const isUnavailableExpense = isExpense && !event.expenseId;
            const memberNames = namesByGroup.current.get(group.id);
            const payerName =
              event.paymentFromId === userId ? "you" : memberNames?.get(event.paymentFromId ?? "") ?? "a member";
            const recipientName =
              event.paymentToId === userId ? "you" : memberNames?.get(event.paymentToId ?? "") ?? "a member";

            return (
              <View key={event.id}>
                <Pressable
                  accessibilityRole="button"
                  disabled={
                    restoringId !== null ||
                    isUnavailableExpense ||
                    Boolean(group.deletedAt && event.eventType !== "group_deleted")
                  }
                  onPress={() => openItem(item)}
                  className="flex-row items-center gap-3.5 py-4 active:opacity-60"
                >
                  <View
                    style={{ backgroundColor: clay.squircle, borderColor: clay.cardBorder }}
                    className="h-11 w-11 items-center justify-center rounded-2xl border"
                  >
                    <Ionicons
                      name={
                        event.eventType === "expense_deleted" ||
                        event.eventType === "group_deleted" ||
                        event.eventType === "payment_deleted"
                          ? "trash-outline"
                          : isPayment
                            ? "swap-horizontal-outline"
                            : isExpense
                              ? "receipt-outline"
                              : "refresh-outline"
                      }
                      size={20}
                      color={clay.isDark ? "#F5D298" : "#9A6B1C"}
                    />
                  </View>

                  <View className="flex-1 gap-1">
                    <Text style={{ color: clay.textPrimary }} className="text-sm font-bold" numberOfLines={1}>
                      {isExpense
                        ? `${actorName} ${event.eventType === "expense_deleted" ? "deleted" : event.eventType === "expense_edited" ? "edited" : "added"} “${event.description}”`
                        : isPayment
                          ? `${actorName} ${event.eventType === "payment_deleted" ? "deleted" : "recorded"} a payment`
                          : `${actorName} ${event.eventType === "group_deleted" ? "deleted" : "restored"} ${group.name}`}
                    </Text>

                    {isPayment ? (
                      <>
                        <Text style={{ color: clay.textMuted }} className="text-xs" numberOfLines={1}>
                          {group.name} · {event.eventType === "payment_deleted" ? "Deleted" : "Recorded"}{" "}
                          {formatRelativeTime(event.createdAt)}
                        </Text>
                        <Text style={{ color: clay.textMuted }} className="text-xs" numberOfLines={1}>
                          Paid on {event.paymentDate ? formatPaymentDate(event.paymentDate) : "an earlier date"} ·{" "}
                          {payerName} → {recipientName}
                        </Text>
                      </>
                    ) : (
                      <Text style={{ color: clay.textMuted }} className="text-xs" numberOfLines={1}>
                        {group.name} · {formatRelativeTime(event.createdAt)}
                        {group.deletedAt && event.eventType === "group_deleted"
                          ? " · Tap to restore"
                          : isUnavailableExpense && event.eventType !== "expense_deleted"
                            ? " · Expense deleted"
                            : ""}
                      </Text>
                    )}
                  </View>

                  {(isExpense || isPayment) && event.amountMinor !== null ? (
                    <Text selectable style={{ color: clay.textPrimary }} className="text-base font-black">
                      {formatMoney(event.amountMinor / 100, group.currency)}
                    </Text>
                  ) : null}
                </Pressable>
                {index < items.length - 1 ? (
                  <View style={{ backgroundColor: clay.cardBorder }} className="h-px w-full" />
                ) : null}
              </View>
            );
          })}
        </View>
      ) : items && !error && !hasMore ? (
        <EmptyState
          icon="flash-outline"
          title="No activity yet"
          message="Expenses, payments, and group changes will appear here."
        />
      ) : null}

      {pageError ? (
        <Text selectable style={{ color: clay.errorText }} className="text-center text-sm font-semibold">
          {pageError}
        </Text>
      ) : null}

      {items && hasMore ? (
        <Pressable
          accessibilityRole="button"
          disabled={isLoadingMore}
          onPress={() => void loadMore()}
          style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
          className="h-13 items-center justify-center rounded-2xl border px-5 active:opacity-75 disabled:opacity-50"
        >
          {isLoadingMore ? (
            <ActivityIndicator color="#F5D298" />
          ) : (
            <Text style={{ color: clay.isDark ? "#F5D298" : "#9A6B1C" }} className="text-sm font-extrabold">
              Load More
            </Text>
          )}
        </Pressable>
      ) : null}
    </ScrollView>
  );
}
