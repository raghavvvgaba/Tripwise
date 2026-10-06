import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useState } from "react";
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

import { useClayTheme } from "@/constants/clay-theme";
import { changeEmail } from "@/lib/account-auth";
import { useAuthStore } from "@/store/use-auth-store";

type Feedback = { text: string; isError: boolean };

export default function ChangeEmailScreen() {
  const clay = useClayTheme();
  const accountEmail = useAuthStore((state) => state.session?.user.email);
  const [newEmail, setNewEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function submit() {
    const email = newEmail.trim().toLowerCase();
    if (!email || email === accountEmail?.toLowerCase() || isSubmitting) return;

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const user = await changeEmail(email);
      setNewEmail("");
      setFeedback({
        text:
          user.email?.toLowerCase() === email
            ? "Your email address has been updated."
            : "Check your current and new inboxes for confirmation links before signing in with the new address.",
        isError: false,
      });
    } catch (error) {
      setFeedback({
        text: error instanceof Error ? error.message : "Could not update your email. Please try again.",
        isError: true,
      });
    } finally {
      setIsSubmitting(false);
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
            Security
          </Text>
          <Text style={{ color: clay.textPrimary }} className="text-base font-extrabold">
            Change Email
          </Text>
        </View>

        <View className="h-11 w-11" />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="w-full max-w-xl self-center gap-5 px-5 pb-12 pt-3 md:px-8"
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-1 px-1">
            <Text style={{ color: clay.textPrimary }} className="text-xl font-black">
              Update Sign-in Email
            </Text>
            <Text style={{ color: clay.textMuted }} className="text-xs leading-5">
              Current email: {accountEmail ?? "unavailable"}
            </Text>
          </View>

          <View
            style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
            className="gap-4 rounded-3xl border p-5 shadow-sm"
          >
            <View className="gap-2">
              <Text style={{ color: clay.textMuted }} className="text-xs font-bold uppercase tracking-wider">
                New Email Address
              </Text>
              <TextInput
                accessibilityLabel="New email address"
                style={{
                  backgroundColor: clay.squircle,
                  borderColor: clay.cardBorder,
                  color: clay.textPrimary,
                }}
                className="h-14 rounded-2xl border px-4 text-base font-bold"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="done"
                placeholder="you@example.com"
                placeholderTextColor={clay.textMuted}
                value={newEmail}
                onChangeText={(value) => {
                  setNewEmail(value);
                  setFeedback(null);
                }}
                editable={!isSubmitting}
                onSubmitEditing={submit}
              />
            </View>

            {feedback ? (
              <Text
                selectable
                style={{ color: feedback.isError ? clay.errorText : clay.badgePositiveText }}
                className="px-1 text-xs font-semibold leading-5"
              >
                {feedback.text}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={!newEmail.trim() || newEmail.trim().toLowerCase() === accountEmail?.toLowerCase() || isSubmitting}
              onPress={() => void submit()}
              className="h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-[#F5D298] px-5 shadow-sm active:opacity-75 disabled:opacity-40"
            >
              {isSubmitting ? (
                <ActivityIndicator color={clay.heroText} />
              ) : (
                <Text style={{ color: clay.heroText }} className="text-base font-extrabold">
                  Update Email
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
