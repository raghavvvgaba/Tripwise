import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  GestureResponderHandlers,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import AnimatedReanimated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useClayTheme } from "@/constants/clay-theme";
import { type GroupMember } from "@/lib/group-invites";
import { useGroupMembers, useGroupExpense } from "@/hooks/use-group-data";
import { useGroupDataActions } from "@/hooks/use-group-data-actions";
import type { CurrencyCode } from "@/types/models";
import type { SharedExpense } from "@/types/shared-expense";
import type { SharedGroup } from "@/types/shared-group";
import { formatMoney, getCurrencySymbol, parseMoneyToMinor } from "@/utils/money";

const AVATAR_RING_COLORS = [
  "#38BDF8", // Sky blue
  "#FB923C", // Coral orange
  "#4ADE80", // Mint green
  "#C084FC", // Soft lavender
  "#FBBF24", // Warm amber
  "#F472B6", // Rose pink
];

function localDate(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

type ExpenseFormProps = {
  group: SharedGroup;
  currentUserId: string;
  expenseId?: string;
  onClose?: () => void;
  headerPanHandlers?: GestureResponderHandlers;
};

export function SharedExpenseForm(props: ExpenseFormProps) {
  const membersQuery = useGroupMembers(props.group.id);
  const expenseQuery = useGroupExpense(props.group.id, props.expenseId ?? "");
  const members = membersQuery.data;
  const error = membersQuery.errorMessage ?? (props.expenseId ? expenseQuery.errorMessage : null);
  const retry = () => { void membersQuery.refetch(); if (props.expenseId) void expenseQuery.refetch(); };
  const ready = members && (!props.expenseId || expenseQuery.data);
  const isMember = members?.some((member) => member.userId === props.currentUserId);

  if (!ready || !isMember) {
    const message = members && !isMember ? "You are no longer a member of this group."
      : expenseQuery.data === null && props.expenseId ? "This expense has been deleted." : error;
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-canvas px-5">
        {message ? <Text className="text-center text-coral">{message}</Text> : <ActivityIndicator />}
        {message ? <Pressable onPress={retry}><Text className="font-semibold text-brand-700">Retry</Text></Pressable> : null}
        <Pressable onPress={props.onClose ?? (() => router.back())}><Text className="font-semibold text-ink">Close</Text></Pressable>
      </View>
    );
  }

  return <LoadedExpenseForm key={`${props.group.id}:${props.expenseId ?? "new"}`} {...props}
    members={members} initialExpense={expenseQuery.data ?? null} />;
}

