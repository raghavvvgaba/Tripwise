import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getGroupMembers, type GroupMember } from "@/lib/group-invites";
import { useSharedGroupsStore } from "@/store/use-shared-groups-store";

const AVATAR_RING_COLORS = [
  "#38BDF8", // Sky blue
  "#FB923C", // Coral orange
  "#4ADE80", // Mint green
  "#C084FC", // Soft lavender
  "#FBBF24", // Warm amber
  "#F472B6", // Rose pink
];

export default function GroupMembersScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const group = useSharedGroupsStore((state) => state.groups.find((item) => item.id === groupId));
  const currentUserId = useSharedGroupsStore((state) => state.userId);

  const [members, setMembers] = useState<GroupMember[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    if (!groupId) return;
    setIsLoading(true);
    try {
      const data = await getGroupMembers(groupId);
      setMembers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load members.");
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      void loadMembers();
    }, [loadMembers])
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#181528" }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Top Bar Header ── */}
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          className="h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[#262243] active:opacity-75"
        >
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </Pressable>

        <View className="items-center">
          <Text className="text-[11px] font-bold uppercase tracking-widest text-[#A59ECB]">Group Members</Text>
          <Text className="max-w-[200px] text-base font-extrabold text-white" numberOfLines={1}>
            {group?.name ?? "Members"}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Invite members"
          onPress={() => router.push(`/groups/${groupId}/invite`)}
          className="h-11 flex-row items-center gap-1.5 rounded-2xl bg-[#F5D298] px-3.5 shadow-sm active:opacity-75"
        >
          <Ionicons name="person-add" size={15} color="#181528" />
          <Text className="text-xs font-black text-[#181528]">Invite</Text>
        </Pressable>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerClassName="w-full max-w-4xl self-center px-5 pb-12 gap-5"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Member Count Card ── */}
        <View className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#262243] p-5 shadow-sm">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View className="h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[#322C54]">
                <Ionicons name="people" size={22} color="#F5D298" />
              </View>
              <View>
                <Text className="text-xs font-bold uppercase tracking-wider text-[#A59ECB]">Splitting with</Text>
                <Text className="text-2xl font-black text-white">
                  {members ? `${members.length} ${members.length === 1 ? "Person" : "People"}` : "Loading…"}
                </Text>
              </View>
            </View>

            <View className="rounded-full bg-white/10 px-3 py-1">
              <Text className="text-xs font-bold text-[#D0CCE8]">{group?.currency ?? "USD"}</Text>
            </View>
          </View>
        </View>

        {/* ── Section Title ── */}
        <View className="flex-row items-center justify-between px-1 pt-1">
          <Text className="text-xs font-bold uppercase tracking-wider text-[#A59ECB]">All Members</Text>
          <Text className="text-xs text-[#A59ECB]">{members ? `${members.length} total` : ""}</Text>
        </View>

        {/* ── Loading State ── */}
        {isLoading && !members ? (
          <ActivityIndicator color="#F5D298" className="py-10" />
        ) : null}

        {/* ── Error State ── */}
        {error ? (
          <View className="gap-2 rounded-3xl border border-red-500/20 bg-[#262243] p-4">
            <Text selectable className="text-sm font-semibold text-[#FB7185]">{error}</Text>
            <Pressable onPress={() => void loadMembers()} className="self-start">
              <Text className="text-sm font-bold text-[#F5D298]">Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {/* ── Members List ── */}
        {members && members.length > 0 ? (
          <View className="gap-3">
            {members.map((member, index) => {
              const isYou = member.userId === currentUserId;
              const ringColor = AVATAR_RING_COLORS[index % AVATAR_RING_COLORS.length];
              const initial = (member.name.trim()[0] || "?").toUpperCase();

              return (
                <View
                  key={member.userId}
                  className="flex-row items-center gap-3.5 rounded-3xl border border-white/10 bg-[#262243] p-4 shadow-sm"
                >
                  {/* 3D Ring Avatar */}
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      borderColor: ringColor,
                      borderWidth: 2.5,
                    }}
                    className="items-center justify-center bg-[#2C274B]"
                  >
                    <Text className="text-base font-black text-white">{initial}</Text>
                  </View>

                  {/* Name & Details */}
                  <View className="flex-1 gap-0.5">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-base font-bold text-white" numberOfLines={1}>
                        {member.name}
                      </Text>
                      {isYou ? (
                        <View className="rounded-full border border-[#F5D298]/30 bg-[#F5D298]/15 px-2 py-0.5">
                          <Text className="text-[10px] font-black text-[#F5D298]">You</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* ── Empty State ── */}
        {members && members.length === 0 && !error ? (
          <View className="items-center gap-2.5 rounded-3xl border border-white/10 bg-[#262243] px-8 py-10">
            <View className="h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-[#322C54]">
              <Ionicons name="people-outline" size={28} color="#F5D298" />
            </View>
            <Text className="text-center text-lg font-bold text-white">No members yet</Text>
            <Text className="text-center text-sm leading-5 text-[#A59ECB]">
              Share an invite link to start adding friends to this group.
            </Text>
          </View>
        ) : null}

        {/* ── Bottom Invite Action Card ── */}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/groups/${groupId}/invite`)}
          className="mt-2 flex-row items-center justify-between rounded-3xl border border-dashed border-[#F5D298]/40 bg-[#262243]/60 p-5 active:opacity-75"
        >
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-[#F5D298]/20">
              <Ionicons name="add" size={24} color="#F5D298" />
            </View>
            <View>
              <Text className="text-sm font-bold text-white">Invite More Friends</Text>
              <Text className="text-xs text-[#A59ECB]">Share an invite code or web link</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#F5D298" />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
