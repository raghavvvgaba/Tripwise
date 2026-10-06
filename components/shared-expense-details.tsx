import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useClayTheme } from "@/constants/clay-theme";
import { useGroupMembers, useGroupExpense } from "@/hooks/use-group-data";
import { useGroupDataActions } from "@/hooks/use-group-data-actions";
import type { SharedGroup } from "@/types/shared-group";
import { formatExpenseDate, formatRelativeTime } from "@/utils/date";
import { formatMoney } from "@/utils/money";
import { confirmAction, showError } from "@/utils/dialogs";

const AVATAR_RING_COLORS = [
  "#38BDF8", // Sky blue
  "#FB923C", // Coral orange
  "#4ADE80", // Mint green
  "#C084FC", // Soft lavender
  "#FBBF24", // Warm amber
  "#F472B6", // Rose pink
];

export function SharedExpenseDetails({ group, expenseId }: { group: SharedGroup; expenseId: string }) {
  const clay = useClayTheme();
  const expenseQuery = useGroupExpense(group.id, expenseId);
  const membersQuery = useGroupMembers(group.id);
  const expense = expenseQuery.data;
  const members = membersQuery.data ?? [];
  const error = expenseQuery.errorMessage ?? membersQuery.errorMessage;
  const { deleteExpense } = useGroupDataActions(group.id);
  const retry = () => { void expenseQuery.refetch(); void membersQuery.refetch(); };
  const [isDeleting, setIsDeleting] = useState(false);
  const deletingRef = useRef(false);

  const nameFor = (userId: string) => members.find((member) => member.userId === userId)?.name ?? "A member";
  const memberIndexFor = (userId: string) => Math.max(0, members.findIndex((m) => m.userId === userId));

  async function handleDelete() {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setIsDeleting(true);
    try {
      await deleteExpense(expenseId);
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
      () => void handleDelete()
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: clay.canvas }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Top Bar Header ── */}
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={{ backgroundColor: clay.headerBtn, borderColor: clay.cardBorder }}
          className="h-11 w-11 items-center justify-center rounded-2xl border active:opacity-75"
        >
          <Ionicons name="chevron-back" size={20} color={clay.textPrimary} />
        </Pressable>

        <View className="items-center">
          <Text style={{ color: clay.textMuted }} className="text-[11px] font-bold uppercase tracking-widest">
            Expense Details
          </Text>
          <Text style={{ color: clay.textPrimary }} className="max-w-[200px] text-base font-extrabold" numberOfLines={1}>
            {group.name}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete expense"
          disabled={isDeleting || !expense}
          onPress={confirmDelete}
          style={{ backgroundColor: clay.headerBtn, borderColor: clay.cardBorder }}
          className="h-11 w-11 items-center justify-center rounded-2xl border active:opacity-75 disabled:opacity-40"
        >
          <Ionicons name="trash-outline" size={18} color="#FB7185" />
        </Pressable>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerClassName="w-full max-w-2xl self-center px-5 pb-12 gap-5"
        showsVerticalScrollIndicator={false}
      >
        {error && expense ? <Text className="text-sm text-coral">Could not refresh: {error}</Text> : null}
        {error && !expense ? (
          <View
            style={{ backgroundColor: clay.card, borderColor: clay.errorCardBorder }}
            className="gap-3 rounded-3xl border p-5 shadow-sm"
          >
            <Text selectable style={{ color: clay.errorText }} className="text-sm font-semibold">
              {error}
            </Text>
            <Pressable onPress={retry} className="self-start">
              <Text className="text-sm font-bold text-[#F5D298]">Retry</Text>
            </Pressable>
          </View>
        ) : expense === null ? (
          <Text className="py-8 text-center text-muted">This expense has been deleted.</Text>
        ) : !expense ? (
          <ActivityIndicator color="#F5D298" className="py-16" />
        ) : (
          <>
            {/* ── Main Centerpiece Amount Card ── */}
            <View
              style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
              className="items-center gap-2 rounded-3xl border px-6 py-7 shadow-sm"
            >
              <View
                style={{ backgroundColor: clay.squircle, borderColor: clay.cardBorder }}
                className="h-14 w-14 items-center justify-center rounded-2xl border"
              >
                <Ionicons name="receipt" size={26} color={clay.isDark ? "#F5D298" : "#9A6B1C"} />
              </View>

              <Text
                style={{ color: clay.textPrimary }}
                className="mt-1 text-center text-xl font-black"
                numberOfLines={2}
              >
                {expense.description}
              </Text>

              <Text selectable style={{ color: clay.textPrimary }} className="text-4xl font-black tracking-tight">
                {formatMoney(expense.amountMinor / 100, group.currency)}
              </Text>

              <View style={{ backgroundColor: clay.badgeNeutralBg }} className="mt-1 rounded-full px-3 py-1">
                <Text style={{ color: clay.textMuted }} className="text-xs font-bold">
                  {formatExpenseDate(`${expense.expenseDate}T00:00:00`)}
                </Text>
              </View>
            </View>

            {/* ── Paid By Card ── */}
            <View className="gap-2">
              <Text style={{ color: clay.textMuted }} className="px-1 text-xs font-bold uppercase tracking-wider">
                Paid by
              </Text>
              <View
                style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
                className="flex-row items-center justify-between rounded-3xl border p-4 shadow-sm"
              >
                <View className="flex-row items-center gap-3">
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 21,
                      borderWidth: 2,
                      borderColor: AVATAR_RING_COLORS[memberIndexFor(expense.paidById) % AVATAR_RING_COLORS.length],
                      backgroundColor: clay.avatarBg,
                    }}
                    className="items-center justify-center"
                  >
                    <Text style={{ color: clay.textPrimary }} className="text-sm font-black">
                      {(nameFor(expense.paidById).trim()[0] || "?").toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={{ color: clay.textPrimary }} className="text-base font-bold">
                      {nameFor(expense.paidById)}
                    </Text>
                    <Text style={{ color: clay.textMuted }} className="text-xs">
                      Paid full amount
                    </Text>
                  </View>
                </View>

                <Text selectable style={{ color: clay.textPrimary }} className="text-base font-black">
                  {formatMoney(expense.amountMinor / 100, group.currency)}
                </Text>
              </View>
            </View>

            {/* ── Split Breakdown Card ── */}
            <View className="gap-2">
              <View className="flex-row items-center justify-between px-1">
                <Text style={{ color: clay.textMuted }} className="text-xs font-bold uppercase tracking-wider">
                  Split Breakdown
                </Text>
                <View style={{ backgroundColor: clay.badgeNeutralBg }} className="rounded-full px-2.5 py-0.5">
                  <Text style={{ color: clay.textMuted }} className="text-[11px] font-bold">
                    {expense.splitMode === "equal" ? "Equally" : "Exact amounts"}
                  </Text>
                </View>
              </View>

              <View
                style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
                className="rounded-3xl border px-4 py-2 shadow-sm"
              >
                {expense.shares.map((share, index) => {
                  const mName = nameFor(share.userId);
                  const mRing = AVATAR_RING_COLORS[memberIndexFor(share.userId) % AVATAR_RING_COLORS.length];
                  return (
                    <View key={share.userId}>
                      <View className="flex-row items-center justify-between py-3">
                        <View className="flex-row items-center gap-3">
                          <View
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 17,
                              borderWidth: 2,
                              borderColor: mRing,
                              backgroundColor: clay.avatarBg,
                            }}
                            className="items-center justify-center"
                          >
                            <Text style={{ color: clay.textPrimary }} className="text-xs font-black">
                              {(mName.trim()[0] || "?").toUpperCase()}
                            </Text>
                          </View>
                          <Text style={{ color: clay.textPrimary }} className="text-sm font-bold">
                            {mName}
                          </Text>
                        </View>
                        <Text selectable style={{ color: clay.textPrimary }} className="text-sm font-black">
                          {formatMoney(share.amountMinor / 100, group.currency)}
                        </Text>
                      </View>
                      {index < expense.shares.length - 1 ? (
                        <View style={{ backgroundColor: clay.cardBorder }} className="h-px w-full" />
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>

            {/* ── Note (Optional) ── */}
            {expense.note ? (
              <View className="gap-2">
                <Text style={{ color: clay.textMuted }} className="px-1 text-xs font-bold uppercase tracking-wider">
                  Note
                </Text>
                <View
                  style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
                  className="rounded-3xl border p-4 shadow-sm"
                >
                  <Text selectable style={{ color: clay.textPrimary }} className="text-sm leading-5">
                    {expense.note}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* ── Metadata ── */}
            <View className="gap-1 px-1 pt-1">
              <Text style={{ color: clay.textMuted }} className="text-xs">
                Added by {nameFor(expense.createdById)}
              </Text>
              {expense.updatedAt ? (
                <Text style={{ color: clay.textMuted }} className="text-xs">
                  Last edited by {expense.updatedById ? nameFor(expense.updatedById) : "a group member"} ·{" "}
                  {formatRelativeTime(expense.updatedAt)}
                </Text>
              ) : null}
            </View>

            {/* ── Bottom Action Buttons ── */}
            <View className="gap-3 pt-3">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit expense"
                disabled={isDeleting}
                onPress={() => {
                  router.push({
                    pathname: "/groups/[groupId]/add-expense",
                    params: { groupId: group.id, expenseId },
                  });
                }}
                className="h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-[#F5D298] px-5 shadow-sm active:opacity-75 disabled:opacity-50"
              >
                <Ionicons name="pencil" size={17} color={clay.heroText} />
                <Text style={{ color: clay.heroText }} className="text-base font-extrabold">
                  Edit Expense
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete expense"
                disabled={isDeleting}
                onPress={confirmDelete}
                style={{
                  backgroundColor: clay.isDark ? "rgba(251, 113, 133, 0.12)" : "#FEE2E2",
                  borderColor: clay.isDark ? "rgba(251, 113, 133, 0.25)" : "#FECACA",
                }}
                className="h-14 flex-row items-center justify-center gap-2 rounded-2xl border px-5 active:opacity-75 disabled:opacity-50"
              >
                {isDeleting ? (
                  <ActivityIndicator color="#FB7185" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={17} color="#FB7185" />
                    <Text className="text-base font-bold text-[#FB7185]">Delete Expense</Text>
                  </>
                )}
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
