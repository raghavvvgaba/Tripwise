import { Ionicons } from "@expo/vector-icons";
import { Link, router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { GroupCover } from "@/components/group-cover";
import { PrimaryButton } from "@/components/primary-button";
import { useThemeColors } from "@/constants/theme";
import { getGroupMembers, type GroupMember } from "@/lib/group-invites";
import { listGroupExpenses } from "@/lib/expenses";
import { listGroupPayments } from "@/lib/payments";
import { useSharedGroupsStore } from "@/store/use-shared-groups-store";
import type { SharedGroup } from "@/types/shared-group";
import type { SharedExpense } from "@/types/shared-expense";
import type { SharedPayment } from "@/types/shared-payment";
import { showError } from "@/utils/dialogs";
import { formatMoney } from "@/utils/money";
import { formatExpenseDate, formatPaymentDate, formatRelativeTime } from "@/utils/date";
import { getSharedMemberBalances, getSharedSettlements, type SharedSettlement } from "@/utils/shared-expenses";

type GroupView = "expenses" | "balances" | "settle";

const views: { id: GroupView; label: string }[] = [
  { id: "expenses", label: "Expenses" },
  { id: "balances", label: "Balances" },
  { id: "settle", label: "Settle" },
];

function participantSummary(expense: SharedExpense, members: GroupMember[] | null, currentUserId: string | null): string {
  const names = expense.shares.map((share) =>
    share.userId === currentUserId
      ? "you"
      : members?.find((member) => member.userId === share.userId)?.name ?? "a member",
  );
  if (names.length <= 2) return `Split among ${names.join(" and ")}`;
  return `Split among ${names.slice(0, 2).join(", ")} + ${names.length - 2}`;
}

export default function GroupDetailsScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const group = useSharedGroupsStore((state) => state.groups.find((item) => item.id === groupId));
  const isLoading = useSharedGroupsStore((state) => state.isLoading);

  if (group) {
    return group.deletedAt
      ? <DeletedSharedGroup key={group.id} group={group} />
      : <SharedGroupDetails key={group.id} group={group} />;
  }
  if (isLoading) {
    return <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>;
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="px-5 py-8">
      <EmptyState icon="search-outline" title="Group not found" message="This group may have been removed." />
    </ScrollView>
  );
}

