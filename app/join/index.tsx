import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useClayTheme } from "@/constants/clay-theme";
import { isInviteCode } from "@/lib/group-invites";

export default function EnterInviteCodeScreen() {
  const clay = useClayTheme();
  const [code, setCode] = useState("");

  function handleCodeChange(raw: string) {
    let text = raw.trim();
    // Support pasting full invite URLs like https://tripwise.raghavgaba.me/join/ABCDEFGH
    const urlMatch = text.match(/\/join\/([A-Za-z0-9]{8})/i);
    if (urlMatch) {
      text = urlMatch[1];
    }
    setCode(text.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 8));
  }

  function openInvite() {
    if (isInviteCode(code)) {
      Keyboard.dismiss();
      router.push(`/join/${code}`);
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
          onPress={() => {
            Keyboard.dismiss();
            router.back();
          }}
          style={{ backgroundColor: clay.headerBtn, borderColor: clay.cardBorder }}
          className="h-11 w-11 items-center justify-center rounded-2xl border active:opacity-75"
        >
          <Ionicons name="chevron-back" size={20} color={clay.textPrimary} />
        </Pressable>

        <View className="items-center">
          <Text style={{ color: clay.textMuted }} className="text-[11px] font-bold uppercase tracking-widest">
            Join Group
          </Text>
          <Text style={{ color: clay.textPrimary }} className="text-base font-extrabold">
            Enter Code
          </Text>
        </View>

        <View className="h-11 w-11" />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
        className="flex-1"
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentInsetAdjustmentBehavior="never"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            contentContainerClassName="w-full max-w-md self-center gap-5 px-5 pt-3 pb-12"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Screen Title & Instructions ── */}
            <View className="gap-1 px-1">
              <Text style={{ color: clay.textPrimary }} className="text-2xl font-black">
                Enter Group Code
              </Text>
              <Text style={{ color: clay.textMuted }} className="text-xs leading-5">
                Enter the eight-character invite code shared by any group member.
              </Text>
            </View>

            {/* ── Code Entry Card ── */}
            <View
              style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
              className="gap-4 rounded-3xl border p-5 shadow-sm"
            >
              <View className="gap-2">
                <Text style={{ color: clay.textMuted }} className="text-xs font-bold uppercase tracking-wider">
                  Invite Code
                </Text>
                <TextInput
                  autoFocus
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={{
                    backgroundColor: clay.squircle,
                    borderColor: clay.cardBorder,
                    color: clay.textPrimary,
                  }}
                  className="h-14 rounded-2xl border px-4 text-center font-mono text-2xl font-black tracking-[6px]"
                  placeholder="ABCDEFGH"
                  placeholderTextColor={clay.textMuted}
                  value={code}
                  onChangeText={handleCodeChange}
                  onSubmitEditing={openInvite}
                  returnKeyType="go"
                />
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={!isInviteCode(code)}
                onPress={openInvite}
                className="h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-[#F5D298] px-5 shadow-sm active:opacity-75 disabled:opacity-40"
              >
                <Text style={{ color: clay.heroText }} className="text-base font-extrabold">
                  Continue
                </Text>
                <Ionicons name="arrow-forward" size={18} color={clay.heroText} />
              </Pressable>
            </View>

            {/* ── Helpful Tip ── */}
            <View className="flex-row items-center justify-center gap-1.5 px-2 pt-1">
              <Ionicons name="information-circle-outline" size={15} color={clay.textMuted} />
              <Text style={{ color: clay.textMuted }} className="text-xs">
                You can also paste a full invite link here.
              </Text>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
