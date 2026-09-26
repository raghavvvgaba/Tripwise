import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { GroupCard } from "@/components/group-card";
import { useGroupsStore } from "@/store/use-groups-store";
import { getMemberBalances } from "@/utils/balances";
import { formatMoney } from "@/utils/money";
import { useThemeColors } from "@/constants/theme";

export default function GroupsScreen() {
  const colors = useThemeColors();
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
      contentContainerClassName="w-full max-w-6xl self-center gap-7 px-5 pb-12 pt-5 md:px-8 lg:gap-8 lg:px-10 lg:py-10"
      showsVerticalScrollIndicator={false}
    >
      <View className="hidden gap-1 lg:flex">
        <Text className="text-3xl font-bold tracking-tight text-ink">Your groups</Text>
        <Text className="text-sm text-muted">A clear view of every shared expense.</Text>
      </View>

      <View className="overflow-hidden rounded-3xl bg-[#17201B] p-6 lg:p-8">
        <View className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-brand-600 opacity-50" />
        <View className="absolute -bottom-20 right-28 h-36 w-36 rounded-full border border-white/10" />
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

      <View className="gap-4">
        <View className="flex-row items-center justify-between px-1">
          <Text className="section-label">Your groups</Text>
          <View className="flex-row items-center gap-2">
            {archivedCount > 0 ? (
              <Link href="/groups/archived" asChild>
                <Pressable
                  accessibilityLabel={`${archivedCount} archived groups`}
                  className="flex-row items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-2 active:bg-canvas"
                >
                  <Ionicons name="archive-outline" size={13} color={colors.muted} />
                  <Text className="text-xs font-semibold text-muted">
                    {archivedCount} archived
                  </Text>
                </Pressable>
              </Link>
            ) : null}
            <Link href="/groups/create" asChild>
              <Pressable
                accessibilityLabel="Create group"
                className="h-11 w-11 flex-row items-center justify-center gap-1 rounded-full bg-brand-600 active:bg-[#086B49] lg:w-auto lg:rounded-xl lg:px-4"
              >
                <Text className="text-2xl font-medium leading-7 text-white">+</Text>
                <Text className="hidden text-sm font-semibold text-white lg:flex">New group</Text>
              </Pressable>
            </Link>
          </View>
        </View>
        {activeGroups.length > 0 ? (
          <View className="flex-row flex-wrap gap-4">
            {activeGroups.map((group) => (
              <View key={group.id} className="w-full lg:w-[48%]">
                <GroupCard group={group} />
              </View>
            ))}
          </View>
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
