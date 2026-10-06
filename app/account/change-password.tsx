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
import { changePassword } from "@/lib/account-auth";

type Feedback = { text: string; isError: boolean };

export default function ChangePasswordScreen() {
  const clay = useClayTheme();
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
            Change Password
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
              Set New Password
            </Text>
            <Text style={{ color: clay.textMuted }} className="text-xs leading-5">
              Enter your current password to confirm this security change.
            </Text>
          </View>

          <View
            style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
            className="gap-4 rounded-3xl border p-5 shadow-sm"
          >
            <View className="gap-2">
              <Text style={{ color: clay.textMuted }} className="text-xs font-bold uppercase tracking-wider">
                Current Password
              </Text>
              <TextInput
                accessibilityLabel="Current password"
                style={{
                  backgroundColor: clay.squircle,
                  borderColor: clay.cardBorder,
                  color: clay.textPrimary,
                }}
                className="h-14 rounded-2xl border px-4 text-base font-bold"
                autoCapitalize="none"
                autoComplete="current-password"
                secureTextEntry
                placeholder="Current password"
                placeholderTextColor={clay.textMuted}
                value={currentPassword}
                onChangeText={(value) => {
                  setCurrentPassword(value);
                  setFeedback(null);
                }}
                editable={!isSubmitting}
              />
            </View>

            <View className="gap-2">
              <Text style={{ color: clay.textMuted }} className="text-xs font-bold uppercase tracking-wider">
                New Password
              </Text>
              <TextInput
                accessibilityLabel="New password"
                style={{
                  backgroundColor: clay.squircle,
                  borderColor: clay.cardBorder,
                  color: clay.textPrimary,
                }}
                className="h-14 rounded-2xl border px-4 text-base font-bold"
                autoCapitalize="none"
                autoComplete="new-password"
                secureTextEntry
                placeholder="New password"
                placeholderTextColor={clay.textMuted}
                value={newPassword}
                onChangeText={(value) => {
                  setNewPassword(value);
                  setFeedback(null);
                }}
                editable={!isSubmitting}
              />
            </View>

            <View className="gap-2">
              <Text style={{ color: clay.textMuted }} className="text-xs font-bold uppercase tracking-wider">
                Confirm New Password
              </Text>
              <TextInput
                accessibilityLabel="Confirm new password"
                style={{
                  backgroundColor: clay.squircle,
                  borderColor: clay.cardBorder,
                  color: clay.textPrimary,
                }}
                className="h-14 rounded-2xl border px-4 text-base font-bold"
                autoCapitalize="none"
                autoComplete="new-password"
                secureTextEntry
                placeholder="Repeat new password"
                placeholderTextColor={clay.textMuted}
                value={confirmPassword}
                onChangeText={(value) => {
                  setConfirmPassword(value);
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
              disabled={!currentPassword || !newPassword || !confirmPassword || isSubmitting}
              onPress={() => void submit()}
              className="h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-[#F5D298] px-5 shadow-sm active:opacity-75 disabled:opacity-40"
            >
              {isSubmitting ? (
                <ActivityIndicator color={clay.heroText} />
              ) : (
                <Text style={{ color: clay.heroText }} className="text-base font-extrabold">
                  Update Password
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
