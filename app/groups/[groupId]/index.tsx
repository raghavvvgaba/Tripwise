import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { ExpenseRow } from "@/components/expense-row";
import { MemberAvatar } from "@/components/member-avatar";
import { PrimaryButton } from "@/components/primary-button";
import { useGroupsStore } from "@/store/use-groups-store";
import type { Settlement } from "@/types/models";
import { getActiveExpenses, getGroupTotal, getMemberBalances, getSettlements } from "@/utils/balances";
import { formatMoney } from "@/utils/money";

type GroupView = "expenses" | "balances" | "settle";

const views: { id: GroupView; label: string }[] = [
  { id: "expenses", label: "Expenses" },
  { id: "balances", label: "Balances" },
  { id: "settle", label: "Settle" },
];

export default function GroupDetailsScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const group = useGroupsStore((state) => state.groups.find((item) => item.id === groupId));
  const currentUserId = useGroupsStore((state) => state.currentUserId);
  const archiveGroup = useGroupsStore((state) => state.archiveGroup);
  const unarchiveGroup = useGroupsStore((state) => state.unarchiveGroup);
  const deleteGroup = useGroupsStore((state) => state.deleteGroup);
  const recordSettlement = useGroupsStore((state) => state.recordSettlement);
  const [view, setView] = useState<GroupView>("expenses");
  const [showMembers, setShowMembers] = useState(false);

  if (!group) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="px-5 py-8">
        <EmptyState emoji="🔎" title="Group not found" message="This group may have been removed." />
      </ScrollView>
    );
  }

  const expenses = getActiveExpenses(group).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const deletedExpenses = group.expenses.filter((expense) => expense.deletedAt);
  const balances = getMemberBalances(group);
  const settlements = getSettlements(group);
  const currentBalance = balances.find((balance) => balance.member.id === currentUserId);
  const activeGroupId = group.id;

  function confirmArchive() {
    Alert.alert(
      "Archive this group?",
      "It will leave your active groups, but its expenses will stay available in local storage.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Archive", style: "destructive", onPress: () => archiveGroup(activeGroupId) },
      ],
    );
  }

  function confirmDeleteGroup() {
    Alert.alert(
      "Delete this group permanently?",
      "All locally stored expenses and balances in this group will be removed. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete permanently",
          style: "destructive",
          onPress: () => {
            deleteGroup(activeGroupId);
            router.replace("/");
          },
        },
      ],
    );
  }

  function handleMarkSettlementPaid(settlement: Settlement) {
    Alert.alert(
      "Mark settlement as paid?",
      `Record a payment of ${formatMoney(settlement.amount, group!.currency)} from ${settlement.from.name} to ${settlement.to.name}? This will settle this balance.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark as paid",
          onPress: () => {
            recordSettlement(group!.id, settlement.from.id, settlement.to.id, settlement.amount);
          },
        },
      ],
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
        contentContainerClassName="gap-6 px-5 pb-12 pt-4"
        showsVerticalScrollIndicator={false}
      >
        {group.archivedAt ? (
          <View className="flex-row items-center justify-between gap-4 rounded-2xl bg-orange-50 px-4 py-3">
            <View className="flex-1 gap-0.5">
              <Text className="font-semibold text-orange-800">Archived group</Text>
              <Text className="text-xs text-orange-700">Its history is safe and still available.</Text>
            </View>
            <Pressable onPress={() => unarchiveGroup(group.id)} className="rounded-xl bg-white px-3 py-2">
              <Text className="text-sm font-bold text-orange-800">Restore</Text>
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

              <View className="border-t border-line p-4">
                <Link href={`/invite/${group.inviteCode}`} asChild>
                  <PrimaryButton label="Invite members" variant="secondary" />
                </Link>
              </View>
            </View>
          ) : null}
        </View>

        <View className="flex-row rounded-2xl bg-line p-1">
          {views.map((option) => (
            <Pressable
              key={option.id}
              onPress={() => setView(option.id)}
              className={`min-h-10 flex-1 items-center justify-center rounded-xl ${view === option.id ? "bg-white" : ""}`}
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
              <Pressable className="min-h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-brand-600 active:bg-brand-700">
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
              <EmptyState emoji="🧾" title="No expenses yet" message="Add the first shared cost for this group." />
            )}

            {deletedExpenses.length > 0 ? (
              <View className="gap-2">
                <Text className="section-label px-1">Recently deleted</Text>
                {deletedExpenses.map((expense) => (
                  <Link
                    key={expense.id}
                    href={{ pathname: "/expenses/[expenseId]", params: { expenseId: expense.id, groupId: group.id } }}
                    asChild
                  >
                    <Pressable className="flex-row items-center justify-between rounded-2xl bg-red-50 px-4 py-3 active:bg-red-100">
                      <Text className="font-medium text-red-700">{expense.description}</Text>
                      <Text className="text-sm font-semibold text-red-700">View & restore</Text>
                    </Pressable>
                  </Link>
                ))}
              </View>
            ) : null}
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
              <EmptyState emoji="✓" title="All settled up" message="There are no payments to make right now." />
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
