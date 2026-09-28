import { Ionicons } from "@expo/vector-icons";
import { Link, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { PrimaryButton } from "@/components/primary-button";
import { useThemeColors } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/use-auth-store";
import { useGroupsStore } from "@/store/use-groups-store";
import { useSharedGroupsStore } from "@/store/use-shared-groups-store";
import { useSettingsStore } from "@/store/use-settings-store";
import type { CurrencyCode } from "@/types/models";
import { showError } from "@/utils/dialogs";
import { SUPPORTED_CURRENCIES } from "@/utils/money";

export default function AccountScreen() {
  const colors = useThemeColors();
  const accountEmail = useAuthStore((state) => state.session?.user.email);
  const accountName = useAuthStore((state) => {
    const metadata = state.session?.user.user_metadata;
    const name: unknown = metadata?.name;
    const fullName: unknown = metadata?.full_name;
    if (typeof name === "string" && name.trim()) return name.trim();
    return typeof fullName === "string" && fullName.trim() ? fullName.trim() : null;
  });
  const defaultCurrency = useGroupsStore((state) => state.defaultCurrency);
  const setDefaultCurrency = useGroupsStore((state) => state.setDefaultCurrency);
  const groups = useSharedGroupsStore((state) => state.groups);
  const loadGroups = useSharedGroupsStore((state) => state.loadGroups);
  const userId = useAuthStore((state) => state.session?.user.id);
  const themePreference = useSettingsStore((state) => state.themePreference);
  const setThemePreference = useSettingsStore((state) => state.setThemePreference);

  useFocusEffect(useCallback(() => {
    if (userId) void loadGroups(userId);
  }, [loadGroups, userId]));

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) showError("Could not sign out", error.message);
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="w-full max-w-3xl self-center gap-5 px-5 pb-12 pt-5 md:px-8 lg:py-10"
      showsVerticalScrollIndicator={false}
    >
      <View className="gap-1 px-1">
        <Text className="text-2xl font-bold text-ink lg:text-3xl">Account & Settings</Text>
        <Text className="text-sm leading-5 text-muted">
          Manage your account, preferences, and groups.
        </Text>
      </View>

      <View className="card flex-row items-center gap-4 p-4">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-brand-50">
          <Text className="text-lg font-bold text-brand-700">{(accountName ?? accountEmail)?.[0]?.toUpperCase() ?? "?"}</Text>
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text selectable numberOfLines={1} className="text-base font-semibold text-ink">{accountName ?? accountEmail ?? "Signed in"}</Text>
          <Text selectable numberOfLines={1} className="text-xs text-muted">{accountEmail ?? "Signed in"}</Text>
        </View>
      </View>

      <View className="gap-3">
        <Text className="section-label px-1">Sign-in details</Text>
        <View className="overflow-hidden rounded-2xl bg-surface">
          <Link href="/account/change-email" asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change email address"
              className="min-h-16 flex-row items-center gap-3 px-4 py-3 active:bg-canvas"
            >
              <Ionicons name="mail-outline" size={21} color={colors.ink} />
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-semibold text-ink">Email address</Text>
                <Text numberOfLines={1} className="text-xs text-muted">{accountEmail ?? "Signed in"}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          </Link>
          <View className="h-px bg-line" />
          <Link href="/account/change-password" asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change password"
              className="min-h-16 flex-row items-center gap-3 px-4 py-3 active:bg-canvas"
            >
              <Ionicons name="lock-closed-outline" size={21} color={colors.ink} />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-ink">Password</Text>
                <Text className="text-xs text-muted">Change your sign-in password</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          </Link>
        </View>
      </View>

      <View className="gap-3">
        <View className="gap-1 px-1">
          <Text className="section-label">Theme</Text>
          <Text className="text-xs leading-4 text-muted">
            Choose an appearance or follow your device setting.
          </Text>
        </View>
        <View className="flex-row gap-2">
          {([
            { id: "system", label: "System", icon: "phone-portrait-outline" },
            { id: "light", label: "Light", icon: "sunny-outline" },
            { id: "dark", label: "Dark", icon: "moon-outline" },
          ] as const).map((option) => {
            const isSelected = themePreference === option.id;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                onPress={() => setThemePreference(option.id)}
                className={`min-h-12 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border p-2 ${
                  isSelected
                    ? "border-brand-500 bg-brand-50"
                    : "border-transparent bg-surface active:bg-canvas"
                }`}
              >
                <Ionicons
                  name={option.icon}
                  size={16}
                  color={isSelected ? colors["brand-700"] : colors.muted}
                />
                <Text className={`text-xs font-semibold ${isSelected ? "text-brand-700" : "text-ink"}`}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Text className="px-1 text-xs leading-5 text-muted">
        Groups, expenses, and balances are saved to your account.
      </Text>

      <View className="gap-3">
        <View className="gap-1 px-1">
          <Text className="section-label">Default currency</Text>
          <Text className="text-xs leading-4 text-muted">
            Selected currency will pre-fill when creating new groups.
          </Text>
        </View>
        <View className="flex-row gap-2">
          {SUPPORTED_CURRENCIES.map((curr) => {
            const isSelected = defaultCurrency === curr.code;
            return (
              <Pressable
                key={curr.code}
                onPress={() => setDefaultCurrency(curr.code)}
                className={`min-h-12 flex-1 items-center justify-center rounded-xl border p-2 ${
                  isSelected
                    ? "border-brand-500 bg-brand-50"
                    : "border-transparent bg-surface active:bg-canvas"
                }`}
              >
                <Text className={`text-sm font-bold ${isSelected ? "text-brand-700" : "text-ink"}`}>
                  {curr.symbol}
                </Text>
                <Text className={`text-[10px] font-medium ${isSelected ? "text-brand-700" : "text-muted"}`}>
                  {curr.code}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="gap-3">
        <Text className="section-label px-1">Groups management</Text>
        <Link href="/groups/deleted" asChild>
          <Pressable className="flex-row items-center justify-between rounded-2xl bg-surface p-4 active:bg-canvas">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-canvas">
                <Ionicons name="trash-outline" size={20} color={colors.ink} />
              </View>
              <View>
                <Text className="font-semibold text-ink">Deleted groups</Text>
                <Text className="text-xs text-muted">
                  {groups.filter((g) => g.deletedAt).length} deleted · Restorable by any member
                </Text>
              </View>
            </View>
            <Text className="text-xl text-muted">›</Text>
          </Pressable>
        </Link>
      </View>

      <PrimaryButton label="Sign out" variant="secondary" onPress={signOut} />

      <View className="items-center gap-1 py-4">
        <Text className="text-xs font-medium text-muted">Tripwise · MVP v1.0.0</Text>
        <Text className="text-[11px] text-muted">Account connected · Groups synced</Text>
      </View>
    </ScrollView>
  );
}
