import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { GroupCard } from "@/components/group-card";
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
      {/* ── Centerpiece Hero Card ── */}
      <View
        style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
        className="relative overflow-hidden rounded-3xl border p-6 shadow-sm"
      >
        <View className="gap-1">
          <Text style={{ color: clay.textPrimary }} className="text-2xl font-black tracking-tight">
            Tripwise
          </Text>
          <Text selectable style={{ color: clay.isDark ? "#F5D298" : "#9A6B1C" }} className="text-3xl font-black">
            {activeGroups.length} {activeGroups.length === 1 ? "Active Group" : "Active Groups"}
          </Text>
        </View>

        {/* ── Quick Action Row ── */}
        <View className="mt-5 flex-row items-center gap-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create group"
            onPress={() => router.push("/groups/create")}
            className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-[#F5D298] px-4 shadow-sm active:opacity-75"
          >
            <Ionicons name="add" size={20} color={clay.heroText} />
            <Text style={{ color: clay.heroText }} className="text-sm font-extrabold">
              New Group
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Join group"
            onPress={() => router.push("/join")}
            style={{ backgroundColor: clay.squircle, borderColor: clay.cardBorder }}
            className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl border px-4 active:opacity-75"
          >
            <Ionicons name="enter-outline" size={18} color={clay.textPrimary} />
            <Text style={{ color: clay.textPrimary }} className="text-sm font-bold">
              Join Group
            </Text>
          </Pressable>
        </View>
      </View>

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
