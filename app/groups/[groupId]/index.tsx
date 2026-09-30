import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useClayTheme } from "@/constants/clay-theme";
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
  bg,
}: {
  name: string;
  index?: number;
  size?: number;
  ringColor?: string;
  bg?: string;
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
        backgroundColor: bg ?? "#2C274B",
      }}
      className="items-center justify-center"
    >
      <Text className="text-xs font-black text-white">{initial}</Text>
    </View>
  );
}

/** Avatar stack for the ticket card */
function AvatarStack({ members, canvasBg }: { members: GroupMember[]; canvasBg: string }) {
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
          style={{
            marginLeft: -10,
            zIndex: 5,
            borderColor: "#F5D298",
            backgroundColor: canvasBg,
          }}
          className="h-[30px] w-[30px] items-center justify-center rounded-full border-2"
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
  const clay = useClayTheme();
  return (
    <View
      style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
      className="items-center gap-2.5 rounded-3xl border px-8 py-10 shadow-sm"
    >
      <View
        style={{ backgroundColor: clay.squircle, borderColor: clay.cardBorder }}
        className="h-16 w-16 items-center justify-center rounded-2xl border"
      >
        <Ionicons name={icon} size={28} color="#F5D298" />
      </View>
      <Text style={{ color: clay.textPrimary }} className="text-center text-lg font-bold">
        {title}
      </Text>
      <Text style={{ color: clay.textMuted }} className="text-center text-sm leading-5">
        {message}
      </Text>
    </View>
  );
}