function SharedGroupDetails({ group }: { group: SharedGroup }) {
  const colors = useThemeColors();
  const currentUserId = useSharedGroupsStore((state) => state.userId);
  const loadGroups = useSharedGroupsStore((state) => state.loadGroups);
  const [members, setMembers] = useState<GroupMember[] | null>(null);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<SharedExpense[] | null>(null);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [payments, setPayments] = useState<SharedPayment[] | null>(null);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [sharedView, setSharedView] = useState<GroupView>("expenses");

  const refreshMembers = useCallback(async () => {
    setIsLoadingMembers(true);
    try {
      const nextMembers = await getGroupMembers(group.id);
      setMembers(nextMembers);
      setMemberError(null);
    } catch (error) {
      setMembers(null);
      setMemberError(error instanceof Error ? error.message : "Could not load members.");
    } finally {
      setIsLoadingMembers(false);
    }
  }, [group.id]);

  const refreshExpenses = useCallback(async () => {
    setIsLoadingExpenses(true);
    try {
      setExpenses(await listGroupExpenses(group.id));
      setExpenseError(null);
    } catch (error) {
      setExpenses(null);
      setExpenseError(error instanceof Error ? error.message : "Could not load expenses.");
    } finally {
      setIsLoadingExpenses(false);
    }
  }, [group.id]);

  const refreshPayments = useCallback(async () => {
    setIsLoadingPayments(true);
    try {
      setPayments(await listGroupPayments(group.id));
      setPaymentError(null);
    } catch (error) {
      setPayments(null);
      setPaymentError(error instanceof Error ? error.message : "Could not load payments.");
    } finally {
      setIsLoadingPayments(false);
    }
  }, [group.id]);

  useFocusEffect(useCallback(() => {
    if (currentUserId) void loadGroups(currentUserId);
    void refreshMembers();
    void refreshExpenses();
    void refreshPayments();
  }, [currentUserId, loadGroups, refreshMembers, refreshExpenses, refreshPayments]));

  const balances = members && expenses && payments ? getSharedMemberBalances(members, expenses, payments) : null;
  const settlements = balances ? getSharedSettlements(balances) : null;
  const yourSettlements = settlements?.filter((item) => item.from.userId === currentUserId || item.to.userId === currentUserId) ?? [];
  const otherSettlements = settlements?.filter((item) => item.from.userId !== currentUserId && item.to.userId !== currentUserId) ?? [];
  const currentBalance = balances?.find((balance) => balance.member.userId === currentUserId);
  const totalMinor = expenses?.reduce((total, expense) => total + expense.amountMinor, 0);

  function settlementCard(settlement: SharedSettlement) {
    const fromName = settlement.from.userId === currentUserId ? "You" : settlement.from.name;
    const toName = settlement.to.userId === currentUserId ? "you" : settlement.to.name;
    return (
      <View key={`${settlement.from.userId}-${settlement.to.userId}`} className="card gap-3 p-4">
        <View className="flex-row items-center justify-between gap-3">
          <Text className="flex-1 font-semibold text-ink">{fromName} pay{fromName === "You" ? "" : "s"} {toName}</Text>
          <Text selectable className="font-bold text-ink">{formatMoney(settlement.amountMinor / 100, group.currency)}</Text>
        </View>
        <Link href={{ pathname: "/groups/[groupId]/record-payment", params: {
          groupId: group.id,
          payerId: settlement.from.userId,
          recipientId: settlement.to.userId,
          amountMinor: String(settlement.amountMinor),
        } }} asChild>
          <PrimaryButton label="Record payment" variant="secondary" />
        </Link>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{
        title: group.name,
        headerRight: () => (
          <Link href={`/groups/${group.id}/settings`} asChild>
            <Pressable accessibilityRole="button" accessibilityLabel="Group settings" className="min-h-11 min-w-11 items-center justify-center">
              <Ionicons name="settings-outline" size={22} color={colors.ink} />
            </Pressable>
          </Link>
        ),
      }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="w-full max-w-4xl self-center gap-6 px-5 pb-12 pt-5 md:px-8 lg:py-10"
      >
        <GroupCover group={group} />
        <View className="card gap-2 p-5">
          <View className="flex-row items-start justify-between gap-4">
            <View className="flex-1 gap-1">
              <Text className="text-xl font-bold text-ink">{group.name}</Text>
              <Text className="text-sm text-muted">Default currency: {group.currency}</Text>
            </View>
            {totalMinor !== undefined ? (
              <View className="items-end gap-1">
                <Text className="text-xs text-muted">Total spending</Text>
                <Text selectable className="text-xl font-bold text-ink">{formatMoney(totalMinor / 100, group.currency)}</Text>
              </View>
            ) : null}
          </View>
          {currentBalance ? (
            <Text className={`pt-2 font-semibold ${currentBalance.netMinor >= 0 ? "text-brand-700" : "text-coral"}`}>
              {currentBalance.netMinor > 0
                ? `You are owed ${formatMoney(currentBalance.netMinor / 100, group.currency)}`
                : currentBalance.netMinor < 0
                  ? `You owe ${formatMoney(-currentBalance.netMinor / 100, group.currency)}`
                  : "You are settled up"}
            </Text>
          ) : null}
          <View className="flex-row items-center justify-between gap-3 pt-2">
            <Text className="font-semibold text-ink">
              {members === null ? "Members" : `${members.length} ${members.length === 1 ? "member" : "members"}`}
            </Text>
            <Pressable accessibilityRole="button" disabled={isLoadingMembers} onPress={() => void refreshMembers()}>
              <Text className="font-semibold text-brand-700">Refresh</Text>
            </Pressable>
          </View>
          {isLoadingMembers && members === null ? <ActivityIndicator className="self-start" /> : null}
          {memberError ? <Text selectable className="text-sm text-coral">{memberError}</Text> : null}
          {members ? (
            <View className="gap-3 pt-2">
              {members.map((member) => (
                <View key={member.userId} className="flex-row items-center gap-3">
                  <View className="h-9 w-9 items-center justify-center rounded-full bg-brand-50">
                    <Text className="text-sm font-bold text-brand-700">{member.name[0]?.toUpperCase()}</Text>
                  </View>
                  <Text className="flex-1 font-medium text-ink">
                    {member.name}{member.userId === currentUserId ? " (you)" : ""}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <Link href={`/groups/${group.id}/invite`} asChild>
          <PrimaryButton label="Invite members" variant="secondary" />
        </Link>

        <View className="flex-row rounded-2xl bg-line p-1">
          {views.map((option) => (
            <Pressable
              key={option.id}
              onPress={() => setSharedView(option.id)}
              className={`min-h-11 flex-1 items-center justify-center rounded-xl ${sharedView === option.id ? "bg-surface" : ""}`}
            >
              <Text className={`font-semibold ${sharedView === option.id ? "text-ink" : "text-muted"}`}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {sharedView === "expenses" ? (
          <View className="gap-4">
            <View className="flex-row items-center justify-between px-1">
              <Text className="section-label">Group expenses</Text>
              <Pressable accessibilityRole="button" disabled={isLoadingExpenses} onPress={() => void refreshExpenses()}>
                <Text className="font-semibold text-brand-700">Refresh</Text>
              </Pressable>
            </View>
            <Link href={`/groups/${group.id}/add-expense`} asChild>
              <PrimaryButton label="Add expense" />
            </Link>
            {isLoadingExpenses && expenses === null ? <ActivityIndicator /> : null}
            {expenseError ? (
              <View className="card gap-2 p-4">
                <Text selectable className="text-sm text-coral">{expenseError}</Text>
                <Pressable onPress={() => void refreshExpenses()}>
                  <Text className="font-semibold text-brand-700">Retry</Text>
                </Pressable>
              </View>
            ) : null}
            {expenses && !expenseError && expenses.length === 0 ? (
              <EmptyState icon="receipt-outline" title="No shared expenses yet" message="Add the first shared cost for this group." />
            ) : null}
            {expenses && expenses.length > 0 ? (
              <View className="card px-4">
                {expenses.map((expense, index) => (
                  <View key={expense.id}>
                    <Link href={{ pathname: "/expenses/[expenseId]", params: { expenseId: expense.id, groupId: group.id } }} asChild>
                      <Pressable className="min-h-16 flex-row items-center gap-3 py-3 active:opacity-60">
                        <View className="flex-1 gap-1">
                          <View className="flex-row items-center gap-2">
                            <Text className="flex-shrink font-semibold text-ink" numberOfLines={1}>{expense.description}</Text>
                            {expense.updatedAt ? <Text className="text-xs font-semibold text-brand-700">Edited</Text> : null}
                          </View>
                          <Text className="text-xs text-muted" numberOfLines={1}>
                            {members?.find((member) => member.userId === expense.paidById)?.name ?? "A member"} paid · {formatExpenseDate(`${expense.expenseDate}T00:00:00`)}
                          </Text>
                          <Text className="text-xs text-muted" numberOfLines={1}>
                            {participantSummary(expense, members, currentUserId)}
                          </Text>
                        </View>
                        <Text selectable className="font-bold text-ink">{formatMoney(expense.amountMinor / 100, group.currency)}</Text>
                      </Pressable>
                    </Link>
                    {index < expenses.length - 1 ? <View className="h-px bg-line" /> : null}
                  </View>
                ))}
              </View>
            ) : null}
            {paymentError ? <Text selectable className="px-1 text-sm text-coral">{paymentError}</Text> : null}
            {payments && payments.length > 0 ? (
              <View className="gap-3 pt-2">
                <Text className="section-label px-1">Recorded payments</Text>
                <View className="card px-4">
                  {payments.map((payment, index) => (
                    <View key={payment.id}>
                      <View className="flex-row items-center gap-3 py-4">
                        <View className="flex-1 gap-1">
                          <Text className="font-semibold text-ink" numberOfLines={1}>
                            {members?.find((member) => member.userId === payment.payerId)?.name ?? "A member"} paid {members?.find((member) => member.userId === payment.recipientId)?.name ?? "a member"}
                          </Text>
                          <Text className="text-xs text-muted">
                            Paid on {formatPaymentDate(payment.paymentDate)} · Recorded by {payment.recordedById === currentUserId ? "you" : members?.find((member) => member.userId === payment.recordedById)?.name ?? "a member"} {formatRelativeTime(payment.createdAt)}
                          </Text>
                        </View>
                        <Text selectable className="font-bold text-ink">{formatMoney(payment.amountMinor / 100, group.currency)}</Text>
                      </View>
                      {index < payments.length - 1 ? <View className="h-px bg-line" /> : null}
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : sharedView === "balances" ? (
          <View className="gap-3">
            {expenseError ? <Text selectable className="px-1 text-sm text-coral">{expenseError}</Text> : null}
            {paymentError ? <Text selectable className="px-1 text-sm text-coral">{paymentError}</Text> : null}
            {balances === null && !memberError && !expenseError && !paymentError ? <ActivityIndicator /> : null}
            {balances ? (
              <View className="card px-4">
                {balances.map((balance, index) => (
                  <View key={balance.member.userId}>
                    <View className="flex-row items-center gap-3 py-4">
                      <View className="flex-1 gap-1">
                        <Text className="font-semibold text-ink">
                          {balance.member.name}{balance.member.userId === currentUserId ? " (you)" : ""}
                        </Text>
                        <Text className="text-xs text-muted">
                          Expenses paid {formatMoney(balance.paidMinor / 100, group.currency)} · Share {formatMoney(balance.shareMinor / 100, group.currency)}
                        </Text>
                      </View>
                      <Text selectable className={`font-bold ${balance.netMinor >= 0 ? "text-brand-700" : "text-coral"}`}>
                        {formatMoney(balance.netMinor / 100, group.currency, true)}
                      </Text>
                    </View>
                    {index < balances.length - 1 ? <View className="h-px bg-line" /> : null}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <View className="gap-5">
            <View className="flex-row items-center justify-between px-1">
              <Text className="section-label">Suggested payments</Text>
              <Pressable accessibilityRole="button" disabled={isLoadingMembers || isLoadingExpenses || isLoadingPayments} onPress={() => {
                void refreshMembers();
                void refreshExpenses();
                void refreshPayments();
              }}>
                <Text className="font-semibold text-brand-700">Refresh</Text>
              </Pressable>
            </View>
            <Text className="px-1 text-sm text-muted">Pay outside the app, then record it here to update everyone’s balances.</Text>
            {memberError ? <Text selectable className="px-1 text-sm text-coral">{memberError}</Text> : null}
            {expenseError ? <Text selectable className="px-1 text-sm text-coral">{expenseError}</Text> : null}
            {paymentError ? <Text selectable className="px-1 text-sm text-coral">{paymentError}</Text> : null}
            {settlements === null && !memberError && !expenseError && !paymentError ? <ActivityIndicator /> : null}
            {settlements && settlements.length === 0 ? (
              <EmptyState icon="checkmark-circle-outline" title="All settled up" message="There are no payments to record right now." />
            ) : null}
            {settlements && settlements.length > 0 ? (
              <>
                <View className="gap-3">
                  <Text className="section-label px-1">Your payments</Text>
                  {yourSettlements.length > 0 ? yourSettlements.map(settlementCard) : (
                    <Text className="px-1 text-sm text-muted">You’re settled up.</Text>
                  )}
                </View>
                {otherSettlements.length > 0 ? (
                  <View className="gap-3">
                    <Text className="section-label px-1">Other group payments</Text>
                    {otherSettlements.map(settlementCard)}
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        )}

      </ScrollView>
    </>
  );
}

function DeletedSharedGroup({ group }: { group: SharedGroup }) {
  const restoreGroup = useSharedGroupsStore((state) => state.restoreGroup);
  const [isRestoring, setIsRestoring] = useState(false);

  async function restore() {
    if (isRestoring) return;
    setIsRestoring(true);
    try {
      await restoreGroup(group.id);
    } catch (cause) {
      showError("Could not restore group", cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setIsRestoring(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: group.name }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="w-full max-w-3xl self-center gap-5 px-5 pb-12 pt-5 md:px-8 lg:py-10">
        <EmptyState icon="trash-outline" title="Group deleted" message="This group is hidden for all members. Restore it to see its expenses again." />
        <PrimaryButton label="Restore group" loading={isRestoring} onPress={() => void restore()} />
      </ScrollView>
    </>
  );
}
