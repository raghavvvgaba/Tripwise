import { Platform } from "react-native";
import Constants from "expo-constants";

import { Notifications } from "@/lib/notifications-module";
import { supabase } from "@/lib/supabase";

// Show reminder pushes even while the app is open.
if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Registers this device's Expo push token so other members can remind the
 * signed-in user about money they owe. Safe to call repeatedly: the token is
 * claimed for this user on every sign-in because tokens rotate and devices change hands.
 * Fails quietly — a missing token only means this device cannot be reminded.
 */
export async function registerPushToken(): Promise<void> {
  // Web and Expo Go cannot receive pushes, so they are never registered.
  if (!Notifications) return;

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Payment reminders",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#F5D298",
      });
    }

    let permissions = await Notifications.getPermissionsAsync();
    if (!permissions.granted && permissions.canAskAgain) {
      permissions = await Notifications.requestPermissionsAsync();
    }
    if (!permissions.granted) return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return;

    // Claims the token for this user, so a previous account on this device stops getting pushes.
    const { error } = await supabase.rpc("register_push_token", { p_token: token, p_platform: Platform.OS });
    if (error) throw error;
  } catch (error) {
    console.warn("Push token registration skipped:", error);
  }
}

/** Removes only this device's token before sign-out; other devices stay registered. */
export async function unregisterPushTokens(userId: string): Promise<void> {
  if (!Notifications) return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  if (!token) return;

  const { error } = await supabase.from("push_tokens").delete()
    .eq("user_id", userId)
    .eq("token", token);
  if (error) throw error;
}