export default function GroupDetailsScreen() {
  const clay = useClayTheme();
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
      <SafeAreaView style={{ flex: 1, backgroundColor: clay.canvas }}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#F5D298" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: clay.canvas }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="px-5 py-8">
        <ClayEmptyState icon="search-outline" title="Group not found" message="This group may have been removed." />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Main Group View ────────────────────────────────────────────────────────

function SharedGroupDetails({ group }: { group: SharedGroup }) {
  const insets = useSafeAreaInsets();
  const clay = useClayTheme();
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
  let balanceColor: string = clay.textPrimary;

  if (currentBalance) {
    if (currentBalance.netMinor > 0) {
      balanceAmountText = `+${formatMoney(currentBalance.netMinor / 100, group.currency)}`;
      balanceColor = clay.badgePositiveText;
    } else if (currentBalance.netMinor < 0) {
      balanceAmountText = `-${formatMoney(-currentBalance.netMinor / 100, group.currency)}`;
      balanceColor = clay.badgeNegativeText;
    } else {
      balanceAmountText = formatMoney(0, group.currency);
      balanceColor = clay.textPrimary;
    }
  }

  function settlementCard(settlement: SharedSettlement) {
    const fromName = settlement.from.userId === currentUserId ? "You" : settlement.from.name;
    const toName = settlement.to.userId === currentUserId ? "you" : settlement.to.name;
    const isYours = settlement.from.userId === currentUserId || settlement.to.userId === currentUserId;

    return (
      <View
        key={`${settlement.from.userId}-${settlement.to.userId}`}
        style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
        className="gap-3.5 rounded-3xl border p-4 shadow-sm"
      >
        <View className="flex-row items-center gap-3">
          <View
            style={{ backgroundColor: clay.squircle, borderColor: clay.cardBorder }}
            className="h-11 w-11 items-center justify-center rounded-2xl border"
          >
            <Ionicons name="swap-horizontal" size={20} color={clay.isDark ? "#F5D298" : "#9A6B1C"} />
          </View>
          <View className="flex-1 gap-0.5">
            <Text style={{ color: clay.textPrimary }} className="text-sm font-bold">
              {fromName} pay{fromName === "You" ? "" : "s"} {toName}
            </Text>
            <Text selectable style={{ color: clay.isDark ? "#F5D298" : "#9A6B1C" }} className="text-base font-extrabold">
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
            <Ionicons name="card-outline" size={18} color={clay.heroText} />
            <Text style={{ color: clay.heroText }} className="text-sm font-extrabold">Record payment</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: clay.canvas }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Top Bar Header (Sajon Tactile Header) ── */}
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={{ backgroundColor: clay.headerBtn, borderColor: clay.headerBtnBorder }}
          className="h-11 w-11 items-center justify-center rounded-2xl border active:opacity-75"
        >
          <Ionicons name="chevron-back" size={20} color={clay.textPrimary} />
        </Pressable>

        <View className="items-center">
          <Text style={{ color: clay.textMuted }} className="text-[11px] font-bold uppercase tracking-widest">
            Bill Splitter
          </Text>
          <Text style={{ color: clay.textPrimary }} className="max-w-[200px] text-base font-extrabold" numberOfLines={1}>
            {group.name}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Group settings"
          onPress={() => router.push(`/groups/${group.id}/settings`)}
          style={{ backgroundColor: clay.headerBtn, borderColor: clay.headerBtnBorder }}
          className="h-11 w-11 items-center justify-center rounded-2xl border active:opacity-75"
        >
          <Ionicons name="settings-outline" size={20} color={clay.textPrimary} />
        </Pressable>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerClassName="w-full max-w-4xl self-center px-5 gap-5"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 84 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Centerpiece: Sajon's Physical "Receipt Ticket" Card ── */}
        <View
          style={{ borderColor: clay.heroBorder }}
          className="relative overflow-hidden rounded-3xl border bg-[#F5D298] p-5 shadow-sm"
        >
          {/* Top Receipt Badge & Currency */}
          <View className="flex-row items-center justify-between">
            <View style={{ backgroundColor: clay.heroTagBg }} className="rounded-full px-3.5 py-1">
              <Text className="text-[11px] font-black tracking-widest text-[#F5D298]">RECEIPT</Text>
            </View>
            <View style={{ backgroundColor: `${clay.heroTagBg}1A` }} className="rounded-full px-3 py-1">
              <Text className="text-xs font-bold text-[#4B4031]">{group.currency}</Text>
            </View>
          </View>

          {/* Group Name & Total Bill */}
          <View className="mt-4 flex-row items-baseline justify-between">
            <View className="flex-1 pr-3">
              <Text style={{ color: clay.heroLabel }} className="text-xs font-bold uppercase tracking-wider">Title</Text>
              <Text style={{ color: clay.heroText }} className="mt-0.5 text-xl font-black" numberOfLines={1}>
                {group.name}
              </Text>
            </View>
            <View className="items-end">
              <Text style={{ color: clay.heroLabel }} className="text-xs font-bold uppercase tracking-wider">Total Bill</Text>
              <Text selectable style={{ color: clay.heroText }} className="mt-0.5 text-2xl font-black">
                {formatMoney(totalMinor / 100, group.currency)}
              </Text>
            </View>
          </View>

          {/* ── Perforated Tear Line with Semicircular Cutout Notches ── */}
          <View style={{ borderBottomColor: clay.heroDashed }} className="my-4 border-b border-dashed" />
          {/* Left Cutout Punch Hole */}
          <View
            style={{
              position: "absolute",
              left: -14,
              top: "52%",
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: clay.canvas,
            }}
          />
          {/* Right Cutout Punch Hole */}
          <View
            style={{
              position: "absolute",
              right: -14,
              top: "52%",
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: clay.canvas,
            }}
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
                <AvatarStack members={members} canvasBg={clay.canvas} />
              ) : (
                <Text className="text-xs text-[#6F614C]">1 member</Text>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Invite members"
              onPress={() => router.push(`/groups/${group.id}/invite`)}
              style={{ backgroundColor: clay.heroTagBg }}
              className="flex-row items-center gap-1.5 rounded-full px-3.5 py-2 active:opacity-75"
            >
              <Ionicons name="person-add-outline" size={14} color="#F5D298" />
              <Text className="text-xs font-extrabold text-white">Invite</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Summary Stats: 3 Tactile Clay Cards ── */}
        <View className="flex-row gap-2.5">
          {/* Your Balance */}
          <View
            style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
            className="flex-1 items-center justify-center rounded-3xl border p-3 shadow-sm"
          >
            <Text style={{ color: clay.textMuted }} className="text-[10px] font-bold uppercase tracking-wider">
              Your Balance
            </Text>
            <Text
              selectable
              className="mt-1 text-sm font-black"
              style={{ color: balanceColor }}
              numberOfLines={1}
            >
              {balanceAmountText}
            </Text>
            {currentBalance && currentBalance.netMinor > 0 ? (
              <View style={{ backgroundColor: clay.badgePositiveBg }} className="mt-1.5 rounded-full px-2 py-0.5">
                <Text style={{ color: clay.badgePositiveText }} className="text-[9px] font-bold">
                  You are owed
                </Text>
              </View>
            ) : currentBalance && currentBalance.netMinor < 0 ? (
              <View style={{ backgroundColor: clay.badgeNegativeBg }} className="mt-1.5 rounded-full px-2 py-0.5">
                <Text style={{ color: clay.badgeNegativeText }} className="text-[9px] font-bold">
                  You owe
                </Text>
              </View>
            ) : (
              <View style={{ backgroundColor: clay.badgeNeutralBg }} className="mt-1.5 rounded-full px-2 py-0.5">
                <Text style={{ color: clay.badgeNeutralText }} className="text-[9px] font-bold">
                  Settled
                </Text>
              </View>
            )}
          </View>

          {/* Total Expenses */}
          <View
            style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
            className="flex-1 items-center justify-center rounded-3xl border p-3 shadow-sm"
          >
            <Text style={{ color: clay.textMuted }} className="text-[10px] font-bold uppercase tracking-wider">
              Expenses
            </Text>
            <Text selectable style={{ color: clay.textPrimary }} className="mt-1 text-base font-black">
              {expenseCount}
            </Text>
            <View style={{ backgroundColor: clay.badgeNeutralBg }} className="mt-1.5 rounded-full px-2 py-0.5">
              <Text style={{ color: clay.textMuted }} className="text-[9px] font-bold">
                recorded
              </Text>
            </View>
          </View>

          {/* Members */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View all members"
            onPress={() => router.push(`/groups/${group.id}/members`)}
            style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
            className="flex-1 items-center justify-center rounded-3xl border p-3 shadow-sm active:opacity-75"
          >
            <Text style={{ color: clay.textMuted }} className="text-[10px] font-bold uppercase tracking-wider">
              Members
            </Text>
            <Text selectable style={{ color: clay.textPrimary }} className="mt-1 text-base font-black">
              {members ? members.length : "…"}
            </Text>
            <View style={{ backgroundColor: clay.badgeNeutralBg }} className="mt-1.5 rounded-full px-2 py-0.5">
              <Text style={{ color: clay.textMuted }} className="text-[9px] font-bold">
                joined
              </Text>
            </View>
          </Pressable>
        </View>

        {/* ── Segmented Control Pill Bar ── */}
        <View style={{ backgroundColor: clay.track }} className="flex-row rounded-full p-1.5 shadow-inner">
          {views.map((option) => {
            const isActive = sharedView === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => setSharedView(option.id)}
                style={{ backgroundColor: isActive ? clay.activeTabBg : "transparent" }}
                className="min-h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-full active:opacity-75"
              >
                <Ionicons
                  name={option.icon}
                  size={15}
                  color={isActive ? clay.activeTabText : clay.textMuted}
                />
                <Text
                  style={{ color: isActive ? clay.activeTabText : clay.textMuted }}
                  className="text-xs font-extrabold"
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
        <View
          pointerEvents="box-none"
          style={{ bottom: Math.max(insets.bottom, 16) + 16 }}
          className="absolute left-0 right-0 z-20 items-center justify-center"
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add new expense"
            onPress={() => router.push(`/groups/${group.id}/add-expense`)}
            style={{ elevation: 6 }}
            className="h-14 w-14 items-center justify-center rounded-full bg-[#F5D298] shadow-xl active:opacity-75"
          >
            <Ionicons name="add" size={30} color={clay.heroText} />
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
  const clay = useClayTheme();

  return (
    <View className="gap-4">
      {/* Loading / Error States */}
      {isLoadingExpenses && expenses === null ? (
        <ActivityIndicator color="#F5D298" className="py-6" />
      ) : null}

      {expenseError ? (
        <View
          style={{ backgroundColor: clay.card, borderColor: clay.errorCardBorder }}
          className="gap-2 rounded-3xl border p-4 shadow-sm"
        >
          <Text selectable style={{ color: clay.errorText }} className="text-sm font-semibold">
            {expenseError}
          </Text>
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
                style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
                className="flex-row items-center gap-3.5 rounded-3xl border p-4 shadow-sm active:opacity-75"
              >
                {/* Category squircle */}
                <View
                  style={{ backgroundColor: clay.squircle, borderColor: clay.cardBorder }}
                  className="h-12 w-12 items-center justify-center rounded-2xl border"
                >
                  <Ionicons name="receipt-outline" size={22} color={clay.isDark ? "#F5D298" : "#9A6B1C"} />
                </View>

                {/* Title & Payer info */}
                <View className="flex-1 gap-1">
                  <View className="flex-row items-center gap-2">
                    <Text style={{ color: clay.textPrimary }} className="text-base font-bold" numberOfLines={1}>
                      {expense.description}
                    </Text>
                    {expense.updatedAt ? (
                      <View style={{ backgroundColor: clay.badgeNeutralBg }} className="rounded px-1.5 py-0.5">
                        <Text style={{ color: clay.textMuted }} className="text-[10px] font-bold">Edited</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={{ color: clay.textMuted }} className="text-xs" numberOfLines={1}>
                    {payerName} paid · {formatExpenseDate(`${expense.expenseDate}T00:00:00`)}
                  </Text>
                </View>

                {/* Amount & User share badge */}
                <View className="items-end gap-1">
                  <Text selectable style={{ color: clay.textPrimary }} className="text-base font-black">
                    {formatMoney(expense.amountMinor / 100, group.currency)}
                  </Text>
                  {context ? (
                    <View
                      style={{
                        backgroundColor: context.isPositive ? clay.badgePositiveBg : clay.badgeNegativeBg,
                      }}
                      className="rounded-full px-2 py-0.5"
                    >
                      <Text
                        style={{
                          color: context.isPositive ? clay.badgePositiveText : clay.badgeNegativeText,
                        }}
                        className="text-[10px] font-extrabold"
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
      {paymentError ? (
        <Text selectable style={{ color: clay.errorText }} className="px-1 text-sm font-semibold">
          {paymentError}
        </Text>
      ) : null}
      {payments && payments.length > 0 ? (
        <View className="gap-3 pt-3">
          <Text style={{ color: clay.textMuted }} className="px-1 text-xs font-bold uppercase tracking-wider">
            Recorded payments
          </Text>
          {payments.map((payment) => (
            <View
              key={payment.id}
              style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
              className="gap-3 rounded-3xl border p-4 shadow-sm"
            >
              <View className="flex-row items-center gap-3">
                <View
                  style={{ backgroundColor: clay.isDark ? "#1A3F30" : "#DCFCE7" }}
                  className="h-11 w-11 items-center justify-center rounded-2xl"
                >
                  <Ionicons name="checkmark-circle" size={22} color={clay.isDark ? "#4ADE80" : "#15803D"} />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text style={{ color: clay.textPrimary }} className="text-sm font-bold" numberOfLines={1}>
                    {members?.find((m) => m.userId === payment.payerId)?.name ?? "A member"} → {members?.find((m) => m.userId === payment.recipientId)?.name ?? "a member"}
                  </Text>
                  <Text style={{ color: clay.textMuted }} className="text-xs" numberOfLines={2}>
                    {formatPaymentDate(payment.paymentDate)} · Recorded {formatRelativeTime(payment.createdAt)}
                  </Text>
                </View>
                <Text selectable style={{ color: clay.textPrimary }} className="text-base font-black">
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
                  style={{
                    backgroundColor: clay.isDark ? "rgba(239, 68, 68, 0.1)" : "#FEE2E2",
                    borderColor: clay.isDark ? "rgba(239, 68, 68, 0.2)" : "#FECACA",
                  }}
                  className="min-h-10 items-center justify-center rounded-2xl border active:opacity-75"
                >
                  <Text
                    style={{ color: clay.isDark ? "#FB7185" : "#DC2626" }}
                    className="text-xs font-extrabold"
                  >
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
  const clay = useClayTheme();

  return (
    <View className="gap-3">
      {memberError ? (
        <Text selectable style={{ color: clay.errorText }} className="px-1 text-sm font-semibold">
          {memberError}
        </Text>
      ) : null}
      {expenseError ? (
        <Text selectable style={{ color: clay.errorText }} className="px-1 text-sm font-semibold">
          {expenseError}
        </Text>
      ) : null}
      {paymentError ? (
        <Text selectable style={{ color: clay.errorText }} className="px-1 text-sm font-semibold">
          {paymentError}
        </Text>
      ) : null}
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
                style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
                className="flex-row items-center gap-3.5 rounded-3xl border p-4 shadow-sm"
              >
                <MemberAvatar name={balance.member.name} index={index} size={42} bg={clay.avatarBg} />

                <View className="flex-1 gap-1">
                  <Text style={{ color: clay.textPrimary }} className="text-sm font-bold">
                    {balance.member.name}{isYou ? " (you)" : ""}
                  </Text>
                  <Text style={{ color: clay.textMuted }} className="text-xs">
                    Paid {formatMoney(balance.paidMinor / 100, group.currency)} · Share {formatMoney(balance.shareMinor / 100, group.currency)}
                  </Text>
                </View>

                <View
                  style={{
                    backgroundColor: isPositive ? clay.badgePositiveBg : clay.badgeNegativeBg,
                  }}
                  className="rounded-xl px-2.5 py-1.5"
                >
                  <Text
                    selectable
                    style={{
                      color: isPositive ? clay.badgePositiveText : clay.badgeNegativeText,
                    }}
                    className="text-sm font-black"
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
  const clay = useClayTheme();

  return (
    <View className="gap-5">
      <View className="flex-row items-center justify-between px-1">
        <Text style={{ color: clay.textMuted }} className="text-xs font-bold uppercase tracking-wider">
          Suggested payments
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={isLoadingMembers || isLoadingExpenses || isLoadingPayments}
          onPress={onRefresh}
        >
          <Text className="text-xs font-bold text-[#F5D298]">Refresh</Text>
        </Pressable>
      </View>
      <Text style={{ color: clay.textMuted }} className="px-1 text-xs">
        Pay outside the app, then record it here to settle balances.
      </Text>

      {memberError ? (
        <Text selectable style={{ color: clay.errorText }} className="px-1 text-sm font-semibold">
          {memberError}
        </Text>
      ) : null}
      {expenseError ? (
        <Text selectable style={{ color: clay.errorText }} className="px-1 text-sm font-semibold">
          {expenseError}
        </Text>
      ) : null}
      {paymentError ? (
        <Text selectable style={{ color: clay.errorText }} className="px-1 text-sm font-semibold">
          {paymentError}
        </Text>
      ) : null}

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
            <Text style={{ color: clay.textMuted }} className="px-1 text-xs font-bold uppercase tracking-wider">
              Your payments
            </Text>
            {yourSettlements.length > 0 ? yourSettlements.map(settlementCard) : (
              <View
                style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
                className="rounded-2xl border p-4 shadow-sm"
              >
                <Text style={{ color: clay.textMuted }} className="text-center text-xs">
                  You are fully settled up.
                </Text>
              </View>
            )}
          </View>
          {otherSettlements.length > 0 ? (
            <View className="gap-3">
              <Text style={{ color: clay.textMuted }} className="px-1 text-xs font-bold uppercase tracking-wider">
                Other group payments
              </Text>
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
  const clay = useClayTheme();
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
    <SafeAreaView style={{ flex: 1, backgroundColor: clay.canvas }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center px-5 pt-2 pb-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={{ backgroundColor: clay.headerBtn, borderColor: clay.cardBorder }}
          className="h-11 w-11 items-center justify-center rounded-2xl border active:opacity-75"
        >
          <Ionicons name="chevron-back" size={20} color={clay.textPrimary} />
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
            <ActivityIndicator color={clay.heroText} />
          ) : (
            <Text style={{ color: clay.heroText }} className="text-base font-extrabold">Restore group</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
