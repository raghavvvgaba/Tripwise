import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, Text, TextInput, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { PaymentDateField } from "@/components/payment-date-field";
import { PrimaryButton } from "@/components/primary-button";
import { RouteModal } from "@/components/route-modal";
import { getGroupMembers, type GroupMember } from "@/lib/group-invites";
import { listGroupExpenses } from "@/lib/expenses";
import { listGroupPayments, recordGroupPayment } from "@/lib/payments";
import { useSharedGroupsStore } from "@/store/use-shared-groups-store";
import { formatMoney, getCurrencySymbol, parseMoneyToMinor } from "@/utils/money";
import { getSharedMemberBalances } from "@/utils/shared-expenses";
import { localDateString, parseLocalDate } from "@/utils/date";

type PaymentDetails = {
  payer: GroupMember;
  recipient: GroupMember;
  maxMinor: number;
};

export default function RecordPaymentScreen() {
  const { groupId, payerId, recipientId, amountMinor } = useLocalSearchParams<{
    groupId: string;
    payerId: string;
    recipientId: string;
    amountMinor: string;
  }>();
  const group = useSharedGroupsStore((state) => state.groups.find((item) => item.id === groupId));
  const currentUserId = useSharedGroupsStore((state) => state.userId);
  const [details, setDetails] = useState<PaymentDetails | null>(null);
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => localDateString());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!group || group.deletedAt) {
      setIsLoading(false);
      return;
    }
    let active = true;
    void Promise.all([
      getGroupMembers(group.id),
      listGroupExpenses(group.id),
      listGroupPayments(group.id),
    ]).then(([members, expenses, payments]) => {
      if (!active) return;
      const payer = members.find((member) => member.userId === payerId);
      const recipient = members.find((member) => member.userId === recipientId);
      const balances = getSharedMemberBalances(members, expenses, payments);
      const payerNet = balances.find((balance) => balance.member.userId === payerId)?.netMinor ?? 0;
      const recipientNet = balances.find((balance) => balance.member.userId === recipientId)?.netMinor ?? 0;
      const maxMinor = Math.min(-payerNet, recipientNet);
      if (!payer || !recipient || payerId === recipientId || maxMinor <= 0) {
        setLoadError("This suggested payment is no longer available. Return to the group and refresh.");
      } else {
        setDetails({ payer, recipient, maxMinor });
        const suggestedMinor = Number(amountMinor);
        const initialMinor = Number.isSafeInteger(suggestedMinor) && suggestedMinor > 0
          ? Math.min(suggestedMinor, maxMinor)
          : maxMinor;
        setAmount(String(initialMinor / 100));
      }
    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : "Could not load the payment.");
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, [group?.id, group?.deletedAt, payerId, recipientId, amountMinor]);

  const parsedAmount = parseMoneyToMinor(amount);
  const today = localDateString();
  const isValid = details !== null && parsedAmount !== null && parsedAmount > 0 && parsedAmount <= details.maxMinor
    && parseLocalDate(paymentDate) !== null && paymentDate <= today;

  async function save() {
    if (!group || !details || !isValid || parsedAmount === null || savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    setSaveError(null);
    try {
      const now = new Date();
      if (paymentDate > localDateString(now)) throw new Error("Payment date cannot be in the future.");
      await recordGroupPayment(group.id, details.payer.userId, details.recipient.userId, parsedAmount, paymentDate, now.getTimezoneOffset());
      router.dismissTo(`/groups/${group.id}`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not record the payment.");
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <RouteModal title="Record payment">{(dismiss) => (
      <>
        <Stack.Screen options={{ title: "Record payment" }} />
        <KeyboardAvoidingView behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined} className="flex-1">
          <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerClassName="w-full max-w-2xl self-center gap-5 px-5 pb-8 pt-5 md:px-8 lg:py-10">
            {!group || group.deletedAt ? (
              <EmptyState icon="alert-circle-outline" title="Group unavailable" message="Return to the group and try again." />
            ) : isLoading ? <ActivityIndicator /> : loadError ? (
              <View className="card gap-4 p-5">
                <Text selectable className="text-sm text-coral">{loadError}</Text>
                <PrimaryButton label="Back to group" variant="secondary" onPress={dismiss} />
              </View>
            ) : details ? (
              <>
                <View className="card gap-4 p-5">
                  <View className="gap-1">
                    <Text className="section-label">Payment</Text>
                    <Text className="text-xl font-bold text-ink">
                      {details.payer.userId === currentUserId ? "You" : details.payer.name} paid {details.recipient.userId === currentUserId ? "you" : details.recipient.name}
                    </Text>
                  </View>
                  <View className="gap-2">
                    <Text className="section-label">Amount paid</Text>
                    <View className="field flex-row items-center gap-2">
                      <Text className="text-2xl font-semibold text-muted">{getCurrencySymbol(group.currency)}</Text>
                      <TextInput
                        className="flex-1 py-3 text-2xl font-bold text-ink"
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor="#9AA39D"
                        value={amount}
                        onChangeText={setAmount}
                        accessibilityLabel="Amount paid"
                      />
                    </View>
                    <Text className="text-sm text-muted">Up to {formatMoney(details.maxMinor / 100, group.currency)} can be recorded for this payment.</Text>
                    {parsedAmount !== null && parsedAmount > details.maxMinor ? (
                      <Text className="text-sm text-coral">Amount exceeds the current balance.</Text>
                    ) : null}
                    {amount.length > 0 && parsedAmount === null ? (
                      <Text className="text-sm text-coral">Enter an amount with up to two decimal places.</Text>
                    ) : null}
                  </View>
                  <View className="gap-2">
                    <Text className="section-label">Paid on</Text>
                    <PaymentDateField value={paymentDate} maxDate={today} onChange={setPaymentDate} />
                    {paymentDate && (!parseLocalDate(paymentDate) || paymentDate > today) ? (
                      <Text className="text-sm text-coral">Choose today or an earlier date.</Text>
                    ) : null}
                  </View>
                </View>
                <Text className="px-1 text-sm text-muted">This records money already paid outside the app. It does not send money.</Text>
                {saveError ? <Text selectable className="text-sm text-coral">{saveError}</Text> : null}
                <PrimaryButton label="Record payment" loading={isSaving} disabled={!isValid} onPress={() => void save()} />
              </>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </>
    )}</RouteModal>
  );
}
