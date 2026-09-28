import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, ScrollView, Text, TextInput, View } from "react-native";

import { PrimaryButton } from "@/components/primary-button";
import { BrandIcon } from "@/components/brand-icon";
import { isInviteCode, normalizeInviteCode } from "@/lib/group-invites";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/use-auth-store";

export default function SignInScreen() {
  const { inviteCode } = useLocalSearchParams<{ inviteCode?: string }>();
  const session = useAuthStore((state) => state.session);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!session) return;
    router.replace(isInviteCode(inviteCode) ? `/join/${normalizeInviteCode(inviteCode)}` : "/");
  }, [session?.user.id, inviteCode]);

  async function submit() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) return;

    setIsSubmitting(true);
    setMessage("");
    try {
      if (isCreatingAccount) {
        const { data, error } = await supabase.auth.signUp({ email: normalizedEmail, password });
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
              disabled={!email.trim() || !password}
              onPress={submit}
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
