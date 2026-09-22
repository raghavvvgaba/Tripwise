import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { GroupCard } from "@/components/group-card";
import { useGroupsStore } from "@/store/use-groups-store";
import { getMemberBalances } from "@/utils/balances";
import { formatMoney } from "@/utils/money";

export default function GroupsScreen() {
  const groups = useGroupsStore((state) => state.groups);
  const currentUserId = useGroupsStore((state) => state.currentUserId);
  const activeGroups = groups.filter((group) => !group.archivedAt);
  const archivedCount = groups.filter((group) => group.archivedAt).length;
  const overallNet = activeGroups.reduce((total, group) => {
    const balance = getMemberBalances(group).find(
      (item) => item.member.id === currentUserId,
    );
    return total + (balance?.net ?? 0);
  }, 0);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-6 px-5 pb-12 pt-4"
      showsVerticalScrollIndicator={false}
    >
      <View className="overflow-hidden rounded-3xl bg-ink p-6">
        <View className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-brand-600 opacity-50" />
        <View className="gap-2">
          <Text className="text-sm font-medium text-white/70">Across all groups</Text>
          <Text selectable className="text-3xl font-bold tracking-tight text-white">
            {overallNet >= 0 ? "You are owed" : "You owe"} {formatMoney(overallNet)}
          </Text>
          <Text className="text-sm leading-5 text-white/60">
            {activeGroups.length} active {activeGroups.length === 1 ? "group" : "groups"}
          </Text>
        </View>
      </View>

      <View className="gap-3">
        <View className="flex-row items-center justify-between px-1">
          <Text className="section-label">Your groups</Text>
          <View className="flex-row items-center gap-2">
            {archivedCount > 0 ? (
              <Link href="/groups/archived" asChild>
                <Pressable
                  accessibilityLabel={`${archivedCount} archived groups`}
                  className="flex-row items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-2 active:bg-canvas"
                >
                  <Ionicons name="archive-outline" size={13} color="#68736C" />
                  <Text className="text-xs font-semibold text-muted">
                    {archivedCount} archived
                  </Text>
                </Pressable>
              </Link>
            ) : null}
            <Link href="/groups/create" asChild>
              <Pressable
                accessibilityLabel="Create group"
                className="h-11 w-11 items-center justify-center rounded-full bg-brand-600 active:bg-brand-700"
              >
                <Text className="text-2xl font-medium leading-7 text-white">+</Text>
              </Pressable>
            </Link>
          </View>
        </View>
        {activeGroups.length > 0 ? (
          activeGroups.map((group) => <GroupCard key={group.id} group={group} />)
        ) : (
          <EmptyState
            emoji="✈️"
            title="Plan the trip, not the math"
            message="Create a group and start adding shared expenses."
          />
        )}
      </View>
    </ScrollView>
  );
}
