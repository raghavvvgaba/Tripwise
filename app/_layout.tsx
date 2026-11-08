import "../global.css";

import { useEffect, useRef, type ReactNode } from "react";
import { Platform, useColorScheme, View } from "react-native";
import type { NotificationResponse } from "expo-notifications";
import { DarkTheme, DefaultTheme, ThemeProvider, router, useNavigationContainerRef } from "expo-router";
import { Stack } from "expo-router/stack";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { colorScheme as nativeWindColorScheme } from "nativewind";

import { useAuthStore } from "@/store/use-auth-store";
import { QueryProvider } from "@/components/query-provider";
import { OfflineBanner } from "@/components/offline-banner";
import { initializeNetworkMonitoring } from "@/lib/network";
import { Notifications } from "@/lib/notifications-module";
import { registerPushToken } from "@/lib/push-notifications";
import { useSettingsStore } from "@/store/use-settings-store";
import { WebAppShell } from "@/components/web-app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { resolveTheme, themeColors, themeVariables } from "@/constants/theme";
import { useWebKeyboardViewport } from "@/hooks/use-web-keyboard-viewport";
import { registerServiceWorker } from "@/lib/service-worker";

initializeNetworkMonitoring();
registerServiceWorker();

// On web, a deep link (a reload, a shared URL or a manifest shortcut) opens on
// top of the tabs, so modal routes have a screen behind them and Back works.
// Signed-out visitors still land on sign-in, since (tabs) is protected.
export const unstable_settings = Platform.OS === "web" ? { anchor: "(tabs)" } : {};

// Screen layouts also wrap native modal routes.
function screenLayout({ children, route }: { children: ReactNode; route: { name: string } }) {
  return (
    <View className="flex-1">
      {children}
      <OfflineBanner topOffset={route.name === "(tabs)" ? 0 : 48} />
    </View>
  );
}

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

  useWebKeyboardViewport();
  useEffect(() => initialize(), [initialize]);
  useEffect(() => {
    if (!settingsHydrated) return;
    nativeWindColorScheme.set(Platform.OS === "web" ? scheme : themePreference);
  }, [scheme, settingsHydrated, themePreference]);

  // Keep the browser chrome (iOS status bar, Android toolbar) in sync with the app theme.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", colors.canvas);
    document.documentElement.style.colorScheme = scheme;
    document.documentElement.style.backgroundColor = colors.canvas;
    document.body.style.backgroundColor = colors.canvas;
  }, [colors.canvas, scheme]);

  // Register this device for payment reminder pushes whenever a session exists.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (userId) void registerPushToken();
  }, [userId]);

  // Tapping a reminder push opens that group's screen.
  const navigationRef = useNavigationContainerRef();
  const handledNotificationId = useRef<string | null>(null);
  useEffect(() => {
    // Null on web and in Expo Go, which lack native push support.
    const notifications = Notifications;
    if (!notifications) return;

    const openGroup = (response: NotificationResponse | null | undefined) => {
      if (isLoading || !settingsHydrated || !userId || !navigationRef.isReady()) return;
      if (!response || response.actionIdentifier !== notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const notificationId = response.notification.request.identifier;
      if (handledNotificationId.current === notificationId) return;
      const groupId = (response.notification.request.content.data as { groupId?: unknown } | undefined)?.groupId;
      if (typeof groupId !== "string") return;
      handledNotificationId.current = notificationId;
      router.push(`/groups/${groupId}`);
    };

    // Native retains the last tap while auth, settings, or navigation loads.
    const openPendingGroup = () => openGroup(notifications.getLastNotificationResponse());
    const subscription = notifications.addNotificationResponseReceivedListener(openGroup);
    const unsubscribeReady = navigationRef.addListener("ready", openPendingGroup);
    const unsubscribeState = navigationRef.addListener("state", openPendingGroup);
    openPendingGroup();
    return () => {
      subscription.remove();
      unsubscribeReady();
      unsubscribeState();
    };
  }, [isLoading, navigationRef, settingsHydrated, userId]);

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
        screenLayout={screenLayout}
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
    <QueryProvider key={session?.user.id ?? "signed-out"} userId={session?.user.id ?? null}>
      <View key="themed-app-root" className="flex-1 bg-canvas" style={themeVariables[scheme]}>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        <ThemeProvider value={navigationTheme}>
          {Platform.OS === "web" && session ? <WebAppShell>{screens}</WebAppShell> : screens}
          <ConfirmDialog />
        </ThemeProvider>
      </View>
    </QueryProvider>
  );
}
