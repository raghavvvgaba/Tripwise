import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { PrimaryButton } from "@/components/primary-button";
import { acceptGroupInvite, isInviteCode, normalizeInviteCode, previewGroupInvite, type InvitePreview } from "@/lib/group-invites";
import { useAuthStore } from "@/store/use-auth-store";
import { useSharedGroups } from "@/hooks/use-shared-groups";

export default function JoinGroupScreen() {
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
    void previewGroupInvite(normalizeInviteCode(code)).then((result) => {
      if (!active) return;
      setPreview(result);
      if (!result) setError("This invite code is unavailable.");
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Could not load invite.");
    }).finally(() => {
      if (active) setIsLoading(false);
    });

    return () => { active = false; };
  }, [code, session?.user.id, retryKey]);

  async function join() {
    if (!session || !isInviteCode(code) || isJoining) return;
    setIsJoining(true);
    setError(null);
    try {
      const groupId = await acceptGroupInvite(normalizeInviteCode(code));
      setJoinedGroupId(groupId);
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

  async function refreshGroups() {
    if (!session || !joinedGroupId || isJoining) return;
    setIsJoining(true);
    setError(null);
    try {
      const loaded = await loadGroups(true);
      if (loaded.some((group) => group.id === joinedGroupId)) {
        router.replace(`/groups/${joinedGroupId}`);
      } else {
        setError("Your groups could not refresh. Try again.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your groups could not refresh. Try again.");
    } finally {
      setIsJoining(false);
    }
  }

  const alreadyMember = preview ? groups.some((group) => group.id === preview.groupId) : false;

  return (
    <>
      <Stack.Screen options={{ title: "Join group" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="w-full max-w-2xl self-center gap-6 px-5 pb-12 pt-6 md:px-8 lg:py-10"
        showsVerticalScrollIndicator={false}
      >
        {!session ? (
          <View className="card gap-4 p-5">
            <Text className="text-xl font-bold text-ink">You've been invited</Text>
            <Text className="text-sm leading-5 text-muted">Sign in or create an account to see the group and join it.</Text>
            <PrimaryButton
              label="Sign in to continue"
              onPress={() => router.push({ pathname: "/sign-in", params: { inviteCode: normalizeInviteCode(code) } })}
            />
          </View>
        ) : isLoading ? (
          <ActivityIndicator />
        ) : preview ? (
          <>
            <View className="items-center gap-3 py-2">
              <View className="h-24 w-24 items-center justify-center rounded-[32px] border border-brand-100 bg-brand-50">
                <Text className="text-3xl font-extrabold tracking-tight text-brand-700">
                  {preview.name.slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <Text className="text-sm font-medium text-brand-700">You've been invited to</Text>
              <Text className="text-center text-3xl font-bold text-ink">{preview.name}</Text>
              <Text className="text-sm text-muted">
                {preview.memberCount} {preview.memberCount === 1 ? "member" : "members"} · {preview.currency}
              </Text>
            </View>
            <View className="card gap-4 p-5">
              <Text className="text-sm leading-5 text-muted">
                {joinedGroupId
                  ? "You've joined this group. Open it to continue."
                  : alreadyMember
                    ? "You're already a member of this group."
                    : "Join to see this group in your dashboard."}
              </Text>
              {error ? <Text selectable className="text-sm text-coral">{error}</Text> : null}
              <PrimaryButton
                label={joinedGroupId ? "Try opening group" : alreadyMember ? "Open group" : "Join group"}
                loading={isJoining}
                onPress={joinedGroupId
                  ? () => void refreshGroups()
                  : alreadyMember
                    ? () => router.replace(`/groups/${preview.groupId}`)
                    : () => void join()}
              />
            </View>
          </>
        ) : (
          <>
            <EmptyState icon="link-outline" title="Invite unavailable" message={error ?? "Check the code and try again."} />
            <Pressable accessibilityRole="button" onPress={() => router.replace("/join")}>
              <Text className="text-center font-semibold text-brand-700">Enter another code</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setRetryKey((value) => value + 1)}>
              <Text className="text-center font-semibold text-brand-700">Try again</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </>
  );
}
