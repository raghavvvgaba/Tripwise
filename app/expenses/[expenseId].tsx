import { Link, Stack, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { MemberAvatar } from "@/components/member-avatar";
import { PrimaryButton } from "@/components/primary-button";
import { useGroupsStore } from "@/store/use-groups-store";
import { confirmAction } from "@/utils/dialogs";
import { formatExpenseDate, formatRelativeTime } from "@/utils/date";
import { formatMoney } from "@/utils/money";

export default function ExpenseDetailsScreen() {
  const { expenseId, groupId } = useLocalSearchParams<{ expenseId: string; groupId: string }>();
  const group = useGroupsStore((state) => state.groups.find((item) => item.id === groupId));
  const deleteExpense = useGroupsStore((state) => state.deleteExpense);
  const restoreExpense = useGroupsStore((state) => state.restoreExpense);
  const expense = group?.expenses.find((item) => item.id === expenseId);

  if (!group || !expense) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="px-5 py-8">
        <EmptyState emoji="🧾" title="Expense not found" message="It may no longer be available in this group." />
      </ScrollView>
    );
  }

  const payer = group.members.find((member) => member.id === expense.paidById);
  const addedBy = group.members.find((member) => member.id === expense.addedById);
  const editor = expense.editedById
    ? group.members.find((member) => member.id === expense.editedById)
    : null;

  function confirmDelete() {
    confirmAction(
      "Delete this expense?",
      "Balances will update immediately. You can restore it from this screen before leaving.",
      "Delete",
      () => deleteExpense(group!.id, expense!.id),
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Expense details" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="w-full max-w-3xl self-center gap-6 px-5 pb-12 pt-5 md:px-8 lg:py-10"
        showsVerticalScrollIndicator={false}
      >
        {expense.deletedAt ? (
          <View className="flex-row items-center justify-between gap-4 rounded-2xl bg-red-50 px-4 py-3 dark:bg-red-950">
            <View className="flex-1 gap-0.5">
              <Text className="font-semibold text-red-700 dark:text-red-300">Expense deleted</Text>
              <Text className="text-xs text-red-600 dark:text-red-200">It is excluded from balances.</Text>
            </View>
            <Pressable onPress={() => restoreExpense(group.id, expense.id)} className="rounded-xl bg-surface px-3 py-2">
              <Text className="text-sm font-bold text-red-700 dark:text-red-300">Undo</Text>
            </Pressable>
          </View>
        ) : null}

        <View className="card items-center gap-3 px-5 py-7">
          <View className="h-16 w-16 items-center justify-center rounded-3xl bg-brand-50">
            <Text className="text-3xl">{expense.isSettlement ? "🤝" : "🧾"}</Text>
          </View>
          <View className="items-center gap-1">
            <Text className="text-center text-xl font-bold text-ink">{expense.description}</Text>
            <Text selectable className="text-4xl font-bold tracking-tight text-ink">
              {formatMoney(expense.amount, group.currency)}
            </Text>
          </View>
          <Text className="text-sm text-muted">{formatExpenseDate(expense.date)} · {group.name}</Text>
          {expense.editedAt ? (
            <View className="rounded-xl bg-canvas px-2.5 py-1">
              <Text className="text-xs font-medium text-muted">
                Edited by {editor?.name ?? "a member"}
              </Text>
            </View>
          ) : null}
        </View>

        <View className="gap-3">
          <Text className="section-label px-1">Payment</Text>
          <View className="card flex-row items-center gap-3 p-4">
            {payer ? <MemberAvatar member={payer} /> : null}
            <View className="flex-1 gap-0.5">
              <Text className="text-xs text-muted">Paid by</Text>
              <Text className="font-semibold text-ink">{payer?.name ?? "Unknown member"}</Text>
            </View>
            <Text selectable className="text-lg font-bold text-ink">
              {formatMoney(expense.amount, group.currency)}
            </Text>
          </View>
        </View>

        <View className="gap-3">
          <View className="flex-row items-center justify-between px-1">
            <Text className="section-label">Split breakdown</Text>
            <Text className="text-xs font-semibold text-muted">
              {expense.splitMode === "equal" ? "Equally" : "Exact amounts"}
            </Text>
          </View>
          <View className="card px-4">
            {expense.shares.map((share, index) => {
              const member = group.members.find((item) => item.id === share.memberId);
              if (!member) return null;

              return (
                <View key={share.memberId}>
                  <View className="flex-row items-center gap-3 py-3">
                    <MemberAvatar member={member} size="sm" />
                    <Text className="flex-1 font-medium text-ink">{member.name}</Text>
                    <Text selectable className="font-bold text-ink">
                      {formatMoney(share.amount, group.currency)}
                    </Text>
                  </View>
                  {index < expense.shares.length - 1 ? <View className="h-px bg-line" /> : null}
                </View>
              );
            })}
          </View>
        </View>

        {expense.note ? (
          <View className="gap-2">
            <Text className="section-label px-1">Note</Text>
            <Text selectable className="card p-4 text-sm leading-5 text-ink">{expense.note}</Text>
          </View>
        ) : null}

        <View className="rounded-2xl bg-canvas px-4 py-3 gap-1">
          <Text className="text-xs leading-5 text-muted">
            Added by {addedBy?.name ?? "a group member"}
          </Text>
          {expense.editedAt ? (
            <Text className="text-xs leading-5 text-muted">
              Edited by {editor?.name ?? "a group member"} · {formatRelativeTime(expense.editedAt)}
            </Text>
          ) : null}
        </View>

        {!expense.deletedAt ? (
          <View className="gap-3">
            <Link
              href={{
                pathname: "/groups/[groupId]/add-expense",
                params: { groupId: group.id, expenseId: expense.id },
              }}
              asChild
            >
              <PrimaryButton label="Edit expense" variant="secondary" />
            </Link>
            <PrimaryButton label="Delete expense" variant="danger" onPress={confirmDelete} />
          </View>
        ) : (
          <PrimaryButton label="Restore expense" onPress={() => restoreExpense(group.id, expense.id)} />
        )}
      </ScrollView>
    </>
  );
}