function LoadedExpenseForm({ group, currentUserId, expenseId, onClose, headerPanHandlers, members, initialExpense }: ExpenseFormProps & {
  members: GroupMember[];
  initialExpense: SharedExpense | null;
}) {
  const clay = useClayTheme();
  const insets = useSafeAreaInsets();
  const { createExpense, updateExpense } = useGroupDataActions(group.id);
  // Capture the revision with the draft so a background read cannot bypass edit-conflict checks.
  const [existingExpense] = useState(initialExpense);
  const [description, setDescription] = useState(initialExpense?.description ?? "");
  const [amount, setAmount] = useState(initialExpense ? String(initialExpense.amountMinor / 100) : "");
  const initialPayers = initialExpense?.payers ?? [];
  const [payerMode, setPayerMode] = useState<"single" | "multiple">(initialPayers.length > 1 ? "multiple" : "single");
  const [paidById, setPaidById] = useState(initialPayers[0]?.userId ?? currentUserId);
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>(
    Object.fromEntries(initialPayers.map((payer) => [payer.userId, String(payer.amountMinor / 100)]))
  );
  const [payerOpen, setPayerOpen] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const animValue = useRef(new Animated.Value(0)).current;
  const [participantIds, setParticipantIds] = useState<string[]>(initialExpense?.shares.map((share) => share.userId) ?? members.map((member) => member.userId));
  const [splitMode, setSplitMode] = useState<"equal" | "exact">(initialExpense?.splitMode ?? "equal");
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>(Object.fromEntries(initialExpense?.shares.map((share) => [share.userId, String(share.amountMinor / 100)]) ?? []));
  const [note, setNote] = useState(initialExpense?.note ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const isNoteFocusedRef = useRef(false);
  const [isNoteFocused, setIsNoteFocused] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
      isNoteFocusedRef.current = false;
      setIsNoteFocused(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const selectedMembers = useMemo(
    () => members?.filter((member) => participantIds.includes(member.userId)) ?? [],
    [members, participantIds]
  );
  const amountMinor = parseMoneyToMinor(amount);
  const exactMinor = selectedMembers.map((member) => parseMoneyToMinor(exactAmounts[member.userId] ?? ""));
  const exactTotalMinor = exactMinor.reduce<number>((total, value) => total + (value ?? 0), 0);
  const exactValid = exactMinor.every((value) => value !== null) && exactTotalMinor === amountMinor;
  // A blank payer amount means that member did not pay.
  const payerMinor = members.map((member) => {
    const value = (payerAmounts[member.userId] ?? "").trim();
    return value === "" ? 0 : parseMoneyToMinor(value);
  });
  const payerTotalMinor = payerMinor.reduce<number>((total, value) => total + (value ?? 0), 0);
  const payersValid = payerMode === "single"
    ? members.some((member) => member.userId === paidById)
    : payerMinor.every((value) => value !== null) && payerTotalMinor === amountMinor;
  const isValid =
    description.trim().length > 0 &&
    description.trim().length <= 120 &&
    amountMinor !== null &&
    amountMinor > 0 &&
    selectedMembers.length > 0 &&
    payersValid &&
    note.length <= 2000 &&
    (!expenseId || existingExpense !== null) &&
    (splitMode === "equal" || exactValid);

  const memberIndexFor = (userId: string) => Math.max(0, (members ?? []).findIndex((m) => m.userId === userId));

  function toggleParticipant(userId: string) {
    setParticipantIds((ids) => (ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId]));
  }

  function chooseMultiplePayers() {
    // Start from the current single payer so the total is already assigned.
    if (Object.values(payerAmounts).every((value) => value.trim() === "")) {
      setPayerAmounts(amountMinor ? { [paidById]: String(amountMinor / 100) } : {});
    }
    setPayerMode("multiple");
    closePayerModal();
  }

  function openPayerModal() {
    Keyboard.dismiss();
    setModalVisible(true);
    setPayerOpen(true);
    Animated.timing(animValue, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  function closePayerModal(onDone?: () => void) {
    setPayerOpen(false);
    Animated.timing(animValue, {
      toValue: 0,
      duration: 190,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false);
      onDone?.();
    });
  }

  const backdropOpacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const sheetTranslateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [420, 0],
  });


  async function handleSave() {
    if (!isValid || amountMinor === null || savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    setSaveError(null);
    try {
      const input = {
        groupId: group.id,
        description: description.trim(),
        amountMinor,
        payers: payerMode === "single"
          ? [{ userId: paidById, amountMinor }]
          : members.flatMap((member, index) => {
              const value = payerMinor[index];
              return value ? [{ userId: member.userId, amountMinor: value }] : [];
            }),
        memberIds: selectedMembers.map((member) => member.userId),
        splitMode,
        exactAmountsMinor: splitMode === "exact" ? exactMinor.map((value) => value ?? 0) : null,
        note: note.trim(),
      };
      if (existingExpense) {
        await updateExpense({
          ...input,
          expenseId: existingExpense.id,
          expectedUpdatedAt: existingExpense.updatedAt,
        });
        router.dismissTo({ pathname: "/expenses/[expenseId]", params: { groupId: group.id, expenseId: existingExpense.id } });
      } else {
        await createExpense({ ...input, expenseDate: localDate() });
        router.dismissTo(`/groups/${group.id}`);
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save the expense. Please try again.");
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: clay.canvas }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Drag Handle & Top Bar Header ── */}
      <View {...headerPanHandlers} className="w-full">
        <View className="items-center pt-2 pb-1">
          <View
            style={{ backgroundColor: clay.cardBorder }}
            className="h-1.5 w-12 rounded-full opacity-60"
          />
        </View>

        <View className="flex-row items-center justify-between px-5 pt-1 pb-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => (onClose ? onClose() : router.back())}
            style={{ backgroundColor: clay.headerBtn, borderColor: clay.cardBorder }}
            className="h-11 w-11 items-center justify-center rounded-2xl border active:opacity-75"
          >
            <Ionicons name="close" size={22} color={clay.textPrimary} />
          </Pressable>

          <View className="items-center">
            <Text style={{ color: clay.textMuted }} className="text-[11px] font-bold uppercase tracking-widest">
              {expenseId ? "Edit Expense" : "New Expense"}
            </Text>
            <Text style={{ color: clay.textPrimary }} className="max-w-[200px] text-base font-extrabold" numberOfLines={1}>
              {group.name}
            </Text>
          </View>

          <View className="h-11 w-11" />
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          ref={scrollViewRef}
          className="flex-1"
          contentInsetAdjustmentBehavior="never"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="w-full max-w-2xl self-center px-5 gap-5"
          contentContainerStyle={{ paddingBottom: isNoteFocused ? 260 : 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Expense Details: Description & Amount Card ── */}
          <AnimatedReanimated.View
            entering={FadeInDown.duration(280).delay(60)}
            style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
            className="gap-4 rounded-3xl border p-5 shadow-sm"
          >
            <View className="gap-2">
              <Text style={{ color: clay.textMuted }} className="text-xs font-bold uppercase tracking-wider">
                What was it for?
              </Text>
              <TextInput
                style={{
                  backgroundColor: clay.squircle,
                  borderColor: clay.cardBorder,
                  color: clay.textPrimary,
                }}
                className="h-13 rounded-2xl border px-4 text-base font-bold"
                placeholder="e.g. Dinner, Train ticket, Groceries"
                placeholderTextColor={clay.textMuted}
                value={description}
                onChangeText={setDescription}
                maxLength={120}
              />
            </View>

            <View className="gap-2">
              <Text style={{ color: clay.textMuted }} className="text-xs font-bold uppercase tracking-wider">
                Amount
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
                  placeholder="0.00"
                  placeholderTextColor={clay.textMuted}
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                />
              </View>
              {amount && amountMinor === null ? (
                <Text style={{ color: clay.errorText }} className="px-1 text-xs">
                  Enter an amount with up to two decimal places.
                </Text>
              ) : null}
            </View>
          </AnimatedReanimated.View>

          {/* ── Paid By Section ── */}
          <AnimatedReanimated.View entering={FadeInDown.duration(280).delay(120)} className="gap-2">
            <Text style={{ color: clay.textMuted }} className="px-1 text-xs font-bold uppercase tracking-wider">
              Paid by
            </Text>
            {members ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Paid by ${payerMode === "multiple" ? "multiple people" : paidById === currentUserId ? "you" : members.find((m) => m.userId === paidById)?.name ?? "member"}`}
                  accessibilityState={{ expanded: payerOpen }}
                  onPress={openPayerModal}
                  style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
                  className="h-14 flex-row items-center justify-between rounded-3xl border px-4 shadow-sm active:opacity-80"
                >
                  <View className="flex-row items-center gap-3">
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        borderWidth: 2,
                        borderColor: payerMode === "multiple"
                          ? clay.cardBorder
                          : AVATAR_RING_COLORS[memberIndexFor(paidById) % AVATAR_RING_COLORS.length],
                        backgroundColor: clay.avatarBg,
                      }}
                      className="items-center justify-center"
                    >
                      {payerMode === "multiple" ? (
                        <Ionicons name="people" size={16} color={clay.textPrimary} />
                      ) : (
                        <Text style={{ color: clay.textPrimary }} className="text-xs font-black">
                          {((members.find((m) => m.userId === paidById)?.name ?? "?").trim()[0] || "?").toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <Text style={{ color: clay.textPrimary }} className="text-base font-bold">
                      {payerMode === "multiple"
                        ? "Multiple people"
                        : paidById === currentUserId ? "You" : members.find((m) => m.userId === paidById)?.name}
                    </Text>
                  </View>
                  <Ionicons name={payerOpen ? "chevron-up" : "chevron-down"} size={18} color={clay.textMuted} />
                </Pressable>

                <Modal
                  transparent
                  visible={modalVisible}
                  animationType="none"
                  onRequestClose={() => closePayerModal()}
                >
                  <View className="flex-1 justify-end">
                    <Animated.View
                      style={{ opacity: backdropOpacity }}
                      className="absolute inset-0 bg-black/40"
                    >
                      <Pressable
                        accessibilityLabel="Close member options"
                        onPress={() => closePayerModal()}
                        className="flex-1"
                      />
                    </Animated.View>
                    <Animated.View
                      style={{
                        transform: [{ translateY: sheetTranslateY }],
                        backgroundColor: clay.card,
                        borderColor: clay.cardBorder,
                        paddingBottom: Math.max(insets.bottom, 24) + 8,
                      }}
                      className="rounded-t-3xl border-t px-5 pt-5"
                    >
                      <View className="w-full max-w-2xl self-center gap-4">
                        <View className="flex-row items-center justify-between">
                          <Text style={{ color: clay.textPrimary }} className="text-lg font-bold">
                            Paid by
                          </Text>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Close member options"
                            onPress={() => closePayerModal()}
                            className="h-10 w-10 items-center justify-center rounded-full active:opacity-75"
                          >
                            <Ionicons name="close" size={22} color={clay.textMuted} />
                          </Pressable>
                        </View>

                        <View
                          style={{ borderColor: clay.cardBorder }}
                          className="overflow-hidden rounded-xl border"
                        >
                          <ScrollView
                            nestedScrollEnabled
                            showsVerticalScrollIndicator={members.length > 5}
                            style={{ maxHeight: 360 }}
                          >
                            {members.map((member, index) => {
                              const isSelected = payerMode === "single" && paidById === member.userId;
                              const mRing = AVATAR_RING_COLORS[memberIndexFor(member.userId) % AVATAR_RING_COLORS.length];
                              return (
                                <View key={member.userId}>
                                  <Pressable
                                    accessibilityRole="radio"
                                    accessibilityLabel={`${member.name}${member.userId === currentUserId ? " (you)" : ""}`}
                                    accessibilityState={{ selected: isSelected }}
                                    onPress={() => {
                                      setPaidById(member.userId);
                                      setPayerMode("single");
                                      closePayerModal();
                                    }}
                                    style={isSelected ? { backgroundColor: clay.squircle } : undefined}
                                    className="min-h-14 flex-row items-center justify-between gap-3 px-4 active:opacity-75"
                                  >
                                    <View className="flex-row items-center gap-3">
                                      <View
                                        style={{
                                          width: 32,
                                          height: 32,
                                          borderRadius: 16,
                                          borderWidth: 2,
                                          borderColor: mRing,
                                          backgroundColor: clay.avatarBg,
                                        }}
                                        className="items-center justify-center"
                                      >
                                        <Text style={{ color: clay.textPrimary }} className="text-xs font-black">
                                          {(member.name.trim()[0] || "?").toUpperCase()}
                                        </Text>
                                      </View>
                                      <Text style={{ color: clay.textPrimary }} className="text-sm font-bold">
                                        {member.name}
                                        {member.userId === currentUserId ? " (you)" : ""}
                                      </Text>
                                    </View>
                                    {isSelected ? (
                                      <Ionicons name="checkmark" size={20} color="#F5D298" />
                                    ) : null}
                                  </Pressable>
                                  <View style={{ backgroundColor: clay.cardBorder }} className="h-px w-full" />
                                </View>
                              );
                            })}
                            <Pressable
                              accessibilityRole="radio"
                              accessibilityLabel="Multiple people"
                              accessibilityState={{ selected: payerMode === "multiple" }}
                              onPress={chooseMultiplePayers}
                              style={payerMode === "multiple" ? { backgroundColor: clay.squircle } : undefined}
                              className="min-h-14 flex-row items-center justify-between gap-3 px-4 active:opacity-75"
                            >
                              <View className="flex-row items-center gap-3">
                                <View
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 16,
                                    borderWidth: 2,
                                    borderColor: clay.cardBorder,
                                    backgroundColor: clay.avatarBg,
                                  }}
                                  className="items-center justify-center"
                                >
                                  <Ionicons name="people" size={15} color={clay.textPrimary} />
                                </View>
                                <View>
                                  <Text style={{ color: clay.textPrimary }} className="text-sm font-bold">
                                    Multiple people
                                  </Text>
                                  <Text style={{ color: clay.textMuted }} className="text-xs">
                                    Enter how much each person paid
                                  </Text>
                                </View>
                              </View>
                              {payerMode === "multiple" ? (
                                <Ionicons name="checkmark" size={20} color="#F5D298" />
                              ) : null}
                            </Pressable>
                          </ScrollView>
                        </View>
                      </View>
                    </Animated.View>
                  </View>
                </Modal>

                {payerMode === "multiple" ? (
                  <>
                    <View
                      style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
                      className="overflow-hidden rounded-3xl border px-4 py-1 shadow-sm"
                    >
                      {members.map((member, index) => (
                        <View key={member.userId}>
                          <View className="flex-row items-center gap-3 py-3">
                            <View
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                borderWidth: 2,
                                borderColor: AVATAR_RING_COLORS[memberIndexFor(member.userId) % AVATAR_RING_COLORS.length],
                                backgroundColor: clay.avatarBg,
                              }}
                              className="items-center justify-center"
                            >
                              <Text style={{ color: clay.textPrimary }} className="text-xs font-black">
                                {(member.name.trim()[0] || "?").toUpperCase()}
                              </Text>
                            </View>
                            <Text style={{ color: clay.textPrimary }} className="flex-1 text-sm font-bold" numberOfLines={1}>
                              {member.name}
                              {member.userId === currentUserId ? " (you)" : ""}
                            </Text>
                            <View
                              style={{ backgroundColor: clay.squircle, borderColor: clay.cardBorder }}
                              className="w-28 flex-row items-center rounded-xl border px-2.5"
                            >
                              <Text style={{ color: clay.textMuted }} className="text-xs font-bold">
                                {getCurrencySymbol(group.currency)}
                              </Text>
                              <TextInput
                                accessibilityLabel={`Amount paid by ${member.name}`}
                                style={{ color: clay.textPrimary }}
                                className="flex-1 py-1.5 text-right text-sm font-bold"
                                keyboardType="decimal-pad"
                                placeholder="0"
                                placeholderTextColor={clay.textMuted}
                                value={payerAmounts[member.userId] ?? ""}
                                onChangeText={(value) =>
                                  setPayerAmounts((current) => ({ ...current, [member.userId]: value }))
                                }
                              />
                            </View>
                          </View>
                          {index < members.length - 1 ? (
                            <View style={{ backgroundColor: clay.cardBorder }} className="h-px w-full" />
                          ) : null}
                        </View>
                      ))}
                    </View>
                    {amountMinor !== null ? (
                      <AmountCheck
                        valid={payersValid}
                        expectedMinor={amountMinor}
                        enteredMinor={payerTotalMinor}
                        currency={group.currency}
                      />
                    ) : null}
                  </>
                ) : null}
              </>
            ) : (
              <ActivityIndicator color="#F5D298" className="self-start py-2" />
            )}
          </AnimatedReanimated.View>

          {members ? (
            <>
              {/* ── Split Method Toggle ── */}
              <AnimatedReanimated.View entering={FadeInDown.duration(280).delay(180)} className="gap-2">
                <Text style={{ color: clay.textMuted }} className="px-1 text-xs font-bold uppercase tracking-wider">
                  Split Method
                </Text>
                <View
                  style={{ backgroundColor: clay.squircle, borderColor: clay.cardBorder }}
                  className="flex-row rounded-2xl border p-1"
                >
                  {(["equal", "exact"] as const).map((mode) => {
                    const isSelected = splitMode === mode;
                    return (
                      <Pressable
                        key={mode}
                        onPress={() => setSplitMode(mode)}
                        style={
                          isSelected
                            ? { backgroundColor: clay.card, borderColor: clay.cardBorder }
                            : undefined
                        }
                        className={`h-11 flex-1 items-center justify-center rounded-xl ${isSelected ? "border shadow-sm" : "shadow-none"}`}
                      >
                        <Text
                          style={{ color: isSelected ? clay.textPrimary : clay.textMuted }}
                          className="text-xs font-extrabold"
                        >
                          {mode === "equal" ? "Equally" : "Exact Amounts"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </AnimatedReanimated.View>

              {/* ── Split Among Section ── */}
              <AnimatedReanimated.View entering={FadeInDown.duration(280).delay(220)} className="gap-2">
                <View className="flex-row items-baseline justify-between px-1">
                  <Text style={{ color: clay.textMuted }} className="text-xs font-bold uppercase tracking-wider">
                    Split Among
                  </Text>
                  <View style={{ backgroundColor: clay.badgeNeutralBg }} className="rounded-full px-2.5 py-0.5">
                    <Text style={{ color: clay.textMuted }} className="text-[11px] font-bold">
                      {selectedMembers.length} selected
                    </Text>
                  </View>
                </View>

                <View
                  style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
                  className="overflow-hidden rounded-3xl border px-4 py-1 shadow-sm"
                >
                  {members.map((member, index) => {
                    const selected = participantIds.includes(member.userId);
                    const selectedIndex = selectedMembers.findIndex((item) => item.userId === member.userId);
                    const equalShare =
                      amountMinor && selectedIndex >= 0
                        ? Math.floor(amountMinor / selectedMembers.length) +
                          (selectedIndex < amountMinor % selectedMembers.length ? 1 : 0)
                        : 0;
                    const mRing = AVATAR_RING_COLORS[memberIndexFor(member.userId) % AVATAR_RING_COLORS.length];

                    return (
                      <View key={member.userId}>
                        <View className="flex-row items-center gap-3 py-3">
                          <Pressable
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: selected }}
                            onPress={() => toggleParticipant(member.userId)}
                            className="flex-1 flex-row items-center gap-3"
                          >
                            <View
                              style={{
                                backgroundColor: selected ? "#F5D298" : clay.squircle,
                                borderColor: selected ? "#F5D298" : clay.cardBorder,
                              }}
                              className="h-6 w-6 items-center justify-center rounded-lg border"
                            >
                              {selected ? <Ionicons name="checkmark" size={15} color={clay.heroText} /> : null}
                            </View>

                            <View
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                borderWidth: 2,
                                borderColor: mRing,
                                backgroundColor: clay.avatarBg,
                              }}
                              className="items-center justify-center"
                            >
                              <Text style={{ color: clay.textPrimary }} className="text-xs font-black">
                                {(member.name.trim()[0] || "?").toUpperCase()}
                              </Text>
                            </View>

                            <Text
                              style={{ color: selected ? clay.textPrimary : clay.textMuted }}
                              className="flex-1 text-sm font-bold"
                              numberOfLines={1}
                            >
                              {member.name}
                              {member.userId === currentUserId ? " (you)" : ""}
                            </Text>
                          </Pressable>

                          {selected && splitMode === "equal" ? (
                            <Text selectable style={{ color: clay.textPrimary }} className="text-sm font-extrabold">
                              {formatMoney(equalShare / 100, group.currency)}
                            </Text>
                          ) : null}

                          {selected && splitMode === "exact" ? (
                            <View
                              style={{ backgroundColor: clay.squircle, borderColor: clay.cardBorder }}
                              className="w-28 flex-row items-center rounded-xl border px-2.5"
                            >
                              <Text style={{ color: clay.textMuted }} className="text-xs font-bold">
                                {getCurrencySymbol(group.currency)}
                              </Text>
                              <TextInput
                                style={{ color: clay.textPrimary }}
                                className="flex-1 py-1.5 text-right text-sm font-bold"
                                keyboardType="decimal-pad"
                                placeholder="0"
                                placeholderTextColor={clay.textMuted}
                                value={exactAmounts[member.userId] ?? ""}
                                onChangeText={(value) =>
                                  setExactAmounts((current) => ({ ...current, [member.userId]: value }))
                                }
                              />
                            </View>
                          ) : null}
                        </View>
                        {index < members.length - 1 ? (
                          <View style={{ backgroundColor: clay.cardBorder }} className="h-px w-full" />
                        ) : null}
                      </View>
                    );
                  })}
                </View>

                {splitMode === "exact" && amountMinor !== null ? (
                  <AmountCheck
                    valid={exactValid}
                    expectedMinor={amountMinor}
                    enteredMinor={exactTotalMinor}
                    currency={group.currency}
                  />
                ) : null}
              </AnimatedReanimated.View>

              {/* ── Optional Note ── */}
              <AnimatedReanimated.View entering={FadeInDown.duration(280).delay(260)} className="gap-2">
                <Text style={{ color: clay.textMuted }} className="px-1 text-xs font-bold uppercase tracking-wider">
                  Note (Optional)
                </Text>
                <TextInput
                  style={{
                    backgroundColor: clay.card,
                    borderColor: clay.cardBorder,
                    color: clay.textPrimary,
                  }}
                  className="min-h-20 rounded-3xl border p-4 text-sm font-medium"
                  placeholder="Add details, receipt notes, etc."
                  placeholderTextColor={clay.textMuted}
                  multiline
                  scrollEnabled={false}
                  maxLength={2000}
                  textAlignVertical="top"
                  value={note}
                  onChangeText={setNote}
                  onFocus={() => {
                    isNoteFocusedRef.current = true;
                    setIsNoteFocused(true);
                    setTimeout(() => {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                    }, 100);
                  }}
                  onBlur={() => {
                    isNoteFocusedRef.current = false;
                    setIsNoteFocused(false);
                  }}
                  onContentSizeChange={() => {
                    if (isNoteFocusedRef.current) {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                    }
                  }}
                />
              </AnimatedReanimated.View>
            </>
          ) : null}
        </ScrollView>

        {/* ── Fixed Bottom Save Container ── */}
        <View
          style={{
            backgroundColor: clay.canvas,
            borderColor: clay.cardBorder,
            paddingBottom: isKeyboardVisible ? 12 : Math.max(insets.bottom, 12) + 8,
          }}
          className="w-full max-w-2xl self-center border-t px-5 pt-3"
        >
          {saveError ? (
            <Text selectable style={{ color: clay.errorText }} className="mb-2 text-center text-xs font-semibold">
              {saveError}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={expenseId ? "Save changes" : "Add expense"}
            disabled={!isValid || isSaving}
            onPress={() => void handleSave()}
            className="h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-[#F5D298] px-5 shadow-sm active:opacity-75 disabled:opacity-40"
          >
            {isSaving ? (
              <ActivityIndicator color={clay.heroText} />
            ) : (
              <>
                <Ionicons name={expenseId ? "checkmark" : "add"} size={22} color={clay.heroText} />
                <Text style={{ color: clay.heroText }} className="text-base font-extrabold">
                  {expenseId ? "Save Changes" : "Add Expense"}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Shows whether entered amounts add up to the expense total. */
function AmountCheck({ valid, expectedMinor, enteredMinor, currency }: {
  valid: boolean;
  expectedMinor: number;
  enteredMinor: number;
  currency: CurrencyCode;
}) {
  const clay = useClayTheme();
  const differenceMinor = expectedMinor - enteredMinor;
  return (
    <View
      style={{ backgroundColor: valid ? clay.badgePositiveBg : clay.badgeNegativeBg }}
      className="rounded-2xl px-4 py-2.5"
    >
      <Text
        style={{ color: valid ? clay.badgePositiveText : clay.badgeNegativeText }}
        className="text-xs font-bold"
      >
        {valid
          ? "Amounts add up correctly"
          : differenceMinor === 0
            ? "Enter amounts with up to two decimal places"
            : `${formatMoney(Math.abs(differenceMinor) / 100, currency)} ${differenceMinor > 0 ? "left to assign" : "over the total"}`}
      </Text>
    </View>
  );
}
