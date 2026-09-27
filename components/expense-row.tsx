import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { useThemeColors } from "@/constants/theme";
import type { CurrencyCode, Expense, Member } from "@/types/models";
import { formatExpenseDate } from "@/utils/date";
import { formatMoney } from "@/utils/money";

type ExpenseRowProps = {
  expense: Expense;
  members: Member[];
  groupId: string;
  currency?: CurrencyCode;
};

export function ExpenseRow({ expense, members, groupId, currency = "INR" }: ExpenseRowProps) {
  const colors = useThemeColors();
  const payer = members.find((member) => member.id === expense.paidById);
  const description = expense.description.toLowerCase();
  const icon: keyof typeof Ionicons.glyphMap = expense.isSettlement
    ? "swap-horizontal-outline"
    : description.includes("hotel")
      ? "bed-outline"
      : description.includes("cab")
        ? "car-outline"
        : description.includes("dinner")
          ? "restaurant-outline"
          : "receipt-outline";

  return (
    <Link
      href={{ pathname: "/expenses/[expenseId]", params: { expenseId: expense.id, groupId } }}
      asChild
    >
      <Pressable className="flex-row items-center gap-3 py-4 active:opacity-60">
        <View className="h-11 w-11 items-center justify-center rounded-2xl bg-canvas">
          <Ionicons name={icon} size={21} color={colors["brand-700"]} />
        </View>
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-2">
            <Text className="max-w-[78%] font-semibold text-ink" numberOfLines={1}>
              {expense.description}
            </Text>
            {expense.editedAt ? (
              <View className="rounded-xl bg-canvas px-1.5 py-0.5">
                <Text className="text-[10px] font-medium text-muted">Edited</Text>
              </View>
            ) : null}
          </View>
          <Text className="text-xs text-muted" numberOfLines={1}>
            {payer?.name ?? "Unknown"} paid · {expense.shares.length} {expense.shares.length === 1 ? "person" : "people"} · {formatExpenseDate(expense.date)}
          </Text>
        </View>
        <Text selectable className="text-base font-bold text-ink">
          {formatMoney(expense.amount, currency)}
        </Text>
      </Pressable>
    </Link>
  );
}
