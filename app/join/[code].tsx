import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { groupDataKey } from "@/lib/group-data-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/components/empty-state";
import { useClayTheme } from "@/constants/clay-theme";
import {
  acceptGroupInvite,
  isInviteCode,
  normalizeInviteCode,
  previewGroupInvite,
  type InvitePreview,
} from "@/lib/group-invites";
import { useAuthStore } from "@/store/use-auth-store";
import { useSharedGroups } from "@/hooks/use-shared-groups";

export default function JoinGroupScreen() {
  const clay = useClayTheme();
  const queryClient = useQueryClient();
  const { code } = useLocalSearchParams<{ code: string }>();
  const session = useAuthStore((state) => state.session);
  const { groups, loadGroups } = useSharedGroups();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [joinedGroupId, setJoinedGroupId] = useState<string | null>(null);

  useEffect(() => {
    setPreview(null);
    setJoinedGroupId(null);
    if (!session) return;
    if (!isInviteCode(code)) {
      setError("This invite code is invalid.");
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);
    void previewGroupInvite(normalizeInviteCode(code))
      .then((result) => {
        if (!active) return;
        setPreview(result);
        if (!result) setError("This invite code is unavailable.");
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load invite.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [code, session?.user.id, retryKey]);

  async function join() {
    if (!session || !isInviteCode(code) || isJoining) return;
    setIsJoining(true);
    setError(null);
    try {
      const groupId = await acceptGroupInvite(normalizeInviteCode(code));
      setJoinedGroupId(groupId);
      await queryClient.invalidateQueries({ queryKey: groupDataKey(session.user.id, groupId), refetchType: "none" });
      const loaded = await loadGroups(true);
      if (loaded.some((group) => group.id === groupId)) {
        router.replace(`/groups/${groupId}`);
      } else {
        setError("You joined, but your groups could not refresh. Try opening the group again.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not join group.");
    } finally {
      setIsJoining(false);
    }
  }

  const alreadyMember = preview ? groups.some((group) => group.id === preview.groupId) : false;

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
            Invitation
          </Text>
          <Text style={{ color: clay.textPrimary }} className="max-w-[200px] text-base font-extrabold" numberOfLines={1}>
            {preview?.name ?? "Join Group"}
          </Text>
        </View>

        <View className="h-11 w-11" />
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerClassName="w-full max-w-2xl self-center px-5 pb-12 gap-5"
        showsVerticalScrollIndicator={false}
      >
        {!session ? (
          <View
            style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
            className="gap-4 rounded-3xl border p-5 shadow-sm"
          >
            <Text style={{ color: clay.textPrimary }} className="text-xl font-black">
              You've Been Invited
            </Text>
            <Text style={{ color: clay.textMuted }} className="text-xs leading-5">
              Sign in or create an account to view and join this group.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: "/sign-in", params: { inviteCode: code } })}
              className="h-14 flex-row items-center justify-center rounded-2xl bg-[#F5D298] px-5 shadow-sm active:opacity-75"
            >
              <Text style={{ color: clay.heroText }} className="text-base font-extrabold">
                Continue to Sign In
              </Text>
            </Pressable>
          </View>
        ) : isLoading ? (
          <ActivityIndicator color="#F5D298" className="py-16" />
        ) : error ? (
          <View
            style={{ backgroundColor: clay.card, borderColor: clay.errorCardBorder }}
            className="gap-3 rounded-3xl border p-5 shadow-sm"
          >
            <Text selectable style={{ color: clay.errorText }} className="text-sm font-semibold">
              {error}
            </Text>
            <Pressable onPress={() => setRetryKey((k) => k + 1)} className="self-start">
              <Text className="text-sm font-bold text-[#F5D298]">Try again</Text>
            </Pressable>
          </View>
        ) : preview ? (
          <View
            style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
            className="items-center gap-4 rounded-3xl border p-6 shadow-sm"
          >
            <View
              style={{ backgroundColor: clay.squircle, borderColor: clay.cardBorder }}
              className="h-16 w-16 items-center justify-center rounded-3xl border"
            >
              <Text style={{ color: clay.isDark ? "#F5D298" : "#9A6B1C" }} className="text-2xl font-black">
                {preview.name.slice(0, 2).toUpperCase()}
              </Text>
            </View>

            <View className="items-center gap-1">
              <Text style={{ color: clay.textPrimary }} className="text-center text-xl font-black">
                {preview.name}
              </Text>
              <View className="flex-row items-center gap-2">
                <View style={{ backgroundColor: clay.badgeNeutralBg }} className="rounded-full px-2.5 py-0.5">
                  <Text style={{ color: clay.textMuted }} className="text-xs font-bold">
                    {preview.currency}
                  </Text>
                </View>
                <Text style={{ color: clay.textMuted }} className="text-xs">
                  {preview.memberCount} {preview.memberCount === 1 ? "member" : "members"}
                </Text>
              </View>
            </View>

            <View className="w-full pt-3">
              {alreadyMember ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.replace(`/groups/${preview.groupId}`)}
                  className="h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-[#F5D298] px-5 shadow-sm active:opacity-75"
                >
                  <Ionicons name="arrow-forward" size={18} color={clay.heroText} />
                  <Text style={{ color: clay.heroText }} className="text-base font-extrabold">
                    Open Group
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  disabled={isJoining}
                  onPress={() => void join()}
                  className="h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-[#F5D298] px-5 shadow-sm active:opacity-75 disabled:opacity-50"
                >
                  {isJoining ? (
                    <ActivityIndicator color={clay.heroText} />
                  ) : (
                    <>
                      <Ionicons name="person-add" size={18} color={clay.heroText} />
                      <Text style={{ color: clay.heroText }} className="text-base font-extrabold">
                        Join Group
                      </Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          </View>
        ) : (
          <EmptyState
            icon="link-outline"
            title="Invite unavailable"
            message="Check the invite link or ask for a fresh one."
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
