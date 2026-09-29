import { Ionicons } from "@expo/vector-icons";
import { Link, router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { ExpenseRow } from "@/components/expense-row";
import { GroupCover } from "@/components/group-cover";
import { MemberAvatar } from "@/components/member-avatar";
import { PrimaryButton } from "@/components/primary-button";
import { useThemeColors } from "@/constants/theme";
import { getGroupMembers, type GroupMember } from "@/lib/group-invites";
import { listGroupExpenses } from "@/lib/expenses";
import { useGroupsStore } from "@/store/use-groups-store";
import { useSharedGroupsStore } from "@/store/use-shared-groups-store";
import type { SharedGroup } from "@/types/shared-group";
import type { SharedExpense } from "@/types/shared-expense";
import type { Settlement } from "@/types/models";
import { confirmAction, showError } from "@/utils/dialogs";
import { getActiveExpenses, getGroupTotal, getMemberBalances, getSettlements } from "@/utils/balances";
import { formatMoney } from "@/utils/money";
import { formatExpenseDate } from "@/utils/date";
import { getSharedMemberBalances } from "@/utils/shared-expenses";

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
  const sharedGroup = useSharedGroupsStore((state) => state.groups.find((item) => item.id === groupId));
  const sharedLoading = useSharedGroupsStore((state) => state.isLoading);
  const group = useGroupsStore((state) => state.groups.find((item) => item.id === groupId));
  const currentUserId = useGroupsStore((state) => state.currentUserId);
  const archiveGroup = useGroupsStore((state) => state.archiveGroup);
  const unarchiveGroup = useGroupsStore((state) => state.unarchiveGroup);
  const deleteGroup = useGroupsStore((state) => state.deleteGroup);
  const recordSettlement = useGroupsStore((state) => state.recordSettlement);
  const [view, setView] = useState<GroupView>("expenses");
  const [showMembers, setShowMembers] = useState(false);

  if (sharedGroup) {
    return sharedGroup.deletedAt
      ? <DeletedSharedGroup key={sharedGroup.id} group={sharedGroup} />
      : <SharedGroupDetails key={sharedGroup.id} group={sharedGroup} />;
  }
  if (sharedLoading) {
    return <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>;
  }

  if (!group) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="px-5 py-8">
        <EmptyState icon="search-outline" title="Group not found" message="This group may have been removed." />
      </ScrollView>
    );
  }

  const expenses = getActiveExpenses(group).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const balances = getMemberBalances(group);
  const settlements = getSettlements(group);
  const currentBalance = balances.find((balance) => balance.member.id === currentUserId);
  const activeGroupId = group.id;

  function confirmArchive() {
    confirmAction(
      "Archive this group?",
      "It will leave your active groups, but its expenses will stay available in local storage.",
      "Archive",
      () => archiveGroup(activeGroupId),
    );
  }

  function confirmDeleteGroup() {
    confirmAction(
      "Delete this group permanently?",
      "All locally stored expenses and balances in this group will be removed. This cannot be undone.",
      "Delete permanently",
      () => {
        deleteGroup(activeGroupId);
        router.replace("/");
      },
    );
  }

  function handleMarkSettlementPaid(settlement: Settlement) {
    confirmAction(
      "Mark settlement as paid?",
      `Record a payment of ${formatMoney(settlement.amount, group!.currency)} from ${settlement.from.name} to ${settlement.to.name}? This will settle this balance.`,
      "Mark as paid",
      () => recordSettlement(group!.id, settlement.from.id, settlement.to.id, settlement.amount),
      false,
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: group.name,
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="w-full max-w-4xl self-center gap-6 px-5 pb-12 pt-5 md:px-8 lg:py-10"
        showsVerticalScrollIndicator={false}
      >
        {group.archivedAt ? (
          <View className="flex-row items-center justify-between gap-4 rounded-2xl bg-orange-50 px-4 py-3 dark:bg-orange-950">
            <View className="flex-1 gap-0.5">
              <Text className="font-semibold text-orange-800 dark:text-orange-200">Archived group</Text>
              <Text className="text-xs text-orange-700 dark:text-orange-300">Its history is safe and still available.</Text>
            </View>
            <Pressable onPress={() => unarchiveGroup(group.id)} className="rounded-xl bg-surface px-3 py-2">
              <Text className="text-sm font-bold text-orange-800 dark:text-orange-200">Restore</Text>
            </Pressable>
          </View>
        ) : null}

        <View className="card overflow-hidden p-5">
          <View className="flex-row items-start justify-between gap-4">
            <View className="flex-1">
              <Text className="text-xl font-bold text-ink" numberOfLines={1}>
                {group.name}
              </Text>
            </View>
            <View className="items-end gap-1">
              <Text className="text-xs text-muted">Total spending</Text>
              <Text selectable className="text-2xl font-bold text-ink">
                {formatMoney(getGroupTotal(group), group.currency)}
              </Text>
            </View>
          </View>

          <View className="my-5 h-px bg-line" />

          <View className="gap-1">
            <Text className="text-xs text-muted">Your balance</Text>
            <Text
              selectable
              className={`text-lg font-bold ${(currentBalance?.net ?? 0) >= 0 ? "text-brand-700" : "text-coral"}`}
            >
              {(currentBalance?.net ?? 0) > 0.009
                ? `You are owed ${formatMoney(currentBalance?.net ?? 0, group.currency)}`
                : (currentBalance?.net ?? 0) < -0.009
                  ? `You owe ${formatMoney(currentBalance?.net ?? 0, group.currency)}`
                  : "You are settled up"}
            </Text>
          </View>
        </View>

        <View className="card overflow-hidden">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showMembers }}
            onPress={() => setShowMembers((value) => !value)}
            className="min-h-16 flex-row items-center gap-3 px-4 py-3 active:bg-canvas"
          >
            <View className="flex-row items-center">
              {group.members.slice(0, 3).map((member, index) => (
                <View key={member.id} className={index === 0 ? "" : "-ml-2"}>
                  <MemberAvatar member={member} size="sm" />
                </View>
              ))}
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="font-semibold text-ink">Members</Text>
              <Text className="text-xs text-muted">
                {group.members.length} {group.members.length === 1 ? "person" : "people"}
              </Text>
            </View>
            <Text className="text-xl text-muted" accessibilityElementsHidden>
              {showMembers ? "⌃" : "⌄"}
            </Text>
          </Pressable>

          {showMembers ? (
            <View className="border-t border-line">
              <View className="px-4">
                {group.members.map((member, index) => (
                  <View key={member.id}>
                    <View className="flex-row items-center gap-3 py-3">
                      <MemberAvatar member={member} size="sm" />
                      <View className="flex-1 gap-0.5">
                        <Text className="font-medium text-ink">
                          {member.name}
                          {member.id === currentUserId ? " (you)" : ""}
                        </Text>
                        {member.isPlaceholder ? (
                          <Text className="text-xs text-muted">Waiting to join</Text>
                        ) : null}
                      </View>
                    </View>
                    {index < group.members.length - 1 ? <View className="h-px bg-line" /> : null}
                  </View>
                ))}
              </View>

            </View>
          ) : null}
        </View>

        <View className="flex-row rounded-2xl bg-line p-1">
          {views.map((option) => (
            <Pressable
              key={option.id}
              onPress={() => setView(option.id)}
              className={`min-h-10 flex-1 items-center justify-center rounded-xl ${view === option.id ? "bg-surface" : ""}`}
            >
              <Text className={`text-sm font-semibold ${view === option.id ? "text-ink" : "text-muted"}`}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {view === "expenses" ? (
          <View className="gap-4">
            <Link href={`/groups/${group.id}/add-expense`} asChild>
              <Pressable className="min-h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-brand-600 active:bg-[#086B49]">
                <Text className="text-xl leading-6 text-white">＋</Text>
                <Text className="font-semibold text-white">Add expense</Text>
              </Pressable>
            </Link>

            {expenses.length > 0 ? (
              <View className="card px-4">
                {expenses.map((expense, index) => (
                  <View key={expense.id}>
                    <ExpenseRow expense={expense} members={group.members} groupId={group.id} currency={group.currency} />
                    {index < expenses.length - 1 ? <View className="h-px bg-line" /> : null}
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState icon="receipt-outline" title="No expenses yet" message="Add the first shared cost for this group." />
            )}

          </View>
        ) : null}

        {view === "balances" ? (
          <View className="gap-3">
            <Text className="section-label px-1">Member breakdown</Text>
            <View className="card px-4">
              {balances.map((balance, index) => (
                <View key={balance.member.id}>
                  <View className="flex-row items-center gap-3 py-4">
                    <MemberAvatar member={balance.member} />
                    <View className="flex-1 gap-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="font-semibold text-ink">{balance.member.name}</Text>
                        {balance.member.isPlaceholder ? (
                          <Text className="text-[10px] font-medium text-muted">Not joined</Text>
                        ) : null}
                      </View>
                      <Text className="text-xs text-muted">
                        Paid {formatMoney(balance.paid, group.currency)} · Share {formatMoney(balance.share, group.currency)}
                      </Text>
                    </View>
                    <Text
                      selectable
                      className={`font-bold ${balance.net > 0.009 ? "text-brand-700" : balance.net < -0.009 ? "text-coral" : "text-muted"}`}
                    >
                      {balance.net > 0.009 ? "+" : balance.net < -0.009 ? "−" : ""}
                      {formatMoney(balance.net, group.currency)}
                    </Text>
                  </View>
                  {index < balances.length - 1 ? <View className="h-px bg-line" /> : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {view === "settle" ? (
          <View className="gap-3">
            <View className="gap-1 px-1">
              <Text className="section-label">Suggested payments</Text>
              <Text className="text-sm leading-5 text-muted">A practical plan with as few transfers as possible.</Text>
            </View>
            {settlements.length > 0 ? (
              settlements.map((settlement) => (
                <View key={`${settlement.from.id}-${settlement.to.id}`} className="card p-4 gap-3">
                  <View className="flex-row items-center gap-3">
                    <MemberAvatar member={settlement.from} />
                    <View className="flex-1">
                      <Text className="text-sm text-muted">
                        <Text className="font-semibold text-ink">{settlement.from.name}</Text> pays
                      </Text>
                      <Text className="font-semibold text-ink">{settlement.to.name}</Text>
                    </View>
                    <Text selectable className="text-lg font-bold text-ink">
                      {formatMoney(settlement.amount, group.currency)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleMarkSettlementPaid(settlement)}
                    className="min-h-11 flex-row items-center justify-center rounded-xl border border-brand-100 bg-brand-50 active:bg-brand-100"
                  >
                    <Text className="text-sm font-semibold text-brand-700">Mark as paid</Text>
                  </Pressable>
                </View>
              ))
            ) : (
              <EmptyState icon="checkmark-circle-outline" title="All settled up" message="There are no payments to make right now." />
            )}
          </View>
        ) : null}

        <View className="gap-3 pt-2">
          {!group.archivedAt ? (
            <PrimaryButton label="Archive group" variant="danger" onPress={confirmArchive} />
          ) : (
            <PrimaryButton label="Delete group permanently" variant="danger" onPress={confirmDeleteGroup} />
          )}
        </View>
      </ScrollView>
    </>
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
  const [sharedView, setSharedView] = useState<"expenses" | "balances">("expenses");

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

  useFocusEffect(useCallback(() => {
    if (currentUserId) void loadGroups(currentUserId);
    void refreshMembers();
    void refreshExpenses();
  }, [currentUserId, loadGroups, refreshMembers, refreshExpenses]));

  const balances = members && expenses ? getSharedMemberBalances(members, expenses) : null;
  const currentBalance = balances?.find((balance) => balance.member.userId === currentUserId);
  const totalMinor = expenses?.reduce((total, expense) => total + expense.amountMinor, 0);

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
          {(["expenses", "balances"] as const).map((option) => (
            <Pressable
              key={option}
              onPress={() => setSharedView(option)}
              className={`min-h-11 flex-1 items-center justify-center rounded-xl ${sharedView === option ? "bg-surface" : ""}`}
            >
              <Text className={`font-semibold ${sharedView === option ? "text-ink" : "text-muted"}`}>
                {option === "expenses" ? "Expenses" : "Balances"}
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
          </View>
        ) : (
          <View className="gap-3">
            {expenseError ? <Text selectable className="px-1 text-sm text-coral">{expenseError}</Text> : null}
            {balances === null && !memberError && !expenseError ? <ActivityIndicator /> : null}
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
                          Paid {formatMoney(balance.paidMinor / 100, group.currency)} · Share {formatMoney(balance.shareMinor / 100, group.currency)}
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
