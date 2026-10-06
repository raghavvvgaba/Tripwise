import "../global.css";

import { useEffect } from "react";
import { Platform, useColorScheme, View } from "react-native";
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import { Stack } from "expo-router/stack";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { colorScheme as nativeWindColorScheme } from "nativewind";

import { useAuthStore } from "@/store/use-auth-store";
import { QueryProvider } from "@/components/query-provider";
import { useSettingsStore } from "@/store/use-settings-store";
import { WebAppShell } from "@/components/web-app-shell";
import { WebConfirmDialog } from "@/components/web-confirm-dialog";
import { resolveTheme, themeColors, themeVariables } from "@/constants/theme";

void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const session = useAuthStore((state) => state.session);
  const isLoading = useAuthStore((state) => state.isLoading);
  const initialize = useAuthStore((state) => state.initialize);
  const themePreference = useSettingsStore((state) => state.themePreference);
  const settingsHydrated = useSettingsStore((state) => state.isHydrated);
  const systemColorScheme = useColorScheme();
  const scheme = resolveTheme(themePreference, systemColorScheme);
  const colors = themeColors[scheme];
  const baseNavigationTheme = scheme === "dark" ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseNavigationTheme,
    colors: {
      ...baseNavigationTheme.colors,
      primary: colors["brand-700"],
      background: colors.canvas,
      card: colors.surface,
      text: colors.ink,
      border: colors.line,
      notification: colors.coral,
    },
  };

  useEffect(() => initialize(), [initialize]);
  useEffect(() => {
    if (!settingsHydrated) return;
    nativeWindColorScheme.set(Platform.OS === "web" ? scheme : themePreference);
  }, [scheme, settingsHydrated, themePreference]);

  useEffect(() => {
    if (!isLoading && settingsHydrated) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading, settingsHydrated]);

  if (isLoading || !settingsHydrated) {
    return null;
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
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="join/[code]" options={{ title: "Join group", headerShown: false }} />
        <Stack.Screen name="join/index" options={{ title: "Join a group", headerShown: false }} />
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="account/change-email" options={{ title: "Change email", headerShown: false }} />
          <Stack.Screen name="account/change-password" options={{ title: "Change password", headerShown: false }} />
          <Stack.Screen name="groups/create" options={{ title: "New group", presentation: Platform.OS === "web" ? "transparentModal" : "modal", headerShown: false, animation: Platform.OS === "web" ? "none" : undefined }} />
          <Stack.Screen name="groups/deleted" options={{ title: "Deleted groups", headerShown: false }} />
          <Stack.Screen name="groups/[groupId]/index" options={{ title: "Group", headerShown: false }} />
          <Stack.Screen name="groups/[groupId]/settings" options={{ title: "Group settings", headerShown: false }} />
          <Stack.Screen name="groups/[groupId]/members" options={{ title: "Members", headerShown: false }} />
          <Stack.Screen name="groups/[groupId]/add-expense" options={{ title: "Add expense", presentation: "transparentModal", headerShown: false, animation: "none", contentStyle: { backgroundColor: "transparent" } }} />
          <Stack.Screen name="groups/[groupId]/record-payment" options={{ title: "Record payment", presentation: Platform.OS === "web" ? "transparentModal" : "modal", headerShown: false, animation: Platform.OS === "web" ? "none" : undefined }} />
          <Stack.Screen name="expenses/[expenseId]" options={{ title: "Expense", headerShown: false }} />
          <Stack.Screen name="groups/[groupId]/invite" options={{ title: "Invite members", presentation: Platform.OS === "web" ? "transparentModal" : "modal", headerShown: false, animation: Platform.OS === "web" ? "none" : undefined }} />
        </Stack.Protected>
      </Stack>
  );

  return (
    <QueryProvider key={session?.user.id ?? "signed-out"}>
      <View className="flex-1 bg-canvas" style={themeVariables[scheme]}>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        <ThemeProvider value={navigationTheme}>
          {Platform.OS === "web" && session ? <WebAppShell>{screens}</WebAppShell> : screens}
          <WebConfirmDialog />
        </ThemeProvider>
      </View>
    </QueryProvider>
  );
}
