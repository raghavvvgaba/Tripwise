import * as Linking from "expo-linking";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, ScrollView, Text, TextInput, View } from "react-native";

import { PrimaryButton } from "@/components/primary-button";
import { BrandIcon } from "@/components/brand-icon";
import { isInviteCode, normalizeInviteCode } from "@/lib/group-invites";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/use-auth-store";

export default function SignInScreen() {
  const { inviteCode } = useLocalSearchParams<{ inviteCode?: string }>();
  const incomingUrl = Linking.useURL();
  const handledAuthUrl = useRef<string | null>(null);
  const session = useAuthStore((state) => state.session);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!session) return;
    router.replace(isInviteCode(inviteCode) ? `/join/${normalizeInviteCode(inviteCode)}` : "/");
  }, [session?.user.id, inviteCode]);

  useEffect(() => {
    if (process.env.EXPO_OS === "web" || !incomingUrl || handledAuthUrl.current === incomingUrl) return;

    const { queryParams } = Linking.parse(incomingUrl);
    const code = queryParams?.code;
    const authError = queryParams?.error_description ?? queryParams?.error;
    if (typeof code !== "string" && typeof authError !== "string") return;

    handledAuthUrl.current = incomingUrl;
    if (typeof authError === "string") {
      setMessage(authError);
      return;
    }
    if (typeof code !== "string") return;

    setIsSubmitting(true);
    void supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) setMessage(error.message);
    }).catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : "Google sign-in failed. Please try again.");
    }).finally(() => {
      setIsSubmitting(false);
    });
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
    if (isSubmitting) return;

    setIsSubmitting(true);
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
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: isCreatingAccount ? "Create account" : "Sign in" }} />
      <KeyboardAvoidingView behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="w-full max-w-5xl flex-grow self-center justify-center gap-6 px-5 py-10 md:px-8 lg:flex-row lg:items-center lg:gap-20"
        >
          <View className="gap-3 lg:flex-1">
            <View className="mb-3 hidden h-12 w-12 lg:flex">
              <BrandIcon size={48} />
            </View>
            <Text className="text-3xl font-bold tracking-tight text-ink lg:text-5xl">{isCreatingAccount ? "Create your account" : "Welcome to Tripwise"}</Text>
            <Text className="text-sm leading-5 text-muted lg:max-w-md lg:text-base lg:leading-7">Keep your shared expenses in one calm, clear place.</Text>
          </View>

          <View className="card gap-4 p-5 lg:w-[420px] lg:p-8">
            {isCreatingAccount ? (
              <View className="gap-2">
                <Text className="section-label">Name</Text>
                <TextInput
                  className="field"
                  autoCapitalize="words"
                  autoComplete="name"
                  placeholder="Your name"
                  placeholderTextColor="#9AA39D"
                  value={name}
                  onChangeText={setName}
                  editable={!isSubmitting}
                />
              </View>
            ) : null}
            <View className="gap-2">
              <Text className="section-label">Email</Text>
              <TextInput
                className="field"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor="#9AA39D"
                value={email}
                onChangeText={setEmail}
                editable={!isSubmitting}
              />
            </View>
            <View className="gap-2">
              <Text className="section-label">Password</Text>
              <TextInput
                className="field"
                autoCapitalize="none"
                autoComplete={isCreatingAccount ? "new-password" : "current-password"}
                secureTextEntry
                placeholder="Your password"
                placeholderTextColor="#9AA39D"
                value={password}
                onChangeText={setPassword}
                editable={!isSubmitting}
                onSubmitEditing={submit}
              />
            </View>
            {message ? <Text selectable className="text-sm text-coral">{message}</Text> : null}
            <PrimaryButton
              label={isCreatingAccount ? "Create account" : "Sign in"}
              loading={isSubmitting}
              disabled={!email.trim() || !password || (isCreatingAccount && !name.trim())}
              onPress={submit}
            />
            <View className="flex-row items-center gap-3">
              <View className="h-px flex-1 bg-line" />
              <Text className="text-xs text-muted">or</Text>
              <View className="h-px flex-1 bg-line" />
            </View>
            <PrimaryButton
              label="Continue with Google"
              icon="logo-google"
              variant="secondary"
              loading={isSubmitting}
              onPress={continueWithGoogle}
            />
            <Text
              accessibilityRole="button"
              onPress={() => {
                setIsCreatingAccount((value) => !value);
                setMessage("");
              }}
              className="py-2 text-center text-sm font-semibold text-brand-700"
            >
              {isCreatingAccount ? "Already have an account? Sign in" : "New here? Create an account"}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
