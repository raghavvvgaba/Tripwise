import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getGroupMembers, type GroupMember } from "@/lib/group-invites";
import { listGroupExpenses } from "@/lib/expenses";
import { deleteGroupPayment, listGroupPayments } from "@/lib/payments";
import { useSharedGroupsStore } from "@/store/use-shared-groups-store";
import type { SharedGroup } from "@/types/shared-group";
import type { SharedExpense } from "@/types/shared-expense";
import type { SharedPayment } from "@/types/shared-payment";
import { confirmAction, showError } from "@/utils/dialogs";
import { formatMoney } from "@/utils/money";
import { formatExpenseDate, formatPaymentDate, formatRelativeTime } from "@/utils/date";
import { getSharedMemberBalances, getSharedSettlements, type SharedSettlement } from "@/utils/shared-expenses";

type GroupView = "expenses" | "balances" | "settle";

const views: { id: GroupView; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "expenses", label: "Activity", icon: "receipt-outline" },
  { id: "balances", label: "Balances", icon: "bar-chart-outline" },
  { id: "settle", label: "Settle Up", icon: "swap-horizontal-outline" },
];

const AVATAR_RING_COLORS = [
  "#38BDF8", // Sky blue
  "#FB923C", // Coral orange
  "#4ADE80", // Mint green
  "#C084FC", // Soft lavender
  "#FBBF24", // Warm amber
  "#F472B6", // Rose pink
];

/** Avatar circle with playful colorful 3D ring inspired by Sajon's UI */
function MemberAvatar({
  name,
  index = 0,
  size = 36,
  ringColor,
}: {
  name: string;
  index?: number;
  size?: number;
  ringColor?: string;
}) {
  const color = ringColor ?? AVATAR_RING_COLORS[index % AVATAR_RING_COLORS.length];
  const initial = (name.trim()[0] || "?").toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderColor: color,
        borderWidth: 2,
      }}
      className="items-center justify-center bg-[#2C274B]"
    >
      <Text className="text-xs font-black text-white">{initial}</Text>
    </View>
  );
}

