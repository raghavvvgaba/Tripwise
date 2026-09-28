import { Link, router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { PrimaryButton } from "@/components/primary-button";
import { getGroupMembers, type GroupMember } from "@/lib/group-invites";
import { deleteGroupExpense, getGroupExpense } from "@/lib/expenses";
import type { SharedExpense } from "@/types/shared-expense";
import type { SharedGroup } from "@/types/shared-group";
import { formatExpenseDate, formatRelativeTime } from "@/utils/date";
import { formatMoney } from "@/utils/money";
import { confirmAction, showError } from "@/utils/dialogs";

export function SharedExpenseDetails({ group, expenseId }: { group: SharedGroup; expenseId: string }) {
  const [expense, setExpense] = useState<SharedExpense | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const deletingRef = useRef(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    setExpense(null);
    setError(null);
    void Promise.all([getGroupExpense(group.id, expenseId), getGroupMembers(group.id)])
      .then(([nextExpense, nextMembers]) => {
        if (!active) return;
        setExpense(nextExpense);
        setMembers(nextMembers);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load this expense.");
      });
    return () => { active = false; };
  }, [group.id, expenseId, loadAttempt]));

  const nameFor = (userId: string) => members.find((member) => member.userId === userId)?.name ?? "A member";

  async function handleDelete() {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setIsDeleting(true);
    try {
      await deleteGroupExpense(group.id, expenseId);
      router.dismissTo(`/groups/${group.id}`);
    } catch (cause) {
      showError("Could not delete expense", cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      deletingRef.current = false;
      setIsDeleting(false);
    }
  }

  function confirmDelete() {
    confirmAction(
      "Delete this expense?",
      "It will be removed for every group member and balances will update. This cannot be undone.",
      "Delete expense",
      () => void handleDelete(),
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Expense details" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="w-full max-w-3xl self-center gap-6 px-5 pb-12 pt-5 md:px-8 lg:py-10"
      >
        {error ? (
          <View className="gap-4">
            <EmptyState icon="receipt-outline" title="Could not load expense" message={error} />
            <Pressable onPress={() => setLoadAttempt((attempt) => attempt + 1)}>
              <Text className="text-center font-semibold text-brand-700">Retry</Text>
            </Pressable>
          </View>
        ) : !expense ? <ActivityIndicator /> : (
          <>
            <View className="card items-center gap-2 px-5 py-7">
              <Text className="text-center text-xl font-bold text-ink">{expense.description}</Text>
              <Text selectable className="text-4xl font-bold text-ink">
                {formatMoney(expense.amountMinor / 100, group.currency)}
              </Text>
              <Text className="text-sm text-muted">
                {formatExpenseDate(`${expense.expenseDate}T00:00:00`)} · {group.name}
              </Text>
            </View>

            <View className="gap-3">
              <Text className="section-label px-1">Payment</Text>
              <View className="card flex-row items-center justify-between gap-3 p-4">
                <View className="gap-1">
                  <Text className="text-xs text-muted">Paid by</Text>
                  <Text className="font-semibold text-ink">{nameFor(expense.paidById)}</Text>
                </View>
                <Text selectable className="font-bold text-ink">{formatMoney(expense.amountMinor / 100, group.currency)}</Text>
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
                {expense.shares.map((share, index) => (
                  <View key={share.userId}>
                    <View className="flex-row items-center justify-between gap-3 py-3">
                      <Text className="flex-1 font-medium text-ink">{nameFor(share.userId)}</Text>
                      <Text selectable className="font-bold text-ink">
                        {formatMoney(share.amountMinor / 100, group.currency)}
                      </Text>
                    </View>
                    {index < expense.shares.length - 1 ? <View className="h-px bg-line" /> : null}
                  </View>
                ))}
              </View>
            </View>

            {expense.note ? (
              <View className="gap-2">
                <Text className="section-label px-1">Note</Text>
                <Text selectable className="card p-4 text-sm leading-5 text-ink">{expense.note}</Text>
              </View>
            ) : null}

            <View className="gap-1 px-1">
              <Text className="text-xs text-muted">Added by {nameFor(expense.createdById)}</Text>
              {expense.updatedAt ? (
                <Text className="text-xs text-muted">
                  Last edited by {expense.updatedById ? nameFor(expense.updatedById) : "a group member"} · {formatRelativeTime(expense.updatedAt)}
                </Text>
              ) : null}
            </View>
            <Link href={{ pathname: "/groups/[groupId]/add-expense", params: { groupId: group.id, expenseId } }} asChild>
              <PrimaryButton label="Edit expense" variant="secondary" disabled={isDeleting} />
            </Link>
            <PrimaryButton label="Delete expense" variant="danger" onPress={confirmDelete} loading={isDeleting} />
          </>
        )}
      </ScrollView>
    </>
  );
}
