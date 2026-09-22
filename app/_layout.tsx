import "../global.css";

import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router/stack";
import { StatusBar } from "expo-status-bar";

import { useAuthStore } from "@/store/use-auth-store";

export default function RootLayout() {
  const session = useAuthStore((state) => state.session);
  const isLoading = useAuthStore((state) => state.isLoading);
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => initialize(), [initialize]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator color="#078455" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "#F5F7F5" },
          headerTintColor: "#17201B",
          contentStyle: { backgroundColor: "#F5F7F5" },
          headerBackButtonDisplayMode: "minimal",
        }}
      >
        <Stack.Protected guard={!session}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="groups/create" options={{ title: "New group", presentation: "modal" }} />
          <Stack.Screen name="groups/archived" options={{ title: "Archived groups" }} />
          <Stack.Screen name="groups/[groupId]/index" options={{ title: "Group" }} />
          <Stack.Screen name="groups/[groupId]/add-expense" options={{ title: "Add expense", presentation: "modal" }} />
          <Stack.Screen name="expenses/[expenseId]" options={{ title: "Expense" }} />
          <Stack.Screen name="invite/[code]" options={{ title: "Join group", presentation: "modal" }} />
          <Stack.Screen name="join/[code]" options={{ title: "Join group" }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}
