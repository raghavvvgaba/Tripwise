import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/empty-state";
import { MemberAvatar } from "@/components/member-avatar";
import { PrimaryButton } from "@/components/primary-button";
import { useGroupsStore } from "@/store/use-groups-store";
import type { ExpenseShare, SplitMode } from "@/types/models";
import { formatMoney, getCurrencySymbol, roundMoney } from "@/utils/money";

function makeEqualShares(memberIds: string[], total: number): ExpenseShare[] {
  const totalPaise = Math.round(total * 100);
  const basePaise = Math.floor(totalPaise / memberIds.length);
  const remainder = totalPaise % memberIds.length;

  return memberIds.map((memberId, index) => ({
    memberId,
    amount: (basePaise + (index < remainder ? 1 : 0)) / 100,
  }));
}

export default function AddExpenseScreen() {
  const insets = useSafeAreaInsets();
  const { groupId, expenseId } = useLocalSearchParams<{ groupId: string; expenseId?: string }>();
  const group = useGroupsStore((state) => state.groups.find((item) => item.id === groupId));
  const currentUserId = useGroupsStore((state) => state.currentUserId);
  const addExpense = useGroupsStore((state) => state.addExpense);
  const updateExpense = useGroupsStore((state) => state.updateExpense);
  const existingExpense = group?.expenses.find((expense) => expense.id === expenseId);

  const [description, setDescription] = useState(existingExpense?.description ?? "");
  const [amount, setAmount] = useState(existingExpense ? String(existingExpense.amount) : "");
  const [paidById, setPaidById] = useState(existingExpense?.paidById ?? currentUserId);
  const [splitMode, setSplitMode] = useState<SplitMode>(existingExpense?.splitMode ?? "equal");
  const [participantIds, setParticipantIds] = useState<string[]>(
    existingExpense?.shares.map((share) => share.memberId) ?? group?.members.map((member) => member.id) ?? [],
  );
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>(
    Object.fromEntries(existingExpense?.shares.map((share) => [share.memberId, String(share.amount)]) ?? []),
  );
  const [note, setNote] = useState(existingExpense?.note ?? "");

  const numericAmount = Number.parseFloat(amount) || 0;
  const exactTotal = useMemo(
    () => roundMoney(participantIds.reduce((total, id) => total + (Number.parseFloat(exactAmounts[id]) || 0), 0)),
    [exactAmounts, participantIds],
  );
  const exactDifference = roundMoney(numericAmount - exactTotal);
  const isValid =
    description.trim().length > 0 &&
    numericAmount > 0 &&
    participantIds.length > 0 &&
    (splitMode === "equal" || Math.abs(exactDifference) < 0.01);

  if (!group) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="px-5 py-8">
        <EmptyState emoji="🔎" title="Group not found" message="Return to your groups and try again." />
      </ScrollView>
    );
  }

  const activeGroupId = group.id;

  function toggleParticipant(memberId: string) {
    setParticipantIds((selected) =>
      selected.includes(memberId)
        ? selected.filter((id) => id !== memberId)
        : [...selected, memberId],
    );
  }

  function handleSave() {
    if (!isValid) return;

    const shares =
      splitMode === "equal"
        ? makeEqualShares(participantIds, numericAmount)
        : participantIds.map((memberId) => ({
            memberId,
            amount: roundMoney(Number.parseFloat(exactAmounts[memberId]) || 0),
          }));
    const input = {
      description: description.trim(),
      amount: roundMoney(numericAmount),
      paidById,
      shares,
      date: existingExpense?.date ?? new Date().toISOString(),
      note: note.trim() || undefined,
      splitMode,
    };

    if (existingExpense) {
      updateExpense(activeGroupId, existingExpense.id, input);
    } else {
      addExpense(activeGroupId, input);
    }

    router.dismissTo(`/groups/${activeGroupId}`);
  }

  return (
    <>
      <Stack.Screen options={{ title: existingExpense ? "Edit expense" : "Add expense" }} />
      <KeyboardAvoidingView behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView
          className="flex-1"
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode={process.env.EXPO_OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="gap-6 px-5 pb-6 pt-4"
          showsVerticalScrollIndicator={false}
        >
          <View className="card gap-5 p-5">
            <View className="gap-2">
              <Text className="section-label">What was it for?</Text>
              <TextInput
                autoFocus={!existingExpense}
                className="field"
                placeholder="Cab to hotel"
                placeholderTextColor="#9AA39D"
                value={description}
                onChangeText={setDescription}
                returnKeyType="next"
              />
            </View>
            <View className="gap-2">
              <Text className="section-label">Amount</Text>
              <View className="field flex-row items-center gap-2">
                <Text className="text-2xl font-semibold text-muted">{getCurrencySymbol(group.currency)}</Text>
                <TextInput
                  className="flex-1 py-3 text-2xl font-bold text-ink"
                  placeholder="0"
                  placeholderTextColor="#C2C9C4"
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                />
              </View>
            </View>
          </View>

          <View className="gap-3">
            <Text className="section-label px-1">Paid by</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pr-5">
              {group.members.map((member) => {
                const selected = paidById === member.id;
                return (
                  <Pressable
                    key={member.id}
                    onPress={() => setPaidById(member.id)}
                    className={`flex-row items-center gap-2 rounded-full border px-3 py-2 ${selected ? "border-brand-500 bg-brand-50" : "border-line bg-white"}`}
                  >
                    <MemberAvatar member={member} size="sm" />
                    <Text className={`text-sm font-semibold ${selected ? "text-brand-700" : "text-ink"}`}>
                      {member.id === currentUserId ? "You" : member.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View className="gap-3">
            <Text className="section-label px-1">Split method</Text>
            <View className="flex-row rounded-2xl bg-line p-1">
              {(["equal", "exact"] as const).map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => setSplitMode(mode)}
                  className={`min-h-11 flex-1 items-center justify-center rounded-xl ${splitMode === mode ? "bg-white" : ""}`}
                >
                  <Text className={`font-semibold ${splitMode === mode ? "text-ink" : "text-muted"}`}>
                    {mode === "equal" ? "Equally" : "Exact amounts"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="gap-3">
            <View className="flex-row items-end justify-between px-1">
              <View className="gap-1">
                <Text className="section-label">Split among</Text>
                <Text className="text-xs text-muted">Tap a person to include or exclude them.</Text>
              </View>
              <Text className="text-xs font-semibold text-muted">{participantIds.length} selected</Text>
            </View>
            <View className="card px-4">
              {group.members.map((member, index) => {
                const selected = participantIds.includes(member.id);
                const equalShare = participantIds.length > 0 ? numericAmount / participantIds.length : 0;
                return (
                  <View key={member.id}>
                    <Pressable onPress={() => toggleParticipant(member.id)} className="flex-row items-center gap-3 py-3">
                      <View className={`h-6 w-6 items-center justify-center rounded-lg border ${selected ? "border-brand-600 bg-brand-600" : "border-line bg-white"}`}>
                        {selected ? <Text className="text-xs font-bold text-white">✓</Text> : null}
                      </View>
                      <MemberAvatar member={member} size="sm" />
                      <View className="flex-1">
                        <Text className={`font-semibold ${selected ? "text-ink" : "text-muted"}`}>{member.name}</Text>
                        {member.isPlaceholder ? <Text className="text-[10px] text-muted">Not joined yet</Text> : null}
                      </View>
                      {selected && splitMode === "equal" ? (
                        <Text className="font-semibold text-muted">{formatMoney(equalShare, group.currency)}</Text>
                      ) : null}
                      {selected && splitMode === "exact" ? (
                        <View className="w-28 flex-row items-center rounded-xl bg-canvas px-3">
                          <Text className="text-muted">{getCurrencySymbol(group.currency)}</Text>
                          <TextInput
                            className="flex-1 py-2 text-right font-semibold text-ink"
                            keyboardType="decimal-pad"
                            placeholder="0"
                            placeholderTextColor="#9AA39D"
                            value={exactAmounts[member.id] ?? ""}
                            onChangeText={(value) =>
                              setExactAmounts((current) => ({ ...current, [member.id]: value }))
                            }
                          />
                        </View>
                      ) : null}
                    </Pressable>
                    {index < group.members.length - 1 ? <View className="h-px bg-line" /> : null}
                  </View>
                );
              })}
            </View>
            {splitMode === "exact" ? (
              <View className={`rounded-2xl px-4 py-3 ${Math.abs(exactDifference) < 0.01 ? "bg-brand-50" : "bg-orange-50"}`}>
                <Text className={`text-sm font-medium ${Math.abs(exactDifference) < 0.01 ? "text-brand-700" : "text-orange-700"}`}>
                  {Math.abs(exactDifference) < 0.01
                    ? "Amounts add up correctly"
                    : exactDifference > 0
                      ? `${formatMoney(exactDifference, group.currency)} left to assign`
                      : `${formatMoney(exactDifference, group.currency)} over the expense total`}
                </Text>
              </View>
            ) : null}
          </View>

          <View className="gap-2">
            <Text className="section-label px-1">Note (optional)</Text>
            <TextInput
              className="field min-h-24 py-4"
              placeholder="Add a useful detail"
              placeholderTextColor="#9AA39D"
              multiline
              textAlignVertical="top"
              value={note}
              onChangeText={setNote}
            />
          </View>

          <View className="rounded-2xl bg-brand-50 px-4 py-3">
            <Text className="text-sm text-brand-700">Date is set automatically to today.</Text>
          </View>
        </ScrollView>

        <View
          className="border-t border-line bg-canvas px-5 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <PrimaryButton
            label={existingExpense ? "Save changes" : "Add expense"}
            onPress={handleSave}
            disabled={!isValid}
          />
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
