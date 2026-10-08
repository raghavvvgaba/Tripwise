import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { GroupCard } from "@/components/group-card";
import { BaggageTagHero } from "@/components/hero-variants/tag-hero";
import { useClayTheme } from "@/constants/clay-theme";
import { useSharedGroups } from "@/hooks/use-shared-groups";

export default function GroupsScreen() {
  const clay = useClayTheme();
  const { groups, isLoading, isRefreshing, error, refreshError, loadGroups } = useSharedGroups();
  const activeGroups = groups.filter((group) => !group.deletedAt);

  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => void loadGroups(true).catch(() => undefined)}
          tintColor={clay.isDark ? "#F5D298" : "#2C254E"}
          colors={["#F5D298"]}
        />
      }
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="w-full max-w-5xl self-center gap-6 px-5 pb-12 pt-3 md:px-8 lg:py-8"
      showsVerticalScrollIndicator={false}
      style={{ backgroundColor: clay.canvas }}
    >
      {/* ── Centerpiece Luggage Tag Hero ── */}
      <BaggageTagHero activeGroupsCount={activeGroups.length} />

      {/* ── Groups Section ── */}
      <View className="gap-3.5">
        <View className="flex-row items-center justify-between px-1">
          <Text style={{ color: clay.textMuted }} className="text-xs font-bold uppercase tracking-wider">
            All Groups
          </Text>
          <Text style={{ color: clay.textMuted }} className="text-xs">
            {activeGroups.length} total
          </Text>
        </View>

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
              Could not load groups: {error}
            </Text>
            <Pressable onPress={() => void loadGroups(true).catch(() => undefined)} className="self-start">
              <Text className="text-sm font-bold text-[#F5D298]">Try again</Text>
            </Pressable>
          </View>
        ) : activeGroups.length > 0 ? (
          <View className="gap-3">
            {activeGroups.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </View>
        ) : (
          <EmptyState
            icon="airplane-outline"
            title="Plan the trip, not the math"
            message="Create a group and start adding shared expenses."
          />
        )}
      </View>
    </ScrollView>
  );
}
