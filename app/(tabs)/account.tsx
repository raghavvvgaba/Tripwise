import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useClayTheme } from "@/constants/clay-theme";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/use-auth-store";
import { useCurrencyStore } from "@/store/use-currency-store";
import { useSharedGroups } from "@/hooks/use-shared-groups";
import { useSettingsStore } from "@/store/use-settings-store";
import { version } from "@/package.json";
import { showError } from "@/utils/dialogs";
import { SUPPORTED_CURRENCIES } from "@/utils/money";

export default function AccountScreen() {
  const clay = useClayTheme();
  const accountEmail = useAuthStore((state) => state.session?.user.email);
  const accountName = useAuthStore((state) => {
    const metadata = state.session?.user.user_metadata;
    const name: unknown = metadata?.name;
    const fullName: unknown = metadata?.full_name;
    if (typeof name === "string" && name.trim()) return name.trim();
    return typeof fullName === "string" && fullName.trim() ? fullName.trim() : null;
  });
  const defaultCurrency = useCurrencyStore((state) => state.defaultCurrency);
  const setDefaultCurrency = useCurrencyStore((state) => state.setDefaultCurrency);
  const { groups } = useSharedGroups();
  const themePreference = useSettingsStore((state) => state.themePreference);
  const setThemePreference = useSettingsStore((state) => state.setThemePreference);

  const [activeSheet, setActiveSheet] = useState<"appearance" | "currency">("appearance");
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const appearanceLabel = { system: "System", light: "Light", dark: "Dark" }[themePreference];
  const deletedGroupCount = groups.filter((group) => group.deletedAt).length;
  const sheetOptions = activeSheet === "appearance"
    ? ([
        { id: "system", label: "Follow system" },
        { id: "light", label: "Light" },
        { id: "dark", label: "Dark" },
      ] as const).map((option) => ({
        id: option.id,
        label: option.label,
        detail: null,
        selected: themePreference === option.id,
        onSelect: () => setThemePreference(option.id),
      }))
    : SUPPORTED_CURRENCIES.map((currency) => ({
        id: currency.code,
        label: `${currency.symbol}  ${currency.code}`,
        detail: currency.label,
        selected: defaultCurrency === currency.code,
        onSelect: () => setDefaultCurrency(currency.code),
      }));

  function openSheet(sheet: "appearance" | "currency") {
    setActiveSheet(sheet);
    setIsSheetVisible(true);
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) showError("Could not sign out", error.message);
  }

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="w-full max-w-2xl self-center gap-5 px-5 pb-10 pt-3 md:px-8 md:pt-8"
        showsVerticalScrollIndicator={false}
        className="account-settings__canvas"
        accessibilityElementsHidden={isSheetVisible}
        importantForAccessibility={isSheetVisible ? "no-hide-descendants" : "auto"}
      >
        <Text className="account-settings__text px-1 text-2xl font-black tracking-tight">Account</Text>

        <View className="account-settings__group flex-row items-center gap-4 p-4">
          <View className="h-14 w-14 items-center justify-center rounded-2xl border border-[#DBD5ED] bg-[#E8E3F5] dark:border-white/10 dark:bg-[#221C38]">
            <Text className="text-xl font-black text-[#9A6B1C] dark:text-[#F5D298]">
              {((accountName ?? accountEmail)?.[0] ?? "?").toUpperCase()}
            </Text>
          </View>
          <View className="min-w-0 flex-1 gap-1">
            <Text selectable className="account-settings__text text-lg font-black tracking-tight">
              {accountName ?? "Your account"}
            </Text>
            {accountEmail ? (
              <Text selectable className="account-settings__muted text-sm">{accountEmail}</Text>
            ) : null}
          </View>
        </View>

        <View className="gap-2">
          <Text className="account-settings__section-label">Account</Text>
          <View className="account-settings__group">
            {([
              { label: "Change email", route: "/account/change-email", icon: "mail-outline" },
              { label: "Change password", route: "/account/change-password", icon: "lock-closed-outline" },
            ] as const).map((action, index) => (
              <View key={action.route}>
                {index > 0 ? <View className="account-settings__divider ml-[68px] mr-4 border-t" /> : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push(action.route)}
                  className="account-settings__row"
                >
                  <View className="account-settings__icon">
                    <Ionicons name={action.icon} size={19} color={clay.isDark ? "#F5D298" : "#9A6B1C"} />
                  </View>
                  <Text className="account-settings__row-label">{action.label}</Text>
                  <Ionicons name="chevron-forward" size={18} color={clay.textMuted} />
                </Pressable>
              </View>
            ))}
          </View>
        </View>

        <View className="gap-2">
          <Text className="account-settings__section-label">Preferences</Text>
          <View className="account-settings__group">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Appearance, ${appearanceLabel}`}
              onPress={() => openSheet("appearance")}
              className="account-settings__row"
            >
              <View className="account-settings__icon">
                <Ionicons name="color-palette-outline" size={19} color={clay.isDark ? "#F5D298" : "#9A6B1C"} />
              </View>
              <Text className="account-settings__row-label">Appearance</Text>
              <View className="account-settings__value">
                <Text className="account-settings__muted text-xs font-bold">{appearanceLabel}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={clay.textMuted} />
            </Pressable>
            <View className="account-settings__divider ml-[68px] mr-4 border-t" />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Default currency, ${defaultCurrency}`}
              onPress={() => openSheet("currency")}
              className="account-settings__row"
            >
              <View className="account-settings__icon">
                <Ionicons name="cash-outline" size={19} color={clay.isDark ? "#F5D298" : "#9A6B1C"} />
              </View>
              <Text className="account-settings__row-label">Default currency</Text>
              <View className="account-settings__value">
                <Text className="account-settings__muted text-xs font-bold">{defaultCurrency}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={clay.textMuted} />
            </Pressable>
          </View>
        </View>

        <View className="account-settings__group">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Deleted groups, ${deletedGroupCount}`}
            onPress={() => router.push("/groups/deleted")}
            className="account-settings__row"
          >
            <View className="account-settings__icon">
              <Ionicons name="trash-outline" size={19} color={clay.isDark ? "#F5D298" : "#9A6B1C"} />
            </View>
            <Text className="account-settings__row-label">Deleted groups</Text>
            <View className="account-settings__value">
              <Text className="account-settings__muted text-xs font-bold">{deletedGroupCount}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={clay.textMuted} />
          </Pressable>
        </View>

        <View className="account-settings__group">
          <Pressable
            accessibilityRole="button"
            onPress={() => void signOut()}
            className="account-settings__row"
          >
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#FFE4E6] dark:bg-[#451C28]">
              <Ionicons name="log-out-outline" size={19} color={clay.errorText} />
            </View>
            <Text className="flex-1 text-sm font-bold text-[#DC2626] dark:text-[#FB7185]">Sign out</Text>
          </Pressable>
        </View>
        <Text className="account-settings__muted py-2 text-center text-xs">Tripwise · {version}</Text>
      </ScrollView>

      <Modal
        transparent
        visible={isSheetVisible}
        animationType="fade"
        onRequestClose={() => setIsSheetVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/40 pt-12 sm:items-center sm:justify-center sm:p-6">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close selection"
            onPress={() => setIsSheetVisible(false)}
            className="absolute inset-0"
          />
          <View
            accessibilityViewIsModal
            className="account-settings__surface max-h-full w-full max-w-md overflow-hidden rounded-t-3xl sm:rounded-3xl"
          >
            <SafeAreaView edges={["bottom"]} style={{ backgroundColor: clay.card, flexShrink: 1 }}>
              <ScrollView contentContainerClassName="px-5 pb-5 pt-3" bounces={false}>
                <View className="h-1 w-10 self-center rounded-full bg-[#DBD5ED] dark:bg-[#958EB8] sm:hidden" />
                <View className="mb-2 mt-2 flex-row items-center gap-3">
                  <Text accessibilityRole="header" className="account-settings__text flex-1 text-lg font-semibold">
                    {activeSheet === "appearance" ? "Appearance" : "Default currency"}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close selection"
                    onPress={() => setIsSheetVisible(false)}
                    className="account-settings__icon active:opacity-70"
                  >
                    <Ionicons name="close" size={22} color={clay.textMuted} />
                  </Pressable>
                </View>
                {activeSheet === "currency" ? (
                  <Text className="account-settings__muted mb-3 text-sm leading-5">Used when creating new groups.</Text>
                ) : null}
                <View accessibilityRole="radiogroup" className="gap-1">
                  {sheetOptions.map((option) => (
                    <Pressable
                      key={option.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: option.selected }}
                      onPress={() => {
                        option.onSelect();
                        setIsSheetVisible(false);
                      }}
                      className={`min-h-14 flex-row items-center gap-3 rounded-2xl px-4 py-3 active:opacity-70 ${option.selected ? "bg-[#E8E3F5] dark:bg-[#221C38]" : ""}`}
                    >
                      <View className="flex-1 gap-1">
                        <Text className="account-settings__text text-sm font-bold">{option.label}</Text>
                        {option.detail ? <Text className="account-settings__muted text-sm">{option.detail}</Text> : null}
                      </View>
                      {option.selected ? <Ionicons name="checkmark" size={22} color={clay.textPrimary} /> : null}
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </SafeAreaView>
          </View>
        </View>
      </Modal>
    </>
  );
}
