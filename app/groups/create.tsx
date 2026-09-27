import { router, Stack } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { PrimaryButton } from "@/components/primary-button";
import { RouteModal } from "@/components/route-modal";
import { useGroupsStore } from "@/store/use-groups-store";
import { useSharedGroupsStore } from "@/store/use-shared-groups-store";
import type { CurrencyCode } from "@/types/models";
import { showError } from "@/utils/dialogs";
import { SUPPORTED_CURRENCIES } from "@/utils/money";

export default function CreateGroupScreen() {
  const createGroup = useSharedGroupsStore((state) => state.createGroup);
  const defaultCurrency = useGroupsStore((state) => state.defaultCurrency);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>(defaultCurrency ?? "INR");
  const [isSaving, setIsSaving] = useState(false);

  async function handleCreate() {
    if (!name.trim() || isSaving) return;
    setIsSaving(true);
    try {
      const group = await createGroup(name, currency);
      router.dismissTo("/");
      router.push(`/groups/${group.id}`);
    } catch (error) {
      showError("Could not create group", error instanceof Error ? error.message : "Please try again.");
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
            <Text className="section-label">Default currency</Text>
            <View className="gap-2">
              {SUPPORTED_CURRENCIES.map((curr) => {
                const isSelected = currency === curr.code;
                return (
                  <Pressable
                    key={curr.code}
                    onPress={() => setCurrency(curr.code)}
                    className={`min-h-14 flex-row items-center justify-between rounded-xl border px-4 ${
                      isSelected
                        ? "border-brand-500 bg-brand-50"
                        : "border-line bg-surface active:bg-canvas"
                    }`}
                  >
                    <Text className={`text-base font-semibold ${isSelected ? "text-brand-700" : "text-ink"}`}>
                      {curr.label}
                    </Text>
                    <Text className={`font-semibold ${isSelected ? "text-brand-700" : "text-muted"}`}>
                      {curr.code} · {curr.symbol}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <PrimaryButton label="Create group" onPress={handleCreate} disabled={!name.trim()} loading={isSaving} />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
    )}</RouteModal>
  );
}
