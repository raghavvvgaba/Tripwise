import { Ionicons } from "@expo/vector-icons";
import { Link, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { GroupCard } from "@/components/group-card";
import { useAuthStore } from "@/store/use-auth-store";
import { useSharedGroupsStore } from "@/store/use-shared-groups-store";
import { useThemeColors } from "@/constants/theme";

export default function GroupsScreen() {
  const colors = useThemeColors();
  const groups = useSharedGroupsStore((state) => state.groups);
  const isLoading = useSharedGroupsStore((state) => state.isLoading);
  const error = useSharedGroupsStore((state) => state.error);
  const loadGroups = useSharedGroupsStore((state) => state.loadGroups);
  const userId = useAuthStore((state) => state.session?.user.id);
  const activeGroups = groups.filter((group) => !group.deletedAt);

  useFocusEffect(useCallback(() => {
    if (userId) void loadGroups(userId);
  }, [loadGroups, userId]));

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

      <View className="overflow-hidden rounded-xl bg-[#1A1A1A] p-6 lg:p-8">
        <View className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-brand-600 opacity-50" />
        <View className="absolute -bottom-20 right-28 h-36 w-36 rounded-full border border-white/10" />
        <View className="gap-2">
          <Text className="text-sm font-medium text-white/70">Your groups</Text>
          <Text selectable className="text-3xl font-bold tracking-tight text-white">
            {activeGroups.length} active {activeGroups.length === 1 ? "group" : "groups"}
          </Text>
          <Text className="text-sm leading-5 text-white/60">Shared expenses, all in one place</Text>
        </View>
      </View>

      <View className="gap-4">
        <View className="flex-row items-center justify-between px-1">
          <Text className="section-label">Your groups</Text>
          <View className="flex-row items-center gap-2">
            <Link href="/join" asChild>
              <Pressable
                accessibilityLabel="Join a group with a code"
                className="h-11 flex-row items-center gap-1.5 rounded-full border border-line bg-surface px-3 active:bg-canvas lg:rounded-xl lg:px-4"
              >
                <Ionicons name="enter-outline" size={17} color={colors["brand-700"]} />
                <Text className="text-sm font-semibold text-brand-700">Join</Text>
              </Pressable>
            </Link>
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
        {isLoading ? (
          <ActivityIndicator color={colors["brand-600"]} />
        ) : error ? (
          <View className="card gap-3 p-5">
            <Text className="text-sm text-coral">Could not load groups: {error}</Text>
            <Pressable onPress={() => userId && void loadGroups(userId)}>
              <Text className="font-semibold text-brand-700">Try again</Text>
            </Pressable>
          </View>
        ) : activeGroups.length > 0 ? (
          <View className="flex-row flex-wrap gap-4">
            {activeGroups.map((group) => (
              <View key={group.id} className="w-full lg:w-[48%]">
                <GroupCard group={group} />
              </View>
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
