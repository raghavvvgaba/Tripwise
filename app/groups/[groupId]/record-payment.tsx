import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/empty-state";
import { PaymentDateField } from "@/components/payment-date-field";
import { useClayTheme } from "@/constants/clay-theme";
import { type GroupMember } from "@/lib/group-invites";
import { useGroupMembers, useGroupExpenses, useGroupPayments } from "@/hooks/use-group-data";
import { useGroupDataActions } from "@/hooks/use-group-data-actions";
import {
  createPaymentRequestId,
  PaymentError,
  type RecordPaymentInput,
} from "@/lib/payments";
import { useSharedGroups } from "@/hooks/use-shared-groups";
import { formatMoney, getCurrencySymbol, parseMoneyToMinor } from "@/utils/money";
import { getSharedMemberBalances } from "@/utils/shared-expenses";
import { localDateString, parseLocalDate } from "@/utils/date";

type PaymentDetails = {
  payer: GroupMember;
  recipient: GroupMember;
  maxMinor: number;
};

export default function RecordPaymentScreen() {
  const clay = useClayTheme();
  const insets = useSafeAreaInsets();
  const { groupId, payerId, recipientId, amountMinor } = useLocalSearchParams<{
    groupId: string;
    payerId: string;
    recipientId: string;
    amountMinor: string;
  }>();
  const { groups, userId: currentUserId } = useSharedGroups();
  const group = groups.find((item) => item.id === groupId);
  const [amountDraft, setAmount] = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState(() => localDateString());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const pendingRequest = useRef<RecordPaymentInput | null>(null);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [pendingDetails, setPendingDetails] = useState<PaymentDetails | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const canRecord = currentUserId === payerId || currentUserId === recipientId;

  const enabled = !!group && !group.deletedAt && canRecord;
  const membersQuery = useGroupMembers(groupId, enabled);
  const expensesQuery = useGroupExpenses(groupId, enabled);
  const paymentsQuery = useGroupPayments(groupId, enabled);
  const { recordPayment } = useGroupDataActions(groupId);
  const isLoading = enabled && (membersQuery.isPending || expensesQuery.isPending || paymentsQuery.isPending);
  let latestDetails: PaymentDetails | null = null;
  if (membersQuery.data && expensesQuery.data && paymentsQuery.data) {
    const members = membersQuery.data;
    const payer = members.find((member) => member.userId === payerId);
    const recipient = members.find((member) => member.userId === recipientId);
    const balances = getSharedMemberBalances(members, expensesQuery.data, paymentsQuery.data);
    const payerNet = balances.find((balance) => balance.member.userId === payerId)?.netMinor ?? 0;
    const recipientNet = balances.find((balance) => balance.member.userId === recipientId)?.netMinor ?? 0;
    const maxMinor = Math.min(-payerNet, recipientNet);
    if (payer && recipient && payerId !== recipientId && maxMinor > 0) latestDetails = { payer, recipient, maxMinor };
  }
  // An uncertain save must remain retryable with its original request and participants.
  const details = pendingDetails ?? latestDetails;
  const refreshError = membersQuery.errorMessage ?? expensesQuery.errorMessage ?? paymentsQuery.errorMessage;
  const loadError = (!membersQuery.data || !expensesQuery.data || !paymentsQuery.data ? refreshError : null)
    ?? (!isLoading && !details ? "This suggested payment is no longer available. Return to the group and refresh." : null);
  const suggestedMinor = Number(amountMinor);
  const initialMinor = details ? Number.isSafeInteger(suggestedMinor) && suggestedMinor > 0
    ? Math.min(suggestedMinor, details.maxMinor) : details.maxMinor : 0;
  const amount = amountDraft ?? (details ? String(initialMinor / 100) : "");

  const parsedAmount = parseMoneyToMinor(amount);
  const today = localDateString();
  const isValid =
    details !== null &&
    parsedAmount !== null &&
    parsedAmount > 0 &&
    parsedAmount <= details.maxMinor &&
    parseLocalDate(paymentDate) !== null &&
    paymentDate <= today;

  async function save() {
    if (!group || !details || !canRecord || savingRef.current) return;
    if (!pendingRequest.current && (!isValid || parsedAmount === null)) return;
    savingRef.current = true;
    setIsSaving(true);
    setSaveError(null);
    try {
      const now = new Date();
      if (!pendingRequest.current) {
        if (parsedAmount === null) return;
        if (paymentDate > localDateString(now)) throw new Error("Payment date cannot be in the future.");
        pendingRequest.current = {
          groupId: group.id,
          payerId: details.payer.userId,
          recipientId: details.recipient.userId,
          amountMinor: parsedAmount,
          paymentDate,
          timezoneOffsetMinutes: now.getTimezoneOffset(),
          requestId: createPaymentRequestId(),
        };
        setHasPendingRequest(true);
        setPendingDetails(details);
      }
      await recordPayment(pendingRequest.current, isDuplicate);
      router.dismissTo(`/groups/${group.id}`);
    } catch (error) {
      if (error instanceof PaymentError && error.code === "23505") {
        setIsDuplicate(true);
        setSaveError(null);
      } else {
        setSaveError(error instanceof Error ? error.message : "Could not record the payment.");
        if (error instanceof PaymentError && /^[0-9A-Z]{5}$/.test(error.code) && !error.code.startsWith("08")) {
          pendingRequest.current = null;
          setHasPendingRequest(false);
          setPendingDetails(null);
          setIsDuplicate(false);
        }
      }
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: clay.canvas }}>
      <Stack.Screen options={{ headerShown: false }} />

      {refreshError && details ? <Text className="px-5 text-sm text-coral">Could not refresh: {refreshError}</Text> : null}
      {/* ── Top Bar Header ── */}
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => router.back()}
          style={{ backgroundColor: clay.headerBtn, borderColor: clay.cardBorder }}
          className="h-11 w-11 items-center justify-center rounded-2xl border active:opacity-75"
        >
          <Ionicons name="close" size={22} color={clay.textPrimary} />
        </Pressable>

        <View className="items-center">
          <Text style={{ color: clay.textMuted }} className="text-[11px] font-bold uppercase tracking-widest">
            Record Payment
          </Text>
          <Text style={{ color: clay.textPrimary }} className="max-w-[200px] text-base font-extrabold" numberOfLines={1}>
            {group?.name ?? "Settle Up"}
          </Text>
        </View>

        <View className="h-11 w-11" />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="w-full max-w-2xl self-center px-5 pb-8 gap-5"
          showsVerticalScrollIndicator={false}
        >
          {!group || group.deletedAt ? (
            <EmptyState
              icon="alert-circle-outline"
              title="Group unavailable"
              message="Return to the group and try again."
            />
          ) : !canRecord ? (
            <EmptyState
              icon="lock-closed-outline"
              title="Payment unavailable"
              message="Only the sender or recipient can record this payment."
            />
          ) : isLoading ? (
            <ActivityIndicator color="#F5D298" className="py-16" />
          ) : loadError ? (
            <View
              style={{ backgroundColor: clay.card, borderColor: clay.errorCardBorder }}
              className="gap-4 rounded-3xl border p-5 shadow-sm"
            >
              <Text selectable style={{ color: clay.errorText }} className="text-sm font-semibold">
                {loadError}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.back()}
                style={{ backgroundColor: clay.squircle, borderColor: clay.cardBorder }}
                className="h-12 items-center justify-center rounded-2xl border active:opacity-75"
              >
                <Text style={{ color: clay.textPrimary }} className="font-bold">
                  Back to group
                </Text>
              </Pressable>
            </View>
          ) : details ? (
            <>
              {/* ── Payment Info Card ── */}
              <View
                style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
                className="gap-4 rounded-3xl border p-5 shadow-sm"
              >
                <View className="flex-row items-center gap-3.5">
                  <View
                    style={{ backgroundColor: clay.squircle, borderColor: clay.cardBorder }}
                    className="h-12 w-12 items-center justify-center rounded-2xl border"
                  >
                    <Ionicons name="swap-horizontal" size={24} color={clay.isDark ? "#F5D298" : "#9A6B1C"} />
                  </View>
                  <View className="flex-1">
                    <Text style={{ color: clay.textMuted }} className="text-[11px] font-bold uppercase tracking-wider">
                      Transfer
                    </Text>
                    <Text style={{ color: clay.textPrimary }} className="text-lg font-black" numberOfLines={1}>
                      {details.payer.userId === currentUserId ? "You" : details.payer.name} paid{" "}
                      {details.recipient.userId === currentUserId ? "you" : details.recipient.name}
                    </Text>
                  </View>
                </View>

                {/* Amount Field */}
                <View className="gap-2">
                  <Text style={{ color: clay.textMuted }} className="text-xs font-bold uppercase tracking-wider">
                    Amount Paid
                  </Text>
                  <View
                    style={{ backgroundColor: clay.squircle, borderColor: clay.cardBorder }}
                    className="flex-row items-center rounded-2xl border px-4"
                  >
                    <Text style={{ color: clay.textMuted }} className="text-2xl font-black">
                      {getCurrencySymbol(group.currency)}
                    </Text>
                    <TextInput
                      style={{ color: clay.textPrimary }}
                      className="flex-1 py-3 pl-2 text-2xl font-black"
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={clay.textMuted}
                      value={amount}
                      editable={!hasPendingRequest && !isSaving}
                      onChangeText={setAmount}
                      accessibilityLabel="Amount paid"
                    />
                  </View>
                  <Text style={{ color: clay.textMuted }} className="px-1 text-xs">
                    Up to {formatMoney(details.maxMinor / 100, group.currency)} can be recorded for this payment.
                  </Text>
                  {parsedAmount !== null && parsedAmount > details.maxMinor ? (
                    <Text style={{ color: clay.errorText }} className="px-1 text-xs">
                      Amount exceeds the current balance.
                    </Text>
                  ) : null}
                  {amount.length > 0 && parsedAmount === null ? (
                    <Text style={{ color: clay.errorText }} className="px-1 text-xs">
                      Enter an amount with up to two decimal places.
                    </Text>
                  ) : null}
                </View>

                {/* Paid On Date Field */}
                <View className="gap-2">
                  <Text style={{ color: clay.textMuted }} className="text-xs font-bold uppercase tracking-wider">
                    Paid On
                  </Text>
                  <PaymentDateField
                    value={paymentDate}
                    maxDate={today}
                    onChange={setPaymentDate}
                    disabled={hasPendingRequest || isSaving}
                  />
                  {paymentDate && (!parseLocalDate(paymentDate) || paymentDate > today) ? (
                    <Text style={{ color: clay.errorText }} className="px-1 text-xs">
                      Choose today or an earlier date.
                    </Text>
                  ) : null}
                </View>
              </View>

              <Text style={{ color: clay.textMuted }} className="px-1 text-xs leading-5">
                This records money already paid outside the app. It does not transfer money directly.
              </Text>

              {saveError ? (
                <Text selectable style={{ color: clay.errorText }} className="px-1 text-xs font-semibold">
                  {saveError}
                </Text>
              ) : null}

              {isDuplicate ? (
                <View
                  style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
                  className="gap-2 rounded-3xl border p-4 shadow-sm"
                >
                  <Text style={{ color: clay.textPrimary }} className="font-bold">
                    Similar payment already recorded
                  </Text>
                  <Text style={{ color: clay.textMuted }} className="text-xs leading-5">
                    A payment with these people, amount, and date already exists. Check Recorded payments in the group.
                  </Text>
                </View>
              ) : hasPendingRequest && saveError ? (
                <Text style={{ color: clay.textMuted }} className="text-xs leading-5">
                  The payment may have been saved. Retry to check the same request safely, or return to the group.
                </Text>
              ) : null}
            </>
          ) : null}
        </ScrollView>

        {details ? (
          <View
            style={{
              backgroundColor: clay.canvas,
              borderColor: clay.cardBorder,
              paddingBottom: Math.max(insets.bottom, 12) + 8,
            }}
            className="w-full max-w-2xl self-center border-t px-5 pt-3"
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                isDuplicate
                  ? "Record another payment"
                  : hasPendingRequest
                    ? "Retry payment"
                    : "Record payment"
              }
              disabled={(!hasPendingRequest && !isValid) || isSaving}
              onPress={() => void save()}
              className="h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-[#F5D298] px-5 shadow-sm active:opacity-75 disabled:opacity-40"
            >
              {isSaving ? (
                <ActivityIndicator color={clay.heroText} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color={clay.heroText} />
                  <Text style={{ color: clay.heroText }} className="text-base font-extrabold">
                    {isDuplicate
                      ? "Record Another Payment"
                      : hasPendingRequest
                        ? "Retry Payment"
                        : "Record Payment"}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
