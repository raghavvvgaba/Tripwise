import { useState } from "react";
import { KeyboardAvoidingView, ScrollView, Text, TextInput, View } from "react-native";

import { PrimaryButton } from "@/components/primary-button";
import { changePassword } from "@/lib/account-auth";

type Feedback = { text: string; isError: boolean };

export default function ChangePasswordScreen() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function submit() {
    if (!currentPassword || !newPassword || !confirmPassword || isSubmitting) return;
    if (newPassword !== confirmPassword) {
      setFeedback({ text: "New passwords do not match.", isError: true });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFeedback({ text: "Your password has been updated.", isError: false });
    } catch (error) {
      setFeedback({
        text: error instanceof Error ? error.message : "Could not update your password. Please try again.",
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
          <Text className="text-lg font-semibold text-ink">Set a new password</Text>
          <Text className="text-sm leading-5 text-muted">Enter your current password to confirm this change.</Text>
        </View>

        <View className="gap-4">
          <View className="gap-2">
            <Text className="section-label">Current password</Text>
            <TextInput
              accessibilityLabel="Current password"
              className="field"
              autoCapitalize="none"
              autoComplete="current-password"
              secureTextEntry
              placeholder="Current password"
              placeholderTextColor="#9AA39D"
              value={currentPassword}
              onChangeText={(value) => { setCurrentPassword(value); setFeedback(null); }}
              editable={!isSubmitting}
            />
          </View>
          <View className="gap-2">
            <Text className="section-label">New password</Text>
            <TextInput
              accessibilityLabel="New password"
              className="field"
              autoCapitalize="none"
              autoComplete="new-password"
              secureTextEntry
              placeholder="New password"
              placeholderTextColor="#9AA39D"
              value={newPassword}
              onChangeText={(value) => { setNewPassword(value); setFeedback(null); }}
              editable={!isSubmitting}
            />
          </View>
          <View className="gap-2">
            <Text className="section-label">Confirm new password</Text>
            <TextInput
              accessibilityLabel="Confirm new password"
              className="field"
              autoCapitalize="none"
              autoComplete="new-password"
              secureTextEntry
              placeholder="Repeat new password"
              placeholderTextColor="#9AA39D"
              value={confirmPassword}
              onChangeText={(value) => { setConfirmPassword(value); setFeedback(null); }}
              editable={!isSubmitting}
              onSubmitEditing={submit}
            />
          </View>
        </View>

        {feedback ? (
          <Text selectable accessibilityRole="alert" className={`text-sm leading-5 ${feedback.isError ? "text-coral" : "text-brand-700"}`}>
            {feedback.text}
          </Text>
        ) : null}

        <PrimaryButton
          label="Update password"
          loading={isSubmitting}
          disabled={!currentPassword || !newPassword || !confirmPassword}
          onPress={submit}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
