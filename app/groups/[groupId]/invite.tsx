import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, Text, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { PrimaryButton } from "@/components/primary-button";
import { RouteModal } from "@/components/route-modal";
import { useThemeColors } from "@/constants/theme";
import { getGroupInvite, getGroupMemberCount } from "@/lib/group-invites";
import { showError } from "@/utils/dialogs";

type GroupInvite = { name: string; code: string; memberCount: number };

function createInviteUrl(code: string): string {
  const configuredBaseUrl = process.env.EXPO_PUBLIC_APP_URL?.trim();
  let baseUrl = configuredBaseUrl || "https://tripwise.raghavgaba.me";

  try {
    if (__DEV__ && !configuredBaseUrl) {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        baseUrl = window.location.origin;
      } else if (Platform.OS !== "web") {
        const developmentUrl = new URL(Linking.createURL("/"));
        if (developmentUrl.protocol === "exp:" || developmentUrl.protocol === "exps:") {
          baseUrl = `${developmentUrl.protocol === "exps:" ? "https" : "http"}://${developmentUrl.host}`;
        }
      }
    }

    const url = new URL(baseUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return new URL(`/join/${code}`, url).toString();
  } catch {
    return "";
  }
}

export default function GroupInviteScreen() {
  const colors = useThemeColors();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const [invite, setInvite] = useState<GroupInvite | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [didCopyLink, setDidCopyLink] = useState(false);
  const [didCopyCode, setDidCopyCode] = useState(false);

  const loadInvite = useCallback(async () => {
    setInvite(null);
    setDidCopyLink(false);
    setDidCopyCode(false);
    setIsLoading(true);
    try {
      const [group, memberCount] = await Promise.all([
        getGroupInvite(groupId),
        getGroupMemberCount(groupId),
      ]);
      setInvite({ ...group, memberCount });
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load invite.");
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  useFocusEffect(useCallback(() => {
    void loadInvite();
  }, [loadInvite]));

  const inviteUrl = invite ? createInviteUrl(invite.code) : "";

  async function copyCode() {
    if (!invite) return;
    try {
      const copied = await Clipboard.setStringAsync(invite.code);
      if (!copied) throw new Error("Clipboard access is unavailable.");
      setDidCopyCode(true);
    } catch (cause) {
      showError("Could not copy code", cause instanceof Error ? cause.message : "Please try again.");
    }
  }

  async function shareInvite() {
    if (!invite || !inviteUrl) return;
    try {
      if (Platform.OS === "web") {
        if (navigator.share) {
          await navigator.share({
            title: `Join ${invite.name} on Tripwise`,
            url: inviteUrl,
          });
        } else {
          const copied = await Clipboard.setStringAsync(inviteUrl);
          if (!copied) throw new Error("Clipboard access is unavailable.");
          setDidCopyLink(true);
        }
        return;
      }

      await Share.share({
        title: `Join ${invite.name} on Tripwise`,
        message: `Join ${invite.name} on Tripwise: ${inviteUrl}`,
      });
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      showError("Could not share invite", cause instanceof Error ? cause.message : "Please try again.");
    }
  }

  return (
    <RouteModal title="Invite members">{() => (
      <>
        <Stack.Screen options={{ title: "Invite members" }} />
        <ScrollView
          className={Platform.OS === "web" ? "flex-1" : undefined}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerClassName="w-full max-w-3xl self-center gap-5 px-5 pb-12 pt-5 md:px-8 lg:py-10"
        >
          {isLoading && !invite ? (
            <ActivityIndicator />
          ) : error && !invite ? (
            <View className="card gap-3 p-5">
              <Text selectable className="text-sm text-coral">{error}</Text>
              <Pressable accessibilityRole="button" onPress={() => void loadInvite()}>
                <Text className="font-semibold text-brand-700">Try again</Text>
              </Pressable>
            </View>
          ) : invite ? (
            <>
              <View className="flex-row items-center gap-3 py-2">
                <View className="h-14 w-14 items-center justify-center rounded-2xl border border-brand-100 bg-brand-50">
                  <Text className="text-lg font-extrabold tracking-tight text-brand-700">
                    {invite.name.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View className="min-w-0 flex-1 gap-1">
                  <Text className="text-lg font-bold text-ink" numberOfLines={1}>{invite.name}</Text>
                  <Text className="text-sm text-muted">
                    {invite.memberCount} {invite.memberCount === 1 ? "member" : "members"}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Refresh member count"
                  onPress={() => void loadInvite()}
                  className="h-11 w-11 items-center justify-center rounded-xl active:bg-brand-50"
                >
                  <Ionicons name="refresh-outline" size={20} color={colors["brand-700"]} />
                </Pressable>
              </View>

              <View className="card gap-3 p-4">
                <Text className="section-label">Invite code</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={didCopyCode ? "Invite code copied" : `Copy invite code ${invite.code}`}
                  onPress={() => void copyCode()}
                  className="min-h-20 flex-row items-center justify-between gap-3 rounded-xl bg-canvas px-4 active:bg-brand-50"
                >
                  <Text className="shrink text-xl font-bold tracking-[3px] text-ink">{invite.code}</Text>
                  <View className="flex-row items-center gap-1.5">
                    <Ionicons name={didCopyCode ? "checkmark" : "copy-outline"} size={17} color={colors["brand-700"]} />
                    <Text className="text-sm font-semibold text-brand-700">{didCopyCode ? "Copied" : "Copy"}</Text>
                  </View>
                </Pressable>
              </View>

              <PrimaryButton
                label={didCopyLink ? "Link copied" : "Share invite link"}
                disabled={!inviteUrl}
                onPress={() => void shareInvite()}
              />
              {!inviteUrl ? (
                <Text className="text-sm leading-5 text-muted">Invite sharing is unavailable until the web app URL is configured.</Text>
              ) : null}
              {error ? <Text selectable className="text-sm text-coral">{error}</Text> : null}
            </>
          ) : (
            <EmptyState icon="link-outline" title="Invite unavailable" message="Return to your group and try again." />
          )}
        </ScrollView>
      </>
    )}</RouteModal>
  );
}
