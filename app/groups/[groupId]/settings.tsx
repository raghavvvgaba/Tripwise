import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { PrimaryButton } from "@/components/primary-button";
import { useSharedGroupsStore } from "@/store/use-shared-groups-store";
import { confirmAction, showError } from "@/utils/dialogs";

export default function GroupSettingsScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const group = useSharedGroupsStore((state) => state.groups.find((item) => item.id === groupId));
  const isLoading = useSharedGroupsStore((state) => state.isLoading);
  const deleteGroup = useSharedGroupsStore((state) => state.deleteGroup);
  const [isDeleting, setIsDeleting] = useState(false);

  async function removeGroup() {
    if (!group || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteGroup(group.id);
      router.dismissTo("/");
    } catch (cause) {
      showError("Could not delete group", cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Group settings" }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="w-full max-w-3xl self-center gap-6 px-5 pb-12 pt-5 md:px-8 lg:py-10">
        {isLoading && !group ? <ActivityIndicator /> : !group ? (
          <EmptyState icon="search-outline" title="Group not found" message="Return to your groups and try again." />
        ) : group.deletedAt ? (
          <EmptyState icon="trash-outline" title="Group deleted" message="Restore it from Activity or Deleted groups in Account settings." />
        ) : (
          <>
            <View className="card gap-1 p-5">
              <Text className="text-lg font-bold text-ink">{group.name}</Text>
              <Text className="text-sm text-muted">{group.currency} · Shared group</Text>
            </View>
            <View className="gap-3">
              <Text className="section-label px-1">Group management</Text>
              <View className="card gap-4 p-5">
                <Text className="text-sm leading-5 text-muted">
                  Deleting this group removes it from every member's groups and hides its expenses. Any member can restore it later with its expenses.
                </Text>
                <PrimaryButton
                  label="Delete group"
                  variant="danger"
                  loading={isDeleting}
                  onPress={() => confirmAction(
                    "Delete this group for everyone?",
                    "The group and its expenses will be hidden for all members. Any member can restore them later from Activity or Account settings.",
                    "Delete group",
                    () => void removeGroup(),
                  )}
                />
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </>
  );
}
