import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useRef, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { PrimaryButton } from "@/components/primary-button";
import { RouteModal } from "@/components/route-modal";
import { themeColors, themeVariables, useThemeColors } from "@/constants/theme";
import { useCurrencyStore } from "@/store/use-currency-store";
import { useSharedGroupsStore } from "@/store/use-shared-groups-store";
import type { CurrencyCode } from "@/types/models";
import { showError } from "@/utils/dialogs";
import { SUPPORTED_CURRENCIES } from "@/utils/money";

export default function CreateGroupScreen() {
  const colors = useThemeColors();
  const createGroup = useSharedGroupsStore((state) => state.createGroup);
  const defaultCurrency = useCurrencyStore((state) => state.defaultCurrency);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>(defaultCurrency ?? "INR");
  const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const currencyAnim = useRef(new Animated.Value(0)).current;
  const [isSaving, setIsSaving] = useState(false);
  const selectedCurrency = SUPPORTED_CURRENCIES.find((item) => item.code === currency) ?? SUPPORTED_CURRENCIES[0];

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
      const message = error && typeof error === "object" && "message" in error && typeof error.message === "string"
        ? error.message
        : "Please try again.";
      showError("Could not create group", message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <RouteModal title="New group">{(dismiss) => (
    <>
      <Stack.Screen
        options={{
          title: "New group",
          headerLeft: () => (
            <Pressable
              accessibilityLabel="Close new group"
              accessibilityRole="button"
              onPress={dismiss}
              className="h-11 w-11 items-center justify-center rounded-full active:bg-line"
            >
              <Text className="text-3xl font-light leading-8 text-ink">×</Text>
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="w-full max-w-2xl self-center gap-6 px-5 pb-10 pt-5 md:px-8 lg:py-10"
        >
          <View className="gap-2">
            <Text className="section-label">Group name</Text>
            <TextInput
              autoFocus
              className="field"
              placeholder="Goa Trip"
              placeholderTextColor="#9AA39D"
              value={name}
              onChangeText={setName}
              returnKeyType="next"
            />
          </View>

          <View className="gap-2">
            <Text className="section-label">Group currency</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Group currency, ${selectedCurrency.label}`}
              accessibilityState={{ expanded: isCurrencyOpen }}
              onPress={openCurrencyModal}
              className={`min-h-14 flex-row items-center justify-between rounded-xl border bg-surface px-4 active:bg-canvas ${
                isCurrencyOpen ? "border-brand-500" : "border-line"
              }`}
            >
              <View className="flex-1 flex-row items-center gap-3">
                <Text className="text-lg font-semibold text-ink">{selectedCurrency.symbol}</Text>
                <Text className="text-base font-semibold text-ink">{selectedCurrency.code}</Text>
                <Text className="flex-1 text-sm text-muted" numberOfLines={1}>{selectedCurrency.label}</Text>
              </View>
              <Ionicons name={isCurrencyOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
            </Pressable>
          </View>

          <PrimaryButton label="Create group" onPress={handleCreate} disabled={!name.trim()} loading={isSaving} />
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal transparent visible={currencyModalVisible} animationType="none" onRequestClose={() => closeCurrencyModal()}>
        <View className="flex-1 justify-end" style={colors === themeColors.dark ? themeVariables.dark : themeVariables.light}>
          <Animated.View
            style={{ opacity: currencyBackdropOpacity }}
            className="absolute inset-0 bg-black/40"
          >
            <Pressable
              accessibilityLabel="Close currency options"
              onPress={() => closeCurrencyModal()}
              className="flex-1"
            />
          </Animated.View>
          <Animated.View
            style={{ transform: [{ translateY: currencySheetTranslateY }] }}
            className="rounded-t-3xl border-t border-line bg-surface px-5 pb-10 pt-5"
          >
            <View className="w-full max-w-2xl self-center gap-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-bold text-ink">Choose currency</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close currency options"
                  onPress={() => closeCurrencyModal()}
                  className="h-10 w-10 items-center justify-center rounded-full active:bg-canvas"
                >
                  <Ionicons name="close" size={22} color={colors.muted} />
                </Pressable>
              </View>
              <View className="overflow-hidden rounded-xl border border-line">
                {SUPPORTED_CURRENCIES.map((curr) => {
                  const isSelected = currency === curr.code;
                  return (
                    <Pressable
                      key={curr.code}
                      accessibilityRole="radio"
                      accessibilityLabel={`${curr.label}, ${curr.code}`}
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => {
                        setCurrency(curr.code);
                        closeCurrencyModal();
                      }}
                      className={`min-h-14 flex-row items-center gap-3 px-4 active:bg-canvas ${
                        isSelected ? "bg-brand-50" : "bg-surface"
                      }`}
                    >
                      <Text className={`w-6 text-lg font-semibold ${isSelected ? "text-brand-700" : "text-ink"}`}>
                        {curr.symbol}
                      </Text>
                      <Text className={`w-12 font-semibold ${isSelected ? "text-brand-700" : "text-ink"}`}>
                        {curr.code}
                      </Text>
                      <Text className={`flex-1 text-sm ${isSelected ? "text-brand-700" : "text-muted"}`}>
                        {curr.label}
                      </Text>
                      {isSelected ? <Ionicons name="checkmark" size={18} color={colors["brand-700"]} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
    )}</RouteModal>
  );
}
