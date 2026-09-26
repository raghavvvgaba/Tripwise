import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { useGroupsStore } from "@/store/use-groups-store";
import { useThemeColors } from "@/constants/theme";
import type { Expense, Group } from "@/types/models";
import { formatRelativeTime } from "@/utils/date";
import { formatMoney } from "@/utils/money";

type ActivityItem = {
  id: string;
  expense: Expense;
  group: Group;
  timestamp: string;
  type: "settlement" | "edit" | "delete" | "add";
};

export default function ActivityScreen() {
  const groups = useGroupsStore((state) => state.groups);
  const colors = useThemeColors();

  const activities = useMemo(() => {
    const list: ActivityItem[] = [];

    for (const group of groups) {
      for (const expense of group.expenses) {
        let type: ActivityItem["type"] = "add";
        let timestamp = expense.date;

        if (expense.deletedAt) {
          type = "delete";
          timestamp = expense.deletedAt;
        } else if (expense.isSettlement) {
          type = "settlement";
          timestamp = expense.date;
        } else if (expense.editedAt) {
          type = "edit";
          timestamp = expense.editedAt;
        }

        list.push({
          id: `${expense.id}-${timestamp}`,
          expense,
          group,
          timestamp,
          type,
        });
      }
    }

    return list.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [groups]);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="w-full max-w-5xl self-center gap-6 px-5 pb-12 pt-5 md:px-8 lg:py-10"
      showsVerticalScrollIndicator={false}
    >
      <View className="gap-1 px-1">
        <Text className="text-2xl font-bold text-ink lg:text-3xl">Recent Activity</Text>
        <Text className="text-sm leading-5 text-muted">
          Track expenses, changes, and settlements across all your groups.
        </Text>
      </View>

      {activities.length > 0 ? (
        <View className="card px-4">
          {activities.map((item, index) => {
            const { expense, group, type, timestamp } = item;
            const payer = group.members.find((m) => m.id === expense.paidById);
            const addedBy = group.members.find((m) => m.id === expense.addedById);
            const editor = expense.editedById
              ? group.members.find((m) => m.id === expense.editedById)
              : null;
            const recipient = expense.shares[0]
              ? group.members.find((m) => m.id === expense.shares[0].memberId)
              : null;

            let icon: keyof typeof Ionicons.glyphMap = "receipt-outline";
            let iconColor = colors["brand-700"];
            let actionText = "";

            if (type === "settlement") {
              icon = "swap-horizontal-outline";
              actionText = `${payer?.name ?? "Someone"} paid ${recipient?.name ?? "Someone"}`;
            } else if (type === "edit") {
              icon = "create-outline";
              iconColor = colors["brand-700"];
              actionText = `${editor?.name ?? addedBy?.name ?? "Someone"} updated "${expense.description}"`;
            } else if (type === "delete") {
              icon = "trash-outline";
              iconColor = colors.muted;
              actionText = `${addedBy?.name ?? "Someone"} deleted "${expense.description}"`;
            } else {
              actionText = `${addedBy?.name ?? "Someone"} added "${expense.description}"`;
            }

            return (
              <View key={item.id}>
                <Link
                  href={{
                    pathname: "/expenses/[expenseId]",
                    params: { expenseId: expense.id, groupId: group.id },
                  }}
                  asChild
                >
                  <Pressable className="flex-row items-center gap-3 py-4 active:opacity-60">
                    <View className="h-11 w-11 items-center justify-center rounded-2xl bg-canvas">
                      <Ionicons name={icon} size={21} color={iconColor} />
                    </View>
                    <View className="flex-1 gap-0.5">
                      <Text className="font-semibold text-ink" numberOfLines={1}>
                        {actionText}
                      </Text>
                      <Text className="text-xs text-muted" numberOfLines={1}>
                        {group.name} · {formatRelativeTime(timestamp)}
                      </Text>
                    </View>
                    <Text
                      selectable
                      className={`text-base font-bold ${type === "delete" ? "text-muted line-through" : "text-ink"}`}
                    >
                      {formatMoney(expense.amount, group.currency)}
                    </Text>
                  </Pressable>
                </Link>
                {index < activities.length - 1 ? <View className="h-px bg-line" /> : null}
              </View>
            );
          })}
        </View>
      ) : (
        <EmptyState
          icon="flash-outline"
          title="No activity yet"
          message="Expenses, edits, and payments in your groups will appear here."
        />
      )}
    </ScrollView>
  );
}
