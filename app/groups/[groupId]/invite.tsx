import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useClayTheme } from "@/constants/clay-theme";
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
  const clay = useClayTheme();
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

  useFocusEffect(
    useCallback(() => {
      void loadInvite();
    }, [loadInvite])
  );

  const inviteUrl = invite ? createInviteUrl(invite.code) : "";

  async function copyCode() {
    if (!invite) return;
    try {
      const copied = await Clipboard.setStringAsync(invite.code);
      if (!copied) throw new Error("Clipboard access is unavailable.");
      setDidCopyCode(true);
      setTimeout(() => setDidCopyCode(false), 2500);
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
          setTimeout(() => setDidCopyLink(false), 2500);
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
            Invite Members
          </Text>
          <Text style={{ color: clay.textPrimary }} className="max-w-[200px] text-base font-extrabold" numberOfLines={1}>
            {invite?.name ?? "Tripwise"}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh invite"
          disabled={isLoading}
          onPress={() => void loadInvite()}
          style={{ backgroundColor: clay.headerBtn, borderColor: clay.cardBorder }}
          className="h-11 w-11 items-center justify-center rounded-2xl border active:opacity-75"
        >
          <Ionicons name="refresh" size={18} color={clay.textPrimary} />
        </Pressable>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerClassName="w-full max-w-2xl self-center px-5 pb-12 gap-5"
        showsVerticalScrollIndicator={false}
      >
        {isLoading && !invite ? (
          <ActivityIndicator color="#F5D298" className="py-12" />
        ) : error && !invite ? (
          <View
            style={{ backgroundColor: clay.card, borderColor: clay.errorCardBorder }}
            className="gap-3 rounded-3xl border p-5 shadow-sm"
          >
            <Text selectable style={{ color: clay.errorText }} className="text-sm font-semibold">
              {error}
            </Text>
            <Pressable onPress={() => void loadInvite()} className="self-start">
              <Text className="text-sm font-bold text-[#F5D298]">Try again</Text>
            </Pressable>
          </View>
        ) : invite ? (
          <>
            {/* ── Group Summary Card ── */}
            <View
              style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
              className="flex-row items-center gap-4 rounded-3xl border p-5 shadow-sm"
            >
              <View
                style={{ backgroundColor: clay.squircle, borderColor: clay.cardBorder }}
                className="h-14 w-14 items-center justify-center rounded-2xl border"
              >
                <Text
                  style={{ color: clay.isDark ? "#F5D298" : "#9A6B1C" }}
                  className="text-lg font-black tracking-tight"
                >
                  {invite.name.slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View className="flex-1 gap-1">
                <Text style={{ color: clay.textPrimary }} className="text-lg font-black" numberOfLines={1}>
                  {invite.name}
                </Text>
                <View className="flex-row items-center gap-1.5">
                  <View style={{ backgroundColor: clay.badgeNeutralBg }} className="rounded-full px-2.5 py-0.5">
                    <Text style={{ color: clay.textMuted }} className="text-xs font-bold">
                      {invite.memberCount} {invite.memberCount === 1 ? "member" : "members"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ── Invite Code Card ── */}
            <View
              style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
              className="gap-3.5 rounded-3xl border p-5 shadow-sm"
            >
              <View className="flex-row items-center justify-between">
                <Text style={{ color: clay.textMuted }} className="text-xs font-bold uppercase tracking-wider">
                  Invite Code
                </Text>
                <Text style={{ color: clay.textMuted }} className="text-xs">
                  Tap to copy
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={didCopyCode ? "Invite code copied" : `Copy invite code ${invite.code}`}
                onPress={() => void copyCode()}
                style={{ backgroundColor: clay.squircle, borderColor: clay.cardBorder }}
                className="flex-row items-center justify-between rounded-2xl border px-4 py-3.5 active:opacity-80"
              >
                <Text
                  selectable
                  style={{ color: clay.textPrimary }}
                  className="font-mono text-2xl font-black tracking-[4px]"
                >
                  {invite.code}
                </Text>

                <View
                  style={{
                    backgroundColor: didCopyCode ? clay.badgePositiveBg : "#F5D298",
                  }}
                  className="flex-row items-center gap-1.5 rounded-xl px-3 py-1.5"
                >
                  <Ionicons
                    name={didCopyCode ? "checkmark-circle" : "copy-outline"}
                    size={15}
                    color={didCopyCode ? clay.badgePositiveText : clay.heroText}
                  />
                  <Text
                    style={{
                      color: didCopyCode ? clay.badgePositiveText : clay.heroText,
                    }}
                    className="text-xs font-extrabold"
                  >
                    {didCopyCode ? "Copied" : "Copy"}
                  </Text>
                </View>
              </Pressable>

              <Text style={{ color: clay.textMuted }} className="text-xs leading-5">
                Friends can enter this code in the app to join instantly without a link.
              </Text>
            </View>

            {/* ── Share Invite Link Button ── */}
            <View className="gap-2.5 pt-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share invite link"
                disabled={!inviteUrl}
                onPress={() => void shareInvite()}
                className="h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-[#F5D298] px-5 shadow-sm active:opacity-75 disabled:opacity-50"
              >
                <Ionicons
                  name={didCopyLink ? "checkmark" : "share-social-outline"}
                  size={19}
                  color={clay.heroText}
                />
                <Text style={{ color: clay.heroText }} className="text-base font-extrabold">
                  {didCopyLink ? "Link Copied!" : "Share Invite Link"}
                </Text>
              </Pressable>

              {!inviteUrl ? (
                <Text style={{ color: clay.textMuted }} className="px-1 text-xs">
                  Invite sharing is unavailable until the web app URL is configured.
                </Text>
              ) : null}

              {error ? (
                <Text selectable style={{ color: clay.errorText }} className="px-1 text-sm font-semibold">
                  {error}
                </Text>
              ) : null}
            </View>
          </>
        ) : (
          <View
            style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
            className="items-center gap-2.5 rounded-3xl border px-8 py-10 shadow-sm"
          >
            <View
              style={{ backgroundColor: clay.squircle, borderColor: clay.cardBorder }}
              className="h-16 w-16 items-center justify-center rounded-2xl border"
            >
              <Ionicons name="link-outline" size={28} color="#F5D298" />
            </View>
            <Text style={{ color: clay.textPrimary }} className="text-center text-lg font-bold">
              Invite unavailable
            </Text>
            <Text style={{ color: clay.textMuted }} className="text-center text-sm leading-5">
              Return to your group and try again.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
