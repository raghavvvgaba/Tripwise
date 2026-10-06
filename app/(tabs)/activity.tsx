import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { useClayTheme } from "@/constants/clay-theme";
import { useActivity } from "@/hooks/use-activity";
import { useGroupActions } from "@/hooks/use-shared-groups";
import { formatPaymentDate, formatRelativeTime } from "@/utils/date";
import { formatMoney } from "@/utils/money";
import { confirmAction, showError } from "@/utils/dialogs";

type ActivityItem = NonNullable<ReturnType<typeof useActivity>["items"]>[number];

export default function ActivityScreen() {
  const clay = useClayTheme();
  const { items, isLoading, isRefreshing, isLoadingMore, isFetching, hasMore, error, pageError, refresh, loadMore } = useActivity();
  const { restoreGroup } = useGroupActions();
  const [restoringId, setRestoringId] = useState<string | null>(null);

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
    } catch (cause) {
      showError("Could not restore group", cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => void refresh()}
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
            const { payerName, recipientName } = item;

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
      ) : items && !isLoading && !error && !hasMore ? (
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
          disabled={isFetching}
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
