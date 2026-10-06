import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/components/empty-state";
import { useClayTheme } from "@/constants/clay-theme";
import { useSharedGroups, useGroupActions } from "@/hooks/use-shared-groups";
import { showError } from "@/utils/dialogs";

export default function DeletedGroupsScreen() {
  const clay = useClayTheme();
  const { groups, isLoading, isRefreshing, error, refreshError, loadGroups } = useSharedGroups();
  const { restoreGroup } = useGroupActions();
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const deletedGroups = groups.filter((group) => group.deletedAt);

  async function restore(groupId: string) {
    if (restoringId) return;
    setRestoringId(groupId);
    try {
      await restoreGroup(groupId);
      router.replace(`/groups/${groupId}`);
    } catch (cause) {
      showError("Could not restore group", cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: clay.canvas }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Top Bar Header ── */}
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={{ backgroundColor: clay.headerBtn, borderColor: clay.cardBorder }}
          className="h-11 w-11 items-center justify-center rounded-2xl border active:opacity-75"
        >
          <Ionicons name="chevron-back" size={20} color={clay.textPrimary} />
        </Pressable>

        <View className="items-center">
          <Text style={{ color: clay.textMuted }} className="text-[11px] font-bold uppercase tracking-widest">
            Archive
          </Text>
          <Text style={{ color: clay.textPrimary }} className="text-base font-extrabold">
            Deleted Groups
          </Text>
        </View>

        <View className="h-11 w-11" />
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadGroups(true).catch(() => undefined)}
            tintColor={clay.isDark ? "#F5D298" : "#2C254E"}
            colors={["#F5D298"]}
          />
        }
        contentInsetAdjustmentBehavior="never"
        contentContainerClassName="w-full max-w-2xl self-center px-5 pb-12 gap-5"
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ color: clay.textMuted }} className="px-1 text-xs leading-5">
          A deleted group is hidden for all members. Any member can restore it along with its full expense history.
        </Text>

        {refreshError ? (
          <Text style={{ color: clay.errorText }} className="px-1 text-xs">
            Could not refresh groups: {refreshError}.
          </Text>
        ) : null}

        {isLoading ? (
          <ActivityIndicator color="#F5D298" className="py-12" />
        ) : error ? (
          <View
            style={{ backgroundColor: clay.card, borderColor: clay.errorCardBorder }}
            className="gap-3 rounded-3xl border p-5 shadow-sm"
          >
            <Text selectable style={{ color: clay.errorText }} className="text-sm font-semibold">
              {error}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => void loadGroups(true).catch(() => undefined)}>
              <Text className="text-sm font-bold text-[#F5D298]">Try again</Text>
            </Pressable>
          </View>
        ) : deletedGroups.length > 0 ? (
          <View
            style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
            className="overflow-hidden rounded-3xl border px-4 py-1 shadow-sm"
          >
            {deletedGroups.map((group, index) => (
              <View key={group.id}>
                <View className="min-h-16 flex-row items-center justify-between gap-3 py-3.5">
                  <View className="min-w-0 flex-1 gap-0.5">
                    <Text style={{ color: clay.textPrimary }} className="text-base font-bold" numberOfLines={1}>
                      {group.name}
                    </Text>
                    <Text style={{ color: clay.textMuted }} className="text-xs">
                      {group.currency} · Deleted group
                    </Text>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    disabled={restoringId !== null}
                    onPress={() => void restore(group.id)}
                    className="h-10 items-center justify-center rounded-xl bg-[#F5D298] px-4 active:opacity-75 disabled:opacity-50"
                  >
                    {restoringId === group.id ? (
                      <ActivityIndicator color={clay.heroText} size="small" />
                    ) : (
                      <Text style={{ color: clay.heroText }} className="text-xs font-black">
                        Restore
                      </Text>
                    )}
                  </Pressable>
                </View>
                {index < deletedGroups.length - 1 ? (
                  <View style={{ backgroundColor: clay.cardBorder }} className="h-px w-full" />
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            icon="trash-outline"
            title="No deleted groups"
            message="Groups deleted by you or another member will appear here."
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
