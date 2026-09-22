import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { PrimaryButton } from "@/components/primary-button";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/use-auth-store";
import { useGroupsStore } from "@/store/use-groups-store";
import type { CurrencyCode } from "@/types/models";
import { SUPPORTED_CURRENCIES } from "@/utils/money";

export default function AccountScreen() {
  const accountEmail = useAuthStore((state) => state.session?.user.email);
  const defaultCurrency = useGroupsStore((state) => state.defaultCurrency);
  const setDefaultCurrency = useGroupsStore((state) => state.setDefaultCurrency);
  const resetToSeedData = useGroupsStore((state) => state.resetToSeedData);
  const groups = useGroupsStore((state) => state.groups);

  function confirmReset() {
    Alert.alert(
      "Reset demo data?",
      "All groups, expenses, and balances will be restored to their initial seed state. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset to default",
          style: "destructive",
          onPress: () => resetToSeedData(),
        },
      ],
    );
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert("Could not sign out", error.message);
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-6 px-5 pb-12 pt-4"
      showsVerticalScrollIndicator={false}
    >
      <View className="gap-1 px-1">
        <Text className="text-2xl font-bold text-ink">Account & Settings</Text>
        <Text className="text-sm leading-5 text-muted">
          Manage your account, preferences, and demo environment.
        </Text>
      </View>

      <View className="card items-center gap-3 p-6">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-brand-50">
          <Text className="text-2xl font-bold text-brand-700">{accountEmail?.[0]?.toUpperCase() ?? "?"}</Text>
        </View>
        <View className="items-center gap-0.5">
          <Text selectable className="text-xl font-bold text-ink">{accountEmail ?? "Signed in"}</Text>
          <Text className="text-xs text-muted">Signed in</Text>
        </View>
      </View>

      <Text className="px-1 text-xs leading-5 text-muted">
        Groups and balances are still demo data stored on this device. They are not linked to your account yet.
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
                    : "border-line bg-surface active:bg-canvas"
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
        <Link href="/groups/archived" asChild>
          <Pressable className="card flex-row items-center justify-between p-4 active:bg-canvas">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-canvas">
                <Ionicons name="archive-outline" size={20} color="#17201B" />
              </View>
              <View>
                <Text className="font-semibold text-ink">Archived groups</Text>
                <Text className="text-xs text-muted">
                  {groups.filter((g) => g.archivedAt).length} archived
                </Text>
              </View>
            </View>
            <Text className="text-xl text-muted">›</Text>
          </Pressable>
        </Link>
      </View>

      <View className="gap-3">
        <Text className="section-label px-1">Data & Debugging</Text>
        <PrimaryButton label="Reset to demo data" variant="danger" onPress={confirmReset} />
      </View>

      <PrimaryButton label="Sign out" variant="secondary" onPress={signOut} />

      <View className="items-center gap-1 py-4">
        <Text className="text-xs font-medium text-muted">Tripwise Mobile · MVP v1.0.0</Text>
        <Text className="text-[11px] text-muted">Account connected · Group data in demo mode</Text>
      </View>
    </ScrollView>
  );
}
