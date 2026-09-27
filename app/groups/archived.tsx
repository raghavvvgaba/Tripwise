import { Stack } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { GroupCard } from "@/components/group-card";
import { useAuthStore } from "@/store/use-auth-store";
import { useSharedGroupsStore } from "@/store/use-shared-groups-store";

export default function ArchivedGroupsScreen() {
  const groups = useSharedGroupsStore((state) => state.groups);
  const isLoading = useSharedGroupsStore((state) => state.isLoading);
  const error = useSharedGroupsStore((state) => state.error);
  const loadGroups = useSharedGroupsStore((state) => state.loadGroups);
  const userId = useAuthStore((state) => state.session?.user.id);
  const archivedGroups = groups.filter((group) => group.archivedAt);

  return (
    <>
      <Stack.Screen options={{ title: "Archived groups" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="w-full max-w-5xl self-center gap-6 px-5 pb-12 pt-5 md:px-8 lg:py-10"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-1 px-1">
          <Text className="text-sm leading-5 text-muted">
            Archiving hides a group only for you. Other members can still see it.
          </Text>
        </View>

        {isLoading ? (
          <ActivityIndicator />
        ) : error ? (
          <View className="card gap-3 p-5">
            <Text className="text-sm text-coral">Could not load groups: {error}</Text>
            <Pressable onPress={() => userId && void loadGroups(userId)}>
              <Text className="font-semibold text-brand-700">Try again</Text>
            </Pressable>
          </View>
        ) : archivedGroups.length > 0 ? (
          <View className="gap-3">
            {archivedGroups.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </View>
        ) : (
          <EmptyState
            icon="archive-outline"
            title="No archived groups"
            message="When you archive a group, it will be kept safely here."
          />
        )}
      </ScrollView>
    </>
  );
}
