import { router, Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { useSharedGroups, useGroupActions } from "@/hooks/use-shared-groups";
import { showError } from "@/utils/dialogs";

export default function DeletedGroupsScreen() {
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
    <>
      <Stack.Screen options={{ title: "Deleted groups" }} />
      <ScrollView
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void loadGroups(true).catch(() => undefined)} />}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="w-full max-w-5xl self-center gap-5 px-5 pb-12 pt-5 md:px-8 lg:py-10"
      >
        <Text className="px-1 text-sm leading-5 text-muted">
          A deleted group is hidden for everyone. Any member can restore it with its expenses.
        </Text>
        {refreshError ? <Text className="text-sm text-coral">Could not refresh groups: {refreshError}. Your saved view is still shown.</Text> : null}
        {isLoading ? <ActivityIndicator /> : error ? (
          <View className="card gap-3 p-5">
            <Text selectable className="text-sm text-coral">{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => void loadGroups(true).catch(() => undefined)}>
              <Text className="font-semibold text-brand-700">Try again</Text>
            </Pressable>
          </View>
        ) : deletedGroups.length ? (
          <View className="card px-4">
            {deletedGroups.map((group, index) => (
              <View key={group.id}>
                <View className="min-h-16 flex-row items-center justify-between gap-3 py-3">
                  <View className="min-w-0 flex-1 gap-0.5">
                    <Text className="font-semibold text-ink" numberOfLines={1}>{group.name}</Text>
                    <Text className="text-xs text-muted">{group.currency} · Deleted group</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    disabled={restoringId !== null}
                    onPress={() => void restore(group.id)}
                    className="min-h-11 justify-center rounded-xl bg-brand-50 px-4 active:opacity-60"
                  >
                    <Text className="font-semibold text-brand-700">{restoringId === group.id ? "Restoring…" : "Restore"}</Text>
                  </Pressable>
                </View>
                {index < deletedGroups.length - 1 ? <View className="h-px bg-line" /> : null}
              </View>
            ))}
          </View>
        ) : (
          <EmptyState icon="trash-outline" title="No deleted groups" message="Groups deleted by you or another member will appear here." />
        )}
      </ScrollView>
    </>
  );
}
