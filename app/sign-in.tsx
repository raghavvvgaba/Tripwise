import * as Linking from "expo-linking";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandIcon } from "@/components/brand-icon";
import { GoogleIcon } from "@/components/google-icon";
import { useClayTheme } from "@/constants/clay-theme";
import { isInviteCode, normalizeInviteCode } from "@/lib/group-invites";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/use-auth-store";

export default function SignInScreen() {
  const clay = useClayTheme();
  const { inviteCode } = useLocalSearchParams<{ inviteCode?: string }>();
  const incomingUrl = Linking.useURL();
  const handledAuthUrl = useRef<string | null>(null);
  const session = useAuthStore((state) => state.session);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!session) return;
    router.replace(isInviteCode(inviteCode) ? `/join/${normalizeInviteCode(inviteCode)}` : "/");
  }, [session, inviteCode]);

  useEffect(() => {
    if (process.env.EXPO_OS === "web" || !incomingUrl || handledAuthUrl.current === incomingUrl) return;

    const { queryParams } = Linking.parse(incomingUrl);
    let code = queryParams?.code;
    let authError = queryParams?.error_description ?? queryParams?.error;
    let accessToken: string | undefined;
    let refreshToken: string | undefined;

    if (incomingUrl.includes("#")) {
      const hash = incomingUrl.split("#")[1];
      const hashParams = new URLSearchParams(hash);
      accessToken = hashParams.get("access_token") ?? undefined;
      refreshToken = hashParams.get("refresh_token") ?? undefined;
      authError = authError ?? hashParams.get("error_description") ?? hashParams.get("error") ?? undefined;
    }

    if (typeof authError === "string") {
      handledAuthUrl.current = incomingUrl;
      setMessage(authError);
      return;
    }

    if (accessToken && refreshToken) {
      handledAuthUrl.current = incomingUrl;
      setIsGoogleSubmitting(true);
      void supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          if (error) setMessage(error.message);
        })
        .catch((error: unknown) => {
          setMessage(error instanceof Error ? error.message : "Google sign-in failed. Please try again.");
        })
        .finally(() => {
          setIsGoogleSubmitting(false);
        });
      return;
    }

    if (typeof code === "string") {
      handledAuthUrl.current = incomingUrl;
      setIsGoogleSubmitting(true);
      void supabase.auth
        .exchangeCodeForSession(code)
        .then(({ error }) => {
          if (error) setMessage(error.message);
        })
        .catch((error: unknown) => {
          setMessage(error instanceof Error ? error.message : "Google sign-in failed. Please try again.");
        })
        .finally(() => {
          setIsGoogleSubmitting(false);
        });
    }
  }, [incomingUrl]);

  async function submit() {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();
    if (!normalizedEmail || !password || (isCreatingAccount && !trimmedName)) return;

    setIsSubmitting(true);
    setMessage("");
    try {
      if (isCreatingAccount) {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { data: { name: trimmedName } },
        });
        if (error) throw error;
        if (!data.session) setMessage("Account created. Check your email to confirm it, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error) throw error;
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function continueWithGoogle() {
    if (isSubmitting || isGoogleSubmitting) return;

    setIsGoogleSubmitting(true);
    setMessage("");
    try {
      const redirectTo = Linking.createURL("sign-in", {
        queryParams: isInviteCode(inviteCode) ? { inviteCode: normalizeInviteCode(inviteCode) } : {},
      });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: process.env.EXPO_OS !== "web" },
      });
      if (error) throw error;
      if (process.env.EXPO_OS !== "web") {
        if (!data.url) throw new Error("Could not start Google sign-in. Please try again.");
        await Linking.openURL(data.url);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Google sign-in failed. Please try again.");
    } finally {
      setIsGoogleSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: clay.canvas }}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="w-full max-w-md flex-grow self-center justify-center gap-6 px-5 py-8"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Brand Logo & Welcome ── */}
          <View className="items-center gap-2">
            <View
              style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
              className="h-16 w-16 items-center justify-center rounded-3xl border shadow-sm"
            >
              <BrandIcon size={34} />
            </View>
            <Text style={{ color: clay.textPrimary }} className="text-2xl font-black tracking-tight">
              {isCreatingAccount ? "Create Account" : "Welcome to Tripwise"}
            </Text>
            <Text style={{ color: clay.textMuted }} className="text-center text-xs">
              Split bills effortlessly with tactile precision.
            </Text>
          </View>

          {/* ── Auth Card ── */}
          <View
            style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
            className="gap-4 rounded-3xl border p-5 shadow-sm"
          >
            {/* Segmented Auth Toggle */}
            <View
              style={{ backgroundColor: clay.squircle, borderColor: clay.cardBorder }}
              className="flex-row rounded-2xl border p-1"
            >
              <Pressable
                onPress={() => {
                  setIsCreatingAccount(false);
                  setMessage("");
                }}
                style={
                  !isCreatingAccount
                    ? { backgroundColor: clay.card, borderColor: clay.cardBorder }
                    : undefined
                }
                className={`h-10 flex-1 items-center justify-center rounded-xl ${!isCreatingAccount ? "border shadow-sm" : ""}`}
              >
                <Text
                  style={{ color: !isCreatingAccount ? clay.textPrimary : clay.textMuted }}
                  className="text-xs font-black"
                >
                  Sign In
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setIsCreatingAccount(true);
                  setMessage("");
                }}
                style={
                  isCreatingAccount
                    ? { backgroundColor: clay.card, borderColor: clay.cardBorder }
                    : undefined
                }
                className={`h-10 flex-1 items-center justify-center rounded-xl ${isCreatingAccount ? "border shadow-sm" : ""}`}
              >
                <Text
                  style={{ color: isCreatingAccount ? clay.textPrimary : clay.textMuted }}
                  className="text-xs font-black"
                >
                  Register
                </Text>
              </Pressable>
            </View>

            {isCreatingAccount ? (
              <View className="gap-1.5">
                <Text style={{ color: clay.textMuted }} className="text-xs font-bold uppercase tracking-wider">
                  Full Name
                </Text>
                <TextInput
                  style={{
                    backgroundColor: clay.squircle,
                    borderColor: clay.cardBorder,
                    color: clay.textPrimary,
                  }}
                  className="h-13 rounded-2xl border px-4 text-base font-bold"
                  autoCapitalize="words"
                  autoComplete="name"
                  placeholder="e.g. Alex River"
                  placeholderTextColor={clay.textMuted}
                  value={name}
                  onChangeText={setName}
                  editable={!isSubmitting && !isGoogleSubmitting}
                />
              </View>
            ) : null}

            <View className="gap-1.5">
              <Text style={{ color: clay.textMuted }} className="text-xs font-bold uppercase tracking-wider">
                Email Address
              </Text>
              <TextInput
                style={{
                  backgroundColor: clay.squircle,
                  borderColor: clay.cardBorder,
                  color: clay.textPrimary,
                }}
                className="h-13 rounded-2xl border px-4 text-base font-bold"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor={clay.textMuted}
                value={email}
                onChangeText={setEmail}
                editable={!isSubmitting && !isGoogleSubmitting}
              />
            </View>

            <View className="gap-1.5">
              <Text style={{ color: clay.textMuted }} className="text-xs font-bold uppercase tracking-wider">
                Password
              </Text>
              <TextInput
                style={{
                  backgroundColor: clay.squircle,
                  borderColor: clay.cardBorder,
                  color: clay.textPrimary,
                }}
                className="h-13 rounded-2xl border px-4 text-base font-bold"
                autoCapitalize="none"
                autoComplete={isCreatingAccount ? "new-password" : "current-password"}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor={clay.textMuted}
                value={password}
                onChangeText={setPassword}
                editable={!isSubmitting && !isGoogleSubmitting}
                onSubmitEditing={submit}
              />
            </View>

            {message ? (
              <Text selectable style={{ color: clay.errorText }} className="px-1 text-xs font-semibold">
                {message}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={!email.trim() || !password || (isCreatingAccount && !name.trim()) || isSubmitting || isGoogleSubmitting}
              onPress={() => void submit()}
              className="mt-1 h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-[#F5D298] px-5 shadow-sm active:opacity-75 disabled:opacity-40"
            >
              {isSubmitting ? (
                <ActivityIndicator color={clay.heroText} />
              ) : (
                <Text style={{ color: clay.heroText }} className="text-base font-extrabold">
                  {isCreatingAccount ? "Create Account" : "Sign In"}
                </Text>
              )}
            </Pressable>

            <View className="my-1 flex-row items-center gap-3">
              <View style={{ backgroundColor: clay.cardBorder }} className="h-px flex-1" />
              <Text style={{ color: clay.textMuted }} className="text-[11px] font-bold uppercase">
                or
              </Text>
              <View style={{ backgroundColor: clay.cardBorder }} className="h-px flex-1" />
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting || isGoogleSubmitting}
              onPress={() => void continueWithGoogle()}
              style={{
                backgroundColor: clay.squircle,
                borderColor: clay.cardBorder,
              }}
              className="h-14 flex-row items-center justify-center gap-3 rounded-2xl border px-5 active:opacity-75 disabled:opacity-50"
            >
              {isGoogleSubmitting ? (
                <ActivityIndicator color={clay.textPrimary} />
              ) : (
                <>
                  <GoogleIcon size={20} />
                  <Text style={{ color: clay.textPrimary }} className="text-base font-bold">
                    Continue with Google
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
