import { useState } from "react";
import { KeyboardAvoidingView, ScrollView, Text, TextInput, View } from "react-native";

import { PrimaryButton } from "@/components/primary-button";
import { changeEmail } from "@/lib/account-auth";
import { useAuthStore } from "@/store/use-auth-store";

type Feedback = { text: string; isError: boolean };

export default function ChangeEmailScreen() {
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
        text: user.email?.toLowerCase() === email
          ? "Your email address has been updated."
          : "Check your current and new inboxes for confirmation links before using the new address to sign in.",
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
    <KeyboardAvoidingView behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined} className="flex-1">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="w-full max-w-xl self-center gap-6 px-5 pb-12 pt-6 md:px-8"
      >
        <View className="gap-2">
          <Text className="text-lg font-semibold text-ink">Update your sign-in email</Text>
          <Text className="text-sm leading-5 text-muted">
            Your current email is {accountEmail ?? "unavailable"}.
          </Text>
        </View>

        <View className="gap-2">
          <Text className="section-label">New email address</Text>
          <TextInput
            accessibilityLabel="New email address"
            className="field"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="done"
            placeholder="you@example.com"
            placeholderTextColor="#9AA39D"
            value={newEmail}
            onChangeText={(value) => { setNewEmail(value); setFeedback(null); }}
            editable={!isSubmitting}
            onSubmitEditing={submit}
          />
        </View>

        {feedback ? (
          <Text selectable accessibilityRole="alert" className={`text-sm leading-5 ${feedback.isError ? "text-coral" : "text-brand-700"}`}>
            {feedback.text}
          </Text>
        ) : null}

        <PrimaryButton
          label="Update email"
          loading={isSubmitting}
          disabled={!newEmail.trim() || newEmail.trim().toLowerCase() === accountEmail?.toLowerCase()}
          onPress={submit}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
