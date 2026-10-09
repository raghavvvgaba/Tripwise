import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
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
import { SafeAreaView } from "react-native-safe-area-context";

import { useClayTheme } from "@/constants/clay-theme";
import { useCurrencyStore } from "@/store/use-currency-store";
import { useGroupActions } from "@/hooks/use-shared-groups";
import type { CurrencyCode } from "@/types/models";
import { showError } from "@/utils/dialogs";
import { SUPPORTED_CURRENCIES } from "@/utils/money";

export default function CreateGroupScreen() {
  const clay = useClayTheme();
  const { createGroup } = useGroupActions();
  const defaultCurrency = useCurrencyStore((state) => state.defaultCurrency);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>(defaultCurrency ?? "INR");
  const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const currencyAnim = useRef(new Animated.Value(0)).current;
  const [isSaving, setIsSaving] = useState(false);
  const selectedCurrency =
    SUPPORTED_CURRENCIES.find((item) => item.code === currency) ?? SUPPORTED_CURRENCIES[0];

  function openCurrencyModal() {
    Keyboard.dismiss();
    setCurrencyModalVisible(true);
    setIsCurrencyOpen(true);
    Animated.timing(currencyAnim, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  function closeCurrencyModal(onDone?: () => void) {
    setIsCurrencyOpen(false);
    Animated.timing(currencyAnim, {
      toValue: 0,
      duration: 190,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setCurrencyModalVisible(false);
      onDone?.();
    });
  }

  const currencyBackdropOpacity = currencyAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const currencySheetTranslateY = currencyAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [420, 0],
  });

  async function handleCreate() {
    if (!name.trim() || isSaving) return;
    setIsSaving(true);
    try {
      const group = await createGroup(name, currency);
      router.dismissTo("/");
      router.push(`/groups/${group.id}`);
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error && typeof error.message === "string"
          ? error.message
          : "Please try again.";
      showError("Could not create group", message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: clay.canvas }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Top Bar Header ── */}
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <Pressable
          accessibilityLabel="Close"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={{ backgroundColor: clay.headerBtn, borderColor: clay.cardBorder }}
          className="h-11 w-11 items-center justify-center rounded-2xl border active:opacity-75"
        >
          <Ionicons name="close" size={22} color={clay.textPrimary} />
        </Pressable>

        <View className="items-center">
          <Text style={{ color: clay.textMuted }} className="text-[11px] font-bold uppercase tracking-widest">
            New Group
          </Text>
          <Text style={{ color: clay.textPrimary }} className="text-base font-extrabold">
            Create Bill Group
          </Text>
        </View>

        <View className="h-11 w-11" />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="w-full max-w-2xl self-center gap-5 px-5 pb-10 pt-3 md:px-8"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Form Card ── */}
          <View
            style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
            className="gap-4 rounded-3xl border p-5 shadow-sm"
          >
            <View className="gap-2">
              <Text style={{ color: clay.textMuted }} className="text-xs font-bold uppercase tracking-wider">
                Group Name
              </Text>
              <TextInput
                autoFocus
                style={{
                  backgroundColor: clay.squircle,
                  borderColor: clay.cardBorder,
                  color: clay.textPrimary,
                }}
                className="h-14 rounded-2xl border px-4 text-base font-bold"
                placeholder="e.g. Manali Trip, Flatmates, Weekend Brunch"
                placeholderTextColor={clay.textMuted}
                value={name}
                onChangeText={setName}
                returnKeyType="next"
              />
            </View>

            <View className="gap-2">
              <Text style={{ color: clay.textMuted }} className="text-xs font-bold uppercase tracking-wider">
                Default Currency
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Group currency, ${selectedCurrency.label}`}
                accessibilityState={{ expanded: isCurrencyOpen }}
                onPress={openCurrencyModal}
                style={{
                  backgroundColor: clay.squircle,
                  borderColor: clay.cardBorder,
                }}
                className="h-14 flex-row items-center justify-between rounded-2xl border px-4 active:opacity-80"
              >
                <View className="flex-1 flex-row items-center gap-3">
                  <Text style={{ color: clay.textPrimary }} className="text-lg font-black">
                    {selectedCurrency.symbol}
                  </Text>
                  <Text style={{ color: clay.textPrimary }} className="text-sm font-black">
                    {selectedCurrency.code}
                  </Text>
                  <Text style={{ color: clay.textMuted }} className="flex-1 text-xs" numberOfLines={1}>
                    {selectedCurrency.label}
                  </Text>
                </View>
                <Ionicons
                  name={isCurrencyOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={clay.textMuted}
                />
              </Pressable>
            </View>
          </View>

          {/* ── Action Button ── */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create group"
            disabled={!name.trim() || isSaving}
            onPress={() => void handleCreate()}
            className="h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-[#F5D298] px-5 shadow-sm active:opacity-75 disabled:opacity-40"
          >
            {isSaving ? (
              <ActivityIndicator color={clay.heroText} />
            ) : (
              <>
                <Ionicons name="add" size={22} color={clay.heroText} />
                <Text style={{ color: clay.heroText }} className="text-base font-extrabold">
                  Create Group
                </Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Currency Selection Bottom Sheet Modal ── */}
      <Modal
        transparent
        visible={currencyModalVisible}
        animationType="none"
        onRequestClose={() => closeCurrencyModal()}
      >
        <View className="flex-1 justify-end">
          <Animated.View
            style={{ opacity: currencyBackdropOpacity }}
            className="absolute inset-0 bg-black/50"
          >
            <Pressable
              accessibilityLabel="Close currency options"
              onPress={() => closeCurrencyModal()}
              className="flex-1"
            />
          </Animated.View>

          <Animated.View
            style={[
              { transform: [{ translateY: currencySheetTranslateY }] },
              { backgroundColor: clay.card, borderTopColor: clay.cardBorder },
            ]}
            className="rounded-t-3xl border-t px-5 pb-10 pt-5 shadow-2xl"
          >
            <View className="w-full max-w-2xl self-center gap-4">
              <View className="flex-row items-center justify-between">
                <Text style={{ color: clay.textPrimary }} className="text-lg font-black">
                  Choose Currency
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close currency options"
                  onPress={() => closeCurrencyModal()}
                  style={{ backgroundColor: clay.squircle }}
                  className="h-9 w-9 items-center justify-center rounded-xl"
                >
                  <Ionicons name="close" size={20} color={clay.textMuted} />
                </Pressable>
              </View>

              <View
                style={{ borderColor: clay.cardBorder }}
                className="overflow-hidden rounded-2xl border"
              >
                {SUPPORTED_CURRENCIES.map((curr, idx) => {
                  const isSelected = currency === curr.code;
                  return (
                    <View key={curr.code}>
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityLabel={`${curr.label}, ${curr.code}`}
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => {
                          setCurrency(curr.code);
                          closeCurrencyModal();
                        }}
                        style={
                          isSelected
                            ? { backgroundColor: clay.isDark ? "#221C38" : "#E8E3F5" }
                            : undefined
                        }
                        className="h-14 flex-row items-center gap-3 px-4 active:opacity-75"
                      >
                        <Text
                          style={{
                            color: isSelected
                              ? clay.isDark
                                ? "#F5D298"
                                : "#2C254E"
                              : clay.textPrimary,
                          }}
                          className="w-7 text-lg font-black"
                        >
                          {curr.symbol}
                        </Text>
                        <Text
                          style={{
                            color: isSelected
                              ? clay.isDark
                                ? "#F5D298"
                                : "#2C254E"
                              : clay.textPrimary,
                          }}
                          className="w-12 text-sm font-black"
                        >
                          {curr.code}
                        </Text>
                        <Text
                          style={{ color: clay.textMuted }}
                          className="flex-1 text-xs"
                          numberOfLines={1}
                        >
                          {curr.label}
                        </Text>
                        {isSelected ? (
                          <Ionicons
                            name="checkmark-circle"
                            size={20}
                            color={clay.isDark ? "#F5D298" : "#2C254E"}
                          />
                        ) : null}
                      </Pressable>
                      {idx < SUPPORTED_CURRENCIES.length - 1 ? (
                        <View style={{ backgroundColor: clay.cardBorder }} className="h-px w-full" />
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
