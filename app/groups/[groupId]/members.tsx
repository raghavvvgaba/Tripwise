import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useClayTheme } from "@/constants/clay-theme";
import { getGroupMembers, type GroupMember } from "@/lib/group-invites";
import { useSharedGroups } from "@/hooks/use-shared-groups";

const AVATAR_RING_COLORS = [
  "#38BDF8", // Sky blue
  "#FB923C", // Coral orange
  "#4ADE80", // Mint green
  "#C084FC", // Soft lavender
  "#FBBF24", // Warm amber
  "#F472B6", // Rose pink
];

export default function GroupMembersScreen() {
  const clay = useClayTheme();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { groups, userId: currentUserId } = useSharedGroups();
  const group = groups.find((item) => item.id === groupId);

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
    <SafeAreaView style={{ flex: 1, backgroundColor: clay.canvas }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Top Bar Header ── */}
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={{ backgroundColor: clay.headerBtn, borderColor: clay.cardBorder }}
          className="h-11 w-11 items-center justify-center rounded-2xl border active:opacity-75"
        >
          <Ionicons name="chevron-back" size={20} color={clay.textPrimary} />
        </Pressable>

        <View className="items-center">
          <Text style={{ color: clay.textMuted }} className="text-[11px] font-bold uppercase tracking-widest">
            Group Members
          </Text>
          <Text style={{ color: clay.textPrimary }} className="max-w-[200px] text-base font-extrabold" numberOfLines={1}>
            {group?.name ?? "Members"}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Invite members"
          onPress={() => router.push(`/groups/${groupId}/invite`)}
          className="h-11 flex-row items-center gap-1.5 rounded-2xl bg-[#F5D298] px-3.5 shadow-sm active:opacity-75"
        >
          <Ionicons name="person-add" size={15} color={clay.heroText} />
          <Text style={{ color: clay.heroText }} className="text-xs font-black">Invite</Text>
        </Pressable>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerClassName="w-full max-w-4xl self-center px-5 pb-12 gap-5"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Member Count Card ── */}
        <View
          style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
          className="relative overflow-hidden rounded-3xl border p-5 shadow-sm"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View
                style={{ backgroundColor: clay.squircle, borderColor: clay.cardBorder }}
                className="h-12 w-12 items-center justify-center rounded-2xl border"
              >
                <Ionicons name="people" size={22} color={clay.isDark ? "#F5D298" : "#9A6B1C"} />
              </View>
              <View>
                <Text style={{ color: clay.textMuted }} className="text-xs font-bold uppercase tracking-wider">
                  Splitting with
                </Text>
                <Text style={{ color: clay.textPrimary }} className="text-2xl font-black">
                  {members ? `${members.length} ${members.length === 1 ? "Person" : "People"}` : "Loading…"}
                </Text>
              </View>
            </View>

            <View style={{ backgroundColor: clay.badgeNeutralBg }} className="rounded-full px-3 py-1">
              <Text style={{ color: clay.textMuted }} className="text-xs font-bold">
                {group?.currency ?? "USD"}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Section Title ── */}
        <View className="flex-row items-center justify-between px-1 pt-1">
          <Text style={{ color: clay.textMuted }} className="text-xs font-bold uppercase tracking-wider">
            All Members
          </Text>
          <Text style={{ color: clay.textMuted }} className="text-xs">
            {members ? `${members.length} total` : ""}
          </Text>
        </View>

        {/* ── Loading State ── */}
        {isLoading && !members ? (
          <ActivityIndicator color="#F5D298" className="py-10" />
        ) : null}

        {/* ── Error State ── */}
        {error ? (
          <View
            style={{ backgroundColor: clay.card, borderColor: clay.errorCardBorder }}
            className="gap-2 rounded-3xl border p-4 shadow-sm"
          >
            <Text selectable style={{ color: clay.errorText }} className="text-sm font-semibold">
              {error}
            </Text>
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
                  style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
                  className="flex-row items-center gap-3.5 rounded-3xl border p-4 shadow-sm"
                >
                  {/* 3D Ring Avatar */}
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      borderColor: ringColor,
                      borderWidth: 2.5,
                      backgroundColor: clay.avatarBg,
                    }}
                    className="items-center justify-center"
                  >
                    <Text
                      style={{ color: clay.isDark ? "#FFFFFF" : clay.textPrimary }}
                      className="text-base font-black"
                    >
                      {initial}
                    </Text>
                  </View>

                  {/* Name & Details */}
                  <View className="flex-1 gap-0.5">
                    <View className="flex-row items-center gap-2">
                      <Text style={{ color: clay.textPrimary }} className="text-base font-bold" numberOfLines={1}>
                        {member.name}
                      </Text>
                      {isYou ? (
                        <View
                          style={{
                            backgroundColor: clay.youBadgeBg,
                            borderColor: clay.youBadgeBorder,
                          }}
                          className="rounded-full border px-2 py-0.5"
                        >
                          <Text style={{ color: clay.youBadgeText }} className="text-[10px] font-black">
                            You
                          </Text>
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
          <View
            style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
            className="items-center gap-3 rounded-3xl border px-8 py-10 shadow-sm"
          >
            <View
              style={{ backgroundColor: clay.squircle, borderColor: clay.cardBorder }}
              className="h-16 w-16 items-center justify-center rounded-2xl border"
            >
              <Ionicons name="people-outline" size={28} color="#F5D298" />
            </View>
            <Text style={{ color: clay.textPrimary }} className="text-center text-lg font-bold">
              No members yet
            </Text>
            <Text style={{ color: clay.textMuted }} className="text-center text-sm leading-5">
              Share an invite link to start adding friends to this group.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Invite friends"
              onPress={() => router.push(`/groups/${groupId}/invite`)}
              className="mt-2 flex-row items-center gap-2 rounded-2xl bg-[#F5D298] px-5 py-3 shadow-sm active:opacity-75"
            >
              <Ionicons name="person-add" size={16} color={clay.heroText} />
              <Text style={{ color: clay.heroText }} className="text-sm font-black">
                Invite Friends
              </Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
