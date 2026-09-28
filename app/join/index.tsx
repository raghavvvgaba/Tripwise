import { router, Stack } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, ScrollView, Text, TextInput, View } from "react-native";

import { PrimaryButton } from "@/components/primary-button";
import { isInviteCode } from "@/lib/group-invites";

export default function EnterInviteCodeScreen() {
  const [code, setCode] = useState("");

  function openInvite() {
    if (isInviteCode(code)) router.push(`/join/${code}`);
  }

  return (
    <>
      <Stack.Screen options={{ title: "Join a group" }} />
      <KeyboardAvoidingView behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="w-full max-w-2xl flex-grow self-center justify-center gap-6 px-5 py-10 md:px-8"
        >
          <View className="gap-2">
            <Text className="text-3xl font-bold text-ink">Join a group</Text>
            <Text className="text-sm leading-5 text-muted">Enter the eight-letter code shared by a group member.</Text>
          </View>
          <View className="card gap-4 p-5">
            <Text className="section-label">Invite code</Text>
            <TextInput
              autoFocus
              autoCapitalize="characters"
              autoCorrect={false}
              className="field text-center text-2xl font-bold tracking-[5px]"
              placeholder="ABCDEFGH"
              placeholderTextColor="#9AA39D"
              value={code}
              onChangeText={(value) => setCode(value.replace(/[^a-z]/gi, "").toUpperCase().slice(0, 8))}
              onSubmitEditing={openInvite}
              returnKeyType="go"
            />
            <PrimaryButton label="Continue" disabled={!isInviteCode(code)} onPress={openInvite} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
