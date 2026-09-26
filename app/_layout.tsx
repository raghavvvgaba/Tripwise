import "../global.css";

import { useEffect } from "react";
import { ActivityIndicator, Platform, useColorScheme, View } from "react-native";
import { Stack } from "expo-router/stack";
import { StatusBar } from "expo-status-bar";
import { colorScheme as nativeWindColorScheme } from "nativewind";

import { useAuthStore } from "@/store/use-auth-store";
import { WebAppShell } from "@/components/web-app-shell";
import { themeColors, themeVariables } from "@/constants/theme";

export default function RootLayout() {
  const session = useAuthStore((state) => state.session);
  const isLoading = useAuthStore((state) => state.isLoading);
  const initialize = useAuthStore((state) => state.initialize);
  const systemColorScheme = useColorScheme();
  const scheme = systemColorScheme === "dark" ? "dark" : "light";
  const colors = themeColors[scheme];

  useEffect(() => initialize(), [initialize]);
  useEffect(() => {
    if (Platform.OS === "web") nativeWindColorScheme.set(scheme);
  }, [scheme]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas" style={themeVariables[scheme]}>
        <ActivityIndicator color={colors["brand-600"]} />
      </View>
    );
  }

  const screens = (
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.canvas },
          headerTintColor: colors.ink,
          contentStyle: { backgroundColor: colors.canvas },
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
  );

  return (
    <View className="flex-1 bg-canvas" style={themeVariables[scheme]}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      {Platform.OS === "web" && session ? <WebAppShell>{screens}</WebAppShell> : screens}
    </View>
  );
}
