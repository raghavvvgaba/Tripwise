import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { PrimaryButton } from "@/components/primary-button";
import { useClayTheme } from "@/constants/clay-theme";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/use-auth-store";
import { useCurrencyStore } from "@/store/use-currency-store";
import { useSharedGroups } from "@/hooks/use-shared-groups";
import { useSettingsStore } from "@/store/use-settings-store";
import type { CurrencyCode } from "@/types/models";
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

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) showError("Could not sign out", error.message);
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="w-full max-w-3xl self-center gap-5 px-5 pb-12 pt-3 md:px-8 lg:py-8"
      showsVerticalScrollIndicator={false}
      style={{ backgroundColor: clay.canvas }}
    >
      <View className="gap-0.5 px-1">
        <Text style={{ color: clay.textMuted }} className="text-[11px] font-black uppercase tracking-widest">
          Profile & Preferences
        </Text>
        <Text style={{ color: clay.textPrimary }} className="text-2xl font-black">
          Account
        </Text>
      </View>

      {/* ── Profile Summary Card ── */}
      <View
        style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
        className="flex-row items-center gap-4 rounded-3xl border p-4 shadow-sm"
      >
        <View
          style={{ backgroundColor: clay.squircle, borderColor: clay.cardBorder }}
          className="h-14 w-14 items-center justify-center rounded-2xl border"
        >
          <Text style={{ color: clay.isDark ? "#F5D298" : "#9A6B1C" }} className="text-xl font-black">
            {((accountName ?? accountEmail)?.[0] ?? "?").toUpperCase()}
          </Text>
        </View>

        <View className="min-w-0 flex-1 gap-0.5">
          <Text
            selectable
            numberOfLines={1}
            style={{ color: clay.textPrimary }}
            className="text-base font-black"
          >
            {accountName ?? accountEmail ?? "Signed In"}
          </Text>
          <Text
            selectable
            numberOfLines={1}
            style={{ color: clay.textMuted }}
            className="text-xs font-semibold"
          >
            {accountEmail ?? "Signed in"}
          </Text>
        </View>
      </View>

      {/* ── Sign-in Details ── */}
      <View className="gap-2.5">
        <Text style={{ color: clay.textMuted }} className="px-1 text-xs font-bold uppercase tracking-wider">
          Sign-in Details
        </Text>

        <View
          style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
          className="overflow-hidden rounded-3xl border shadow-sm"
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change email address"
            onPress={() => router.push("/account/change-email")}
            className="min-h-16 flex-row items-center gap-3.5 px-4 py-3 active:opacity-70"
          >
            <View
              style={{ backgroundColor: clay.squircle, borderColor: clay.cardBorder }}
              className="h-10 w-10 items-center justify-center rounded-xl border"
            >
              <Ionicons name="mail-outline" size={19} color={clay.textPrimary} />
            </View>
            <View className="min-w-0 flex-1">
              <Text style={{ color: clay.textPrimary }} className="text-sm font-bold">
                Email Address
              </Text>
              <Text numberOfLines={1} style={{ color: clay.textMuted }} className="text-xs">
                {accountEmail ?? "Signed in"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={clay.textMuted} />
          </Pressable>

          <View style={{ backgroundColor: clay.cardBorder }} className="h-px w-full" />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change password"
            onPress={() => router.push("/account/change-password")}
            className="min-h-16 flex-row items-center gap-3.5 px-4 py-3 active:opacity-70"
          >
            <View
              style={{ backgroundColor: clay.squircle, borderColor: clay.cardBorder }}
              className="h-10 w-10 items-center justify-center rounded-xl border"
            >
              <Ionicons name="lock-closed-outline" size={19} color={clay.textPrimary} />
            </View>
            <View className="flex-1">
              <Text style={{ color: clay.textPrimary }} className="text-sm font-bold">
                Password
              </Text>
              <Text style={{ color: clay.textMuted }} className="text-xs">
                Change your sign-in password
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={clay.textMuted} />
          </Pressable>
        </View>
      </View>

      {/* ── Theme Appearance ── */}
      <View className="gap-2.5">
        <View className="gap-0.5 px-1">
          <Text style={{ color: clay.textMuted }} className="text-xs font-bold uppercase tracking-wider">
            Theme Appearance
          </Text>
          <Text style={{ color: clay.textMuted }} className="text-xs">
            Choose light or dark, or sync with your system.
          </Text>
        </View>

        <View className="flex-row gap-2.5">
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
                style={{
                  backgroundColor: isSelected ? clay.activeTabBg : clay.card,
                  borderColor: isSelected ? clay.activeTabBg : clay.cardBorder,
                }}
                className="min-h-12 flex-1 flex-row items-center justify-center gap-1.5 rounded-2xl border p-2 shadow-sm active:opacity-75"
              >
                <Ionicons
                  name={option.icon}
                  size={16}
                  color={isSelected ? clay.activeTabText : clay.textMuted}
                />
                <Text
                  style={{ color: isSelected ? clay.activeTabText : clay.textPrimary }}
                  className="text-xs font-extrabold"
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ── Default Currency ── */}
      <View className="gap-2.5">
        <View className="gap-0.5 px-1">
          <Text style={{ color: clay.textMuted }} className="text-xs font-bold uppercase tracking-wider">
            Default Currency
          </Text>
          <Text style={{ color: clay.textMuted }} className="text-xs">
            Pre-fills when creating new groups.
          </Text>
        </View>

        <View className="flex-row gap-2">
          {SUPPORTED_CURRENCIES.map((curr) => {
            const isSelected = defaultCurrency === curr.code;
            return (
              <Pressable
                key={curr.code}
                onPress={() => setDefaultCurrency(curr.code)}
                style={{
                  backgroundColor: isSelected ? clay.activeTabBg : clay.card,
                  borderColor: isSelected ? clay.activeTabBg : clay.cardBorder,
                }}
                className="min-h-13 flex-1 items-center justify-center rounded-2xl border p-2 shadow-sm active:opacity-75"
              >
                <Text
                  style={{ color: isSelected ? clay.activeTabText : clay.textPrimary }}
                  className="text-sm font-black"
                >
                  {curr.symbol}
                </Text>
                <Text
                  style={{ color: isSelected ? clay.activeTabText : clay.textMuted }}
                  className="text-[10px] font-extrabold"
                >
                  {curr.code}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ── Groups Management ── */}
      <View className="gap-2.5">
        <Text style={{ color: clay.textMuted }} className="px-1 text-xs font-bold uppercase tracking-wider">
          Groups Management
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/groups/deleted")}
          style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
          className="flex-row items-center justify-between rounded-3xl border p-4 shadow-sm active:opacity-75"
        >
          <View className="flex-row items-center gap-3.5">
            <View
              style={{ backgroundColor: clay.squircle, borderColor: clay.cardBorder }}
              className="h-11 w-11 items-center justify-center rounded-2xl border"
            >
              <Ionicons name="trash-outline" size={19} color={clay.textPrimary} />
            </View>
            <View>
              <Text style={{ color: clay.textPrimary }} className="text-sm font-bold">
                Deleted Groups
              </Text>
              <Text style={{ color: clay.textMuted }} className="text-xs">
                {groups.filter((g) => g.deletedAt).length} deleted · Restorable by any member
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={17} color={clay.textMuted} />
        </Pressable>
      </View>

      {/* ── Sign Out ── */}
      <View className="pt-2">
        <PrimaryButton label="Sign out" variant="secondary" onPress={signOut} />
      </View>

      {/* ── Footer ── */}
      <View className="items-center gap-0.5 py-4">
        <Text style={{ color: clay.textMuted }} className="text-xs font-bold">
          Tripwise · MVP v1.0.0
        </Text>
        <Text style={{ color: clay.textMuted }} className="text-[11px]">
          Tactile Clay Design · Synced
        </Text>
      </View>
    </ScrollView>
  );
}