/** Avatar stack for the ticket card */
function AvatarStack({ members }: { members: GroupMember[] }) {
  const visibleMembers = members.slice(0, 5);
  const extraCount = members.length - visibleMembers.length;

  return (
    <View className="flex-row items-center">
      {visibleMembers.map((member, i) => (
        <View key={member.userId} style={{ marginLeft: i === 0 ? 0 : -10, zIndex: 10 - i }}>
          <MemberAvatar name={member.name} index={i} size={30} />
        </View>
      ))}
      {extraCount > 0 ? (
        <View
          style={{ marginLeft: -10, zIndex: 5 }}
          className="h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-[#F5D298] bg-[#181528]"
        >
          <Text className="text-[10px] font-black text-white">+{extraCount}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Contextual calculation for user's share in an expense */
function userExpenseContext(
  expense: SharedExpense,
  currentUserId: string | null,
  currency?: import("@/types/models").CurrencyCode,
): { label: string; isPositive: boolean } | null {
  if (!currentUserId) return null;
  const userShare = expense.shares.find((s) => s.userId === currentUserId);
  if (!userShare) return null;

  if (expense.paidById === currentUserId) {
    const lentMinor = expense.amountMinor - userShare.amountMinor;
    if (lentMinor === 0) return null;
    return { label: `You lent ${formatMoney(lentMinor / 100, currency)}`, isPositive: true };
  }
  if (userShare.amountMinor === 0) return null;
  return { label: `You owe ${formatMoney(userShare.amountMinor / 100, currency)}`, isPositive: false };
}

/** Tactile clay empty state */
function ClayEmptyState({
  icon,
  title,
  message,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
}) {
  return (
    <View className="items-center gap-2.5 rounded-3xl border border-white/10 bg-[#262243] px-8 py-10">
      <View className="h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-[#322C54]">
        <Ionicons name={icon} size={28} color="#F5D298" />
      </View>
      <Text className="text-center text-lg font-bold text-white">{title}</Text>
      <Text className="text-center text-sm leading-5 text-[#A59ECB]">{message}</Text>
    </View>
  );
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
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#181528" }}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#F5D298" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#181528" }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="px-5 py-8">
        <ClayEmptyState icon="search-outline" title="Group not found" message="This group may have been removed." />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Main Group View ────────────────────────────────────────────────────────

function SharedGroupDetails({ group }: { group: SharedGroup }) {
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
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const deletingPayment = useRef(false);
  const paymentReadVersion = useRef(0);
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
    const version = ++paymentReadVersion.current;
    setIsLoadingPayments(true);
    try {
      const nextPayments = await listGroupPayments(group.id);
      if (version === paymentReadVersion.current) {
        setPayments(nextPayments);
        setPaymentError(null);
      }
    } catch (error) {
      if (version === paymentReadVersion.current) {
        setPayments(null);
        setPaymentError(error instanceof Error ? error.message : "Could not load payments.");
      }
    } finally {
      if (version === paymentReadVersion.current) setIsLoadingPayments(false);
    }
  }, [group.id]);

  async function removePayment(payment: SharedPayment) {
    if (deletingPayment.current || (currentUserId !== payment.payerId && currentUserId !== payment.recipientId)) return;
    deletingPayment.current = true;
    setDeletingPaymentId(payment.id);
    try {
      await deleteGroupPayment(group.id, payment.id);
      ++paymentReadVersion.current;
      setPayments((previous) => previous?.filter((item) => item.id !== payment.id) ?? null);
      await refreshPayments();
    } catch (error) {
      showError("Could not delete payment", error instanceof Error ? error.message : "Please try again.");
    } finally {
      deletingPayment.current = false;
      setDeletingPaymentId(null);
    }
  }

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
  const totalMinor = expenses?.reduce((total, expense) => total + expense.amountMinor, 0) ?? 0;
  const expenseCount = expenses?.length ?? 0;

  // ── Balance summary logic ──
  let balanceAmountText = "—";
  let balanceColor = "#FFFFFF";

  if (currentBalance) {
    if (currentBalance.netMinor > 0) {
      balanceAmountText = `+${formatMoney(currentBalance.netMinor / 100, group.currency)}`;
      balanceColor = "#4ADE80";
    } else if (currentBalance.netMinor < 0) {
      balanceAmountText = `-${formatMoney(-currentBalance.netMinor / 100, group.currency)}`;
      balanceColor = "#FB7185";
    } else {
      balanceAmountText = formatMoney(0, group.currency);
      balanceColor = "#FFFFFF";
    }
  }

  function settlementCard(settlement: SharedSettlement) {
    const fromName = settlement.from.userId === currentUserId ? "You" : settlement.from.name;
    const toName = settlement.to.userId === currentUserId ? "you" : settlement.to.name;
    const isYours = settlement.from.userId === currentUserId || settlement.to.userId === currentUserId;

    return (
      <View
        key={`${settlement.from.userId}-${settlement.to.userId}`}
        className="gap-3.5 rounded-3xl border border-white/10 bg-[#262243] p-4"
      >
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[#322C54]">
            <Ionicons name="swap-horizontal" size={20} color="#F5D298" />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-sm font-bold text-white">
              {fromName} pay{fromName === "You" ? "" : "s"} {toName}
            </Text>
            <Text selectable className="text-base font-extrabold text-[#F5D298]">
              {formatMoney(settlement.amountMinor / 100, group.currency)}
            </Text>
          </View>
        </View>
        {isYours ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({
              pathname: "/groups/[groupId]/record-payment",
              params: {
                groupId: group.id,
                payerId: settlement.from.userId,
                recipientId: settlement.to.userId,
                amountMinor: String(settlement.amountMinor),
              },
            })}
            className="min-h-12 flex-row items-center justify-center gap-2 rounded-2xl bg-[#F5D298] px-4 active:opacity-75"
          >
            <Ionicons name="card-outline" size={18} color="#181528" />
            <Text className="text-sm font-extrabold text-[#181528]">Record payment</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#181528" }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Top Bar Header (Sajon Tactile Header) ── */}
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          className="h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[#262243] active:opacity-75"
        >
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </Pressable>

        <View className="items-center">
          <Text className="text-[11px] font-bold uppercase tracking-widest text-[#A59ECB]">Bill Splitter</Text>
          <Text className="max-w-[200px] text-base font-extrabold text-white" numberOfLines={1}>
            {group.name}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Group settings"
          onPress={() => router.push(`/groups/${group.id}/settings`)}
          className="h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[#262243] active:opacity-75"
        >
          <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerClassName="w-full max-w-4xl self-center px-5 pb-28 gap-5"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Centerpiece: Sajon's Physical "Receipt Ticket" Card ── */}
        <View className="relative overflow-hidden rounded-3xl border border-[#FDE3B8] bg-[#F5D298] p-5">
          {/* Top Receipt Badge & Currency */}
          <View className="flex-row items-center justify-between">
            <View className="rounded-full bg-[#181528] px-3.5 py-1">
              <Text className="text-[11px] font-black tracking-widest text-[#F5D298]">RECEIPT</Text>
            </View>
            <View className="rounded-full bg-[#181528]/10 px-3 py-1">
              <Text className="text-xs font-bold text-[#4B4031]">{group.currency}</Text>
            </View>
          </View>

          {/* Group Name & Total Bill */}
          <View className="mt-4 flex-row items-baseline justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-xs font-bold uppercase tracking-wider text-[#6F614C]">Title</Text>
              <Text className="mt-0.5 text-xl font-black text-[#181528]" numberOfLines={1}>
                {group.name}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-xs font-bold uppercase tracking-wider text-[#6F614C]">Total Bill</Text>
              <Text selectable className="mt-0.5 text-2xl font-black text-[#181528]">
                {formatMoney(totalMinor / 100, group.currency)}
              </Text>
            </View>
          </View>

          {/* ── Perforated Tear Line with Semicircular Cutout Notches ── */}
          <View className="my-4 border-b border-dashed border-[#181528]/25" />
          {/* Left Cutout Punch Hole */}
          <View
            style={{ position: "absolute", left: -14, top: "52%", width: 28, height: 28, borderRadius: 14 }}
            className="bg-[#181528]"
          />
          {/* Right Cutout Punch Hole */}
          <View
            style={{ position: "absolute", right: -14, top: "52%", width: 28, height: 28, borderRadius: 14 }}
            className="bg-[#181528]"
          />

          {/* Bottom Split Info & Quick Action */}
          <View className="flex-row items-center justify-between pt-1">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View all members"
              onPress={() => router.push(`/groups/${group.id}/members`)}
              className="gap-1.5 active:opacity-75"
            >
              <View className="flex-row items-center gap-1">
                <Text className="text-xs font-bold tracking-wide text-[#6F614C]">Splitting With</Text>
                <Ionicons name="chevron-forward" size={11} color="#6F614C" />
              </View>
              {members && members.length > 0 ? (
                <AvatarStack members={members} />
              ) : (
                <Text className="text-xs text-[#6F614C]">1 member</Text>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Invite members"
              onPress={() => router.push(`/groups/${group.id}/invite`)}
              className="flex-row items-center gap-1.5 rounded-full bg-[#181528] px-3.5 py-2 active:opacity-75"
            >
              <Ionicons name="person-add-outline" size={14} color="#F5D298" />
              <Text className="text-xs font-extrabold text-white">Invite</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Summary Stats: 3 Tactile Clay Cards ── */}
        <View className="flex-row gap-2.5">
          {/* Your Balance */}
          <View className="flex-1 items-center justify-center rounded-3xl border border-white/10 bg-[#262243] p-3">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-[#A59ECB]">Your Balance</Text>
            <Text
              selectable
              className="mt-1 text-sm font-black"
              style={{ color: balanceColor }}
              numberOfLines={1}
            >
              {balanceAmountText}
            </Text>
            {currentBalance && currentBalance.netMinor > 0 ? (
              <View className="mt-1.5 rounded-full bg-[#183B2B] px-2 py-0.5">
                <Text className="text-[9px] font-bold text-[#4ADE80]">You are owed</Text>
              </View>
            ) : currentBalance && currentBalance.netMinor < 0 ? (
              <View className="mt-1.5 rounded-full bg-[#451C28] px-2 py-0.5">
                <Text className="text-[9px] font-bold text-[#FB7185]">You owe</Text>
              </View>
            ) : (
              <View className="mt-1.5 rounded-full bg-white/10 px-2 py-0.5">
                <Text className="text-[9px] font-bold text-[#A59ECB]">Settled</Text>
              </View>
            )}
          </View>

          {/* Total Expenses */}
          <View className="flex-1 items-center justify-center rounded-3xl border border-white/10 bg-[#262243] p-3">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-[#A59ECB]">Expenses</Text>
            <Text selectable className="mt-1 text-base font-black text-white">
              {expenseCount}
            </Text>
            <View className="mt-1.5 rounded-full bg-white/10 px-2 py-0.5">
              <Text className="text-[9px] font-bold text-[#D0CCE8]">recorded</Text>
            </View>
          </View>

          {/* Members */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View all members"
            onPress={() => router.push(`/groups/${group.id}/members`)}
            className="flex-1 items-center justify-center rounded-3xl border border-white/10 bg-[#262243] p-3 active:opacity-75"
          >
            <Text className="text-[10px] font-bold uppercase tracking-wider text-[#A59ECB]">Members</Text>
            <Text selectable className="mt-1 text-base font-black text-white">
              {members ? members.length : "…"}
            </Text>
            <View className="mt-1.5 rounded-full bg-white/10 px-2 py-0.5">
              <Text className="text-[9px] font-bold text-[#D0CCE8]">joined</Text>
            </View>
          </Pressable>
        </View>

        {/* ── Segmented Control Pill Bar ── */}
        <View className="flex-row rounded-full border border-white/5 bg-[#131020] p-1.5">
          {views.map((option) => {
            const isActive = sharedView === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => setSharedView(option.id)}
                className={`min-h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-full ${
                  isActive ? "bg-[#F5D298]" : "bg-transparent"
                } active:opacity-75`}
              >
                <Ionicons
                  name={option.icon}
                  size={15}
                  color={isActive ? "#181528" : "#A59ECB"}
                />
                <Text
                  className={`text-xs font-extrabold ${
                    isActive ? "text-[#181528]" : "text-[#A59ECB]"
                  }`}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── Tab Content ── */}
        {sharedView === "expenses" ? (
          <ExpensesTab
            group={group}
            members={members}
            expenses={expenses}
            payments={payments}
            isLoadingExpenses={isLoadingExpenses}
            expenseError={expenseError}
            paymentError={paymentError}
            deletingPaymentId={deletingPaymentId}
            currentUserId={currentUserId}
            onRefreshExpenses={refreshExpenses}
            onRemovePayment={removePayment}
          />
        ) : sharedView === "balances" ? (
          <BalancesTab
            group={group}
            balances={balances}
            currentUserId={currentUserId}
            memberError={memberError}
            expenseError={expenseError}
            paymentError={paymentError}
          />
        ) : (
          <SettleTab
            settlements={settlements}
            yourSettlements={yourSettlements}
            otherSettlements={otherSettlements}
            isLoadingMembers={isLoadingMembers}
            isLoadingExpenses={isLoadingExpenses}
            isLoadingPayments={isLoadingPayments}
            memberError={memberError}
            expenseError={expenseError}
            paymentError={paymentError}
            onRefresh={() => {
              void refreshMembers();
              void refreshExpenses();
              void refreshPayments();
            }}
            settlementCard={settlementCard}
          />
        )}
      </ScrollView>

      {/* ── Centered Floating Action Button ── */}
      {sharedView === "expenses" ? (
        <View pointerEvents="box-none" className="absolute bottom-6 left-0 right-0 z-20 items-center justify-center">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add new expense"
            onPress={() => router.push(`/groups/${group.id}/add-expense`)}
            className="h-14 w-14 items-center justify-center rounded-full bg-[#F5D298] shadow-xl active:opacity-75"
          >
            <Ionicons name="add" size={30} color="#181528" />
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

// ─── Expenses Tab ───────────────────────────────────────────────────────────

function ExpensesTab({
  group,
  members,
  expenses,
  payments,
  isLoadingExpenses,
  expenseError,
  paymentError,
  deletingPaymentId,
  currentUserId,
  onRefreshExpenses,
  onRemovePayment,
}: {
  group: SharedGroup;
  members: GroupMember[] | null;
  expenses: SharedExpense[] | null;
  payments: SharedPayment[] | null;
  isLoadingExpenses: boolean;
  expenseError: string | null;
  paymentError: string | null;
  deletingPaymentId: string | null;
  currentUserId: string | null;
  onRefreshExpenses: () => void;
  onRemovePayment: (payment: SharedPayment) => void;
}) {
  return (
    <View className="gap-4">
      {/* Loading / Error States */}
      {isLoadingExpenses && expenses === null ? (
        <ActivityIndicator color="#F5D298" className="py-6" />
      ) : null}

      {expenseError ? (
        <View className="gap-2 rounded-3xl border border-red-500/20 bg-[#262243] p-4">
          <Text selectable className="text-sm font-semibold text-[#FB7185]">{expenseError}</Text>
          <Pressable onPress={() => void onRefreshExpenses()} className="self-start">
            <Text className="text-sm font-bold text-[#F5D298]">Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Empty State */}
      {expenses && !expenseError && expenses.length === 0 ? (
        <ClayEmptyState
          icon="receipt-outline"
          title="No expenses yet"
          message="Add the first shared cost to split with the group."
        />
      ) : null}

      {/* Expense List (Tactile Cards) */}
      {expenses && expenses.length > 0 ? (
        <View className="gap-3">
          {expenses.map((expense) => {
            const context = userExpenseContext(expense, currentUserId, group.currency);
            const payerName = members?.find((m) => m.userId === expense.paidById)?.name ?? "A member";

            return (
              <Pressable
                key={expense.id}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: "/expenses/[expenseId]", params: { expenseId: expense.id, groupId: group.id } })}
                className="flex-row items-center gap-3.5 rounded-3xl border border-white/10 bg-[#262243] p-4 active:opacity-75"
              >
                {/* Category squircle */}
                <View className="h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[#322C54]">
                  <Ionicons name="receipt-outline" size={22} color="#F5D298" />
                </View>

                {/* Title & Payer info */}
                <View className="flex-1 gap-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-base font-bold text-white" numberOfLines={1}>
                      {expense.description}
                    </Text>
                    {expense.updatedAt ? (
                      <View className="rounded bg-[#4A4380] px-1.5 py-0.5">
                        <Text className="text-[10px] font-bold text-[#D0CCE8]">Edited</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="text-xs text-[#A59ECB]" numberOfLines={1}>
                    {payerName} paid · {formatExpenseDate(`${expense.expenseDate}T00:00:00`)}
                  </Text>
                </View>

                {/* Amount & User share badge */}
                <View className="items-end gap-1">
                  <Text selectable className="text-base font-black text-white">
                    {formatMoney(expense.amountMinor / 100, group.currency)}
                  </Text>
                  {context ? (
                    <View
                      className={`rounded-full px-2 py-0.5 ${
                        context.isPositive ? "bg-[#183B2B]" : "bg-[#451C28]"
                      }`}
                    >
                      <Text
                        className={`text-[10px] font-extrabold ${
                          context.isPositive ? "text-[#4ADE80]" : "text-[#FB7185]"
                        }`}
                      >
                        {context.label}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* Recorded Payments Section */}
      {paymentError ? <Text selectable className="px-1 text-sm font-semibold text-[#FB7185]">{paymentError}</Text> : null}
      {payments && payments.length > 0 ? (
        <View className="gap-3 pt-3">
          <Text className="px-1 text-xs font-bold uppercase tracking-wider text-[#A59ECB]">Recorded payments</Text>
          {payments.map((payment) => (
            <View key={payment.id} className="gap-3 rounded-3xl border border-white/10 bg-[#262243] p-4">
              <View className="flex-row items-center gap-3">
                <View className="h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[#1A3F30]">
                  <Ionicons name="checkmark-circle" size={22} color="#4ADE80" />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-bold text-white" numberOfLines={1}>
                    {members?.find((m) => m.userId === payment.payerId)?.name ?? "A member"} → {members?.find((m) => m.userId === payment.recipientId)?.name ?? "a member"}
                  </Text>
                  <Text className="text-xs text-[#A59ECB]" numberOfLines={2}>
                    {formatPaymentDate(payment.paymentDate)} · Recorded {formatRelativeTime(payment.createdAt)}
                  </Text>
                </View>
                <Text selectable className="text-base font-black text-white">
                  {formatMoney(payment.amountMinor / 100, group.currency)}
                </Text>
              </View>

              {(currentUserId === payment.payerId || currentUserId === payment.recipientId) ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Delete payment of ${formatMoney(payment.amountMinor / 100, group.currency)}`}
                  disabled={deletingPaymentId !== null}
                  onPress={() => confirmAction(
                    "Delete this payment?",
                    `Remove this recorded payment of ${formatMoney(payment.amountMinor / 100, group.currency)} and update everyone's balances? This cannot be undone.`,
                    "Delete payment",
                    () => void onRemovePayment(payment),
                  )}
                  className="min-h-10 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 active:opacity-75"
                >
                  <Text className="text-xs font-extrabold text-[#FB7185]">
                    {deletingPaymentId === payment.id ? "Deleting…" : "Delete payment"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ─── Balances Tab ───────────────────────────────────────────────────────────

function BalancesTab({
  group,
  balances,
  currentUserId,
  memberError,
  expenseError,
  paymentError,
}: {
  group: SharedGroup;
  balances: ReturnType<typeof getSharedMemberBalances> | null;
  currentUserId: string | null;
  memberError: string | null;
  expenseError: string | null;
  paymentError: string | null;
}) {
  return (
    <View className="gap-3">
      {memberError ? <Text selectable className="px-1 text-sm font-semibold text-[#FB7185]">{memberError}</Text> : null}
      {expenseError ? <Text selectable className="px-1 text-sm font-semibold text-[#FB7185]">{expenseError}</Text> : null}
      {paymentError ? <Text selectable className="px-1 text-sm font-semibold text-[#FB7185]">{paymentError}</Text> : null}
      {balances === null && !memberError && !expenseError && !paymentError ? (
        <ActivityIndicator color="#F5D298" className="py-6" />
      ) : null}

      {balances ? (
        <View className="gap-3">
          {balances.map((balance, index) => {
            const isPositive = balance.netMinor >= 0;
            const isYou = balance.member.userId === currentUserId;

            return (
              <View
                key={balance.member.userId}
                className="flex-row items-center gap-3.5 rounded-3xl border border-white/10 bg-[#262243] p-4"
              >
                <MemberAvatar name={balance.member.name} index={index} size={42} />

                <View className="flex-1 gap-1">
                  <Text className="text-sm font-bold text-white">
                    {balance.member.name}{isYou ? " (you)" : ""}
                  </Text>
                  <Text className="text-xs text-[#A59ECB]">
                    Paid {formatMoney(balance.paidMinor / 100, group.currency)} · Share {formatMoney(balance.shareMinor / 100, group.currency)}
                  </Text>
                </View>

                <View className={`rounded-xl px-2.5 py-1.5 ${isPositive ? "bg-[#16382A]" : "bg-[#451C28]"}`}>
                  <Text
                    selectable
                    className={`text-sm font-black ${isPositive ? "text-[#4ADE80]" : "text-[#FB7185]"}`}
                  >
                    {formatMoney(balance.netMinor / 100, group.currency, true)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

// ─── Settle Tab ─────────────────────────────────────────────────────────────

function SettleTab({
  settlements,
  yourSettlements,
  otherSettlements,
  isLoadingMembers,
  isLoadingExpenses,
  isLoadingPayments,
  memberError,
  expenseError,
  paymentError,
  onRefresh,
  settlementCard,
}: {
  settlements: SharedSettlement[] | null;
  yourSettlements: SharedSettlement[];
  otherSettlements: SharedSettlement[];
  isLoadingMembers: boolean;
  isLoadingExpenses: boolean;
  isLoadingPayments: boolean;
  memberError: string | null;
  expenseError: string | null;
  paymentError: string | null;
  onRefresh: () => void;
  settlementCard: (settlement: SharedSettlement) => React.JSX.Element;
}) {
  return (
    <View className="gap-5">
      <View className="flex-row items-center justify-between px-1">
        <Text className="text-xs font-bold uppercase tracking-wider text-[#A59ECB]">Suggested payments</Text>
        <Pressable
          accessibilityRole="button"
          disabled={isLoadingMembers || isLoadingExpenses || isLoadingPayments}
          onPress={onRefresh}
        >
          <Text className="text-xs font-bold text-[#F5D298]">Refresh</Text>
        </Pressable>
      </View>
      <Text className="px-1 text-xs text-[#A59ECB]">Pay outside the app, then record it here to settle balances.</Text>

      {memberError ? <Text selectable className="px-1 text-sm font-semibold text-[#FB7185]">{memberError}</Text> : null}
      {expenseError ? <Text selectable className="px-1 text-sm font-semibold text-[#FB7185]">{expenseError}</Text> : null}
      {paymentError ? <Text selectable className="px-1 text-sm font-semibold text-[#FB7185]">{paymentError}</Text> : null}

      {settlements === null && !memberError && !expenseError && !paymentError ? (
        <ActivityIndicator color="#F5D298" className="py-6" />
      ) : null}

      {settlements && settlements.length === 0 ? (
        <ClayEmptyState
          icon="checkmark-circle-outline"
          title="All settled up"
          message="There are no pending payments to record right now."
        />
      ) : null}

      {settlements && settlements.length > 0 ? (
        <>
          <View className="gap-3">
            <Text className="px-1 text-xs font-bold uppercase tracking-wider text-[#A59ECB]">Your payments</Text>
            {yourSettlements.length > 0 ? yourSettlements.map(settlementCard) : (
              <View className="rounded-2xl border border-white/5 bg-[#262243]/50 p-4">
                <Text className="text-center text-xs text-[#A59ECB]">You are fully settled up.</Text>
              </View>
            )}
          </View>
          {otherSettlements.length > 0 ? (
            <View className="gap-3">
              <Text className="px-1 text-xs font-bold uppercase tracking-wider text-[#A59ECB]">Other group payments</Text>
              {otherSettlements.map(settlementCard)}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

// ─── Deleted Group ──────────────────────────────────────────────────────────

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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#181528" }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center px-5 pt-2 pb-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          className="h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[#262243] active:opacity-75"
        >
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerClassName="w-full max-w-3xl self-center gap-5 px-5 pb-12 pt-5"
      >
        <ClayEmptyState
          icon="trash-outline"
          title="Group deleted"
          message="This group is hidden for all members. Restore it to see its expenses again."
        />
        <Pressable
          accessibilityRole="button"
          disabled={isRestoring}
          onPress={() => void restore()}
          className="min-h-14 flex-row items-center justify-center rounded-2xl bg-[#F5D298] px-5 active:opacity-75"
        >
          {isRestoring ? (
            <ActivityIndicator color="#181528" />
          ) : (
            <Text className="text-base font-extrabold text-[#181528]">Restore group</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
