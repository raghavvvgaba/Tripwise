import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/primary-button";
import { RouteModal } from "@/components/route-modal";
import { getGroupMembers, type GroupMember } from "@/lib/group-invites";
import { createGroupExpense } from "@/lib/expenses";
import type { SharedGroup } from "@/types/shared-group";
import { formatMoney, getCurrencySymbol, parseMoneyToMinor } from "@/utils/money";

function localDate(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

export function SharedExpenseForm({ group, currentUserId }: { group: SharedGroup; currentUserId: string }) {
  const insets = useSafeAreaInsets();
  const [members, setMembers] = useState<GroupMember[] | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidById, setPaidById] = useState(currentUserId);
  const [payerOpen, setPayerOpen] = useState(false);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [splitMode, setSplitMode] = useState<"equal" | "exact">("equal");
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setMembers(null);
    setMemberError(null);
    void getGroupMembers(group.id).then((nextMembers) => {
      if (!active) return;
      if (!nextMembers.some((member) => member.userId === currentUserId)) {
        setMemberError("You are no longer a member of this group.");
        return;
      }
      setMembers(nextMembers);
      setPaidById(currentUserId);
      setParticipantIds(nextMembers.map((member) => member.userId));
    }).catch((error: unknown) => {
      if (active) setMemberError(error instanceof Error ? error.message : "Could not load group members.");
    });
    return () => { active = false; };
  }, [group.id, currentUserId, loadAttempt]);

  const selectedMembers = useMemo(
    () => members?.filter((member) => participantIds.includes(member.userId)) ?? [],
    [members, participantIds],
  );
  const amountMinor = parseMoneyToMinor(amount);
  const exactMinor = selectedMembers.map((member) => parseMoneyToMinor(exactAmounts[member.userId] ?? ""));
  const exactTotalMinor = exactMinor.reduce<number>((total, value) => total + (value ?? 0), 0);
  const exactValid = exactMinor.every((value) => value !== null) && exactTotalMinor === amountMinor;
  const isValid =
    description.trim().length > 0 &&
    description.trim().length <= 120 &&
    amountMinor !== null && amountMinor > 0 &&
    selectedMembers.length > 0 &&
    Boolean(members?.some((member) => member.userId === paidById)) &&
    note.length <= 2000 &&
    (splitMode === "equal" || exactValid);

  function toggleParticipant(userId: string) {
    setParticipantIds((ids) => ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId]);
  }

  async function handleSave() {
    if (!isValid || amountMinor === null || savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    setSaveError(null);
    try {
      await createGroupExpense({
        groupId: group.id,
        description: description.trim(),
        amountMinor,
        paidById,
        memberIds: selectedMembers.map((member) => member.userId),
        splitMode,
        expenseDate: localDate(),
        exactAmountsMinor: splitMode === "exact" ? exactMinor.map((value) => value ?? 0) : null,
        note: note.trim(),
      });
      router.dismissTo(`/groups/${group.id}`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save the expense. Please try again.");
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <RouteModal title="Add expense">{() => (
      <>
        <Stack.Screen options={{ title: "Add expense" }} />
        <KeyboardAvoidingView behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined} className="flex-1">
          <ScrollView
            className="flex-1"
            contentInsetAdjustmentBehavior="automatic"
            keyboardDismissMode={process.env.EXPO_OS === "ios" ? "interactive" : "on-drag"}
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="w-full max-w-2xl self-center gap-6 px-5 pb-6 pt-5 md:px-8 lg:py-10"
            showsVerticalScrollIndicator={false}
          >
            <View className="card gap-5 p-5">
              <View className="gap-2">
                <Text className="section-label">What was it for?</Text>
                <TextInput
                  autoFocus
                  className="field"
                  placeholder="Cab to hotel"
                  placeholderTextColor="#9AA39D"
                  value={description}
                  onChangeText={setDescription}
                  maxLength={120}
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
                {amount && amountMinor === null ? <Text className="text-xs text-coral">Enter an amount with up to two decimal places.</Text> : null}
              </View>
            </View>

            <View className="gap-3">
              <Text className="section-label px-1">Paid by</Text>
              {members ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: payerOpen }}
                    onPress={() => setPayerOpen((open) => !open)}
                    className="card min-h-14 flex-row items-center justify-between px-4"
                  >
                    <Text className="font-semibold text-ink">
                      {paidById === currentUserId ? "You" : members.find((member) => member.userId === paidById)?.name}
                    </Text>
                    <Ionicons name={payerOpen ? "chevron-up" : "chevron-down"} size={18} color="#66736B" />
                  </Pressable>
                  {payerOpen ? (
                    <View className="card px-4">
                      {members.map((member, index) => (
                        <View key={member.userId}>
                          <Pressable
                            accessibilityRole="radio"
                            accessibilityState={{ selected: paidById === member.userId }}
                            onPress={() => { setPaidById(member.userId); setPayerOpen(false); }}
                            className="min-h-12 flex-row items-center justify-between gap-3 py-3"
                          >
                            <Text className="flex-1 font-medium text-ink">
                              {member.name}{member.userId === currentUserId ? " (you)" : ""}
                            </Text>
                            {paidById === member.userId ? <Ionicons name="checkmark" size={20} color="#087A52" /> : null}
                          </Pressable>
                          {index < members.length - 1 ? <View className="h-px bg-line" /> : null}
                        </View>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : memberError ? (
                <View className="card gap-3 p-4">
                  <Text selectable className="text-sm text-coral">{memberError}</Text>
                  <Pressable onPress={() => setLoadAttempt((attempt) => attempt + 1)}>
                    <Text className="font-semibold text-brand-700">Retry</Text>
                  </Pressable>
                </View>
              ) : <ActivityIndicator className="self-start" />}
            </View>

            {members ? (
              <>
                <View className="gap-3">
                  <Text className="section-label px-1">Split method</Text>
                  <View className="flex-row rounded-2xl bg-line p-1">
                    {(["equal", "exact"] as const).map((mode) => (
                      <Pressable
                        key={mode}
                        onPress={() => setSplitMode(mode)}
                        className={`min-h-11 flex-1 items-center justify-center rounded-xl ${splitMode === mode ? "bg-surface" : ""}`}
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
                    <Text className="text-xs font-semibold text-muted">{selectedMembers.length} selected</Text>
                  </View>
                  <View className="card px-4">
                    {members.map((member, index) => {
                      const selected = participantIds.includes(member.userId);
                      const selectedIndex = selectedMembers.findIndex((item) => item.userId === member.userId);
                      const equalShare = amountMinor && selectedIndex >= 0
                        ? Math.floor(amountMinor / selectedMembers.length) + (selectedIndex < amountMinor % selectedMembers.length ? 1 : 0)
                        : 0;
                      return (
                        <View key={member.userId}>
                          <View className="min-h-14 flex-row items-center gap-3 py-3">
                            <Pressable
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: selected }}
                              onPress={() => toggleParticipant(member.userId)}
                              className="min-h-10 flex-1 flex-row items-center gap-3"
                            >
                              <View className={`h-6 w-6 items-center justify-center rounded-lg border ${selected ? "border-brand-600 bg-brand-600" : "border-line bg-surface"}`}>
                                {selected ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
                              </View>
                              <Text className={`flex-1 font-semibold ${selected ? "text-ink" : "text-muted"}`} numberOfLines={1}>
                                {member.name}{member.userId === currentUserId ? " (you)" : ""}
                              </Text>
                            </Pressable>
                            {selected && splitMode === "equal" ? (
                              <Text className="font-semibold text-muted">{formatMoney(equalShare / 100, group.currency)}</Text>
                            ) : null}
                            {selected && splitMode === "exact" ? (
                              <View className="w-28 flex-row items-center rounded-xl bg-canvas px-3">
                                <Text className="text-muted">{getCurrencySymbol(group.currency)}</Text>
                                <TextInput
                                  className="flex-1 py-2 text-right font-semibold text-ink"
                                  keyboardType="decimal-pad"
                                  placeholder="0"
                                  placeholderTextColor="#9AA39D"
                                  value={exactAmounts[member.userId] ?? ""}
                                  onChangeText={(value) => setExactAmounts((current) => ({ ...current, [member.userId]: value }))}
                                />
                              </View>
                            ) : null}
                          </View>
                          {index < members.length - 1 ? <View className="h-px bg-line" /> : null}
                        </View>
                      );
                    })}
                  </View>
                  {splitMode === "exact" && amountMinor !== null ? (
                    <View className={`rounded-2xl px-4 py-3 ${exactValid ? "bg-brand-50" : "bg-orange-50 dark:bg-orange-950"}`}>
                      <Text className={`text-sm font-medium ${exactValid ? "text-brand-700" : "text-orange-700 dark:text-orange-300"}`}>
                        {exactValid ? "Amounts add up correctly" : `${formatMoney(Math.abs(amountMinor - exactTotalMinor) / 100, group.currency)} ${amountMinor >= exactTotalMinor ? "left to assign" : "over the expense total"}`}
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
                    maxLength={2000}
                    textAlignVertical="top"
                    value={note}
                    onChangeText={setNote}
                  />
                </View>

                <View className="rounded-2xl bg-brand-50 px-4 py-3">
                  <Text className="text-sm text-brand-700">Date is set automatically to today.</Text>
                </View>
              </>
            ) : null}
          </ScrollView>

          <View
            className="w-full max-w-2xl self-center gap-3 border-t border-line bg-canvas px-5 pt-3 md:px-8"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          >
            {saveError ? <Text selectable className="text-sm text-coral">{saveError}</Text> : null}
            <PrimaryButton label="Add expense" onPress={() => void handleSave()} disabled={!isValid} loading={isSaving} />
          </View>
        </KeyboardAvoidingView>
      </>
    )}</RouteModal>
  );
}
