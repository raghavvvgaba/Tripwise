import { Stack } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { GroupCard } from "@/components/group-card";
import { useGroupsStore } from "@/store/use-groups-store";

export default function ArchivedGroupsScreen() {
  const groups = useGroupsStore((state) => state.groups);
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
            Archived groups keep all historical expenses and balances intact, but are hidden from your active totals.
          </Text>
        </View>

        {archivedGroups.length > 0 ? (
          <View className="gap-3">
            {archivedGroups.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </View>
        ) : (
          <EmptyState
            emoji="📦"
            title="No archived groups"
            message="When you archive a group, it will be kept safely here."
          />
        )}
      </ScrollView>
    </>
  );
}
