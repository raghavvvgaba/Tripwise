import { isRunningInExpoGo } from "expo";

type NotificationsModule = typeof import("expo-notifications");

/**
 * expo-notifications, or null where it can't run. Expo Go on Android ships
 * without its native push modules, so importing it there crashes the app;
 * web has no push support. Loading it lazily lets the rest of the app work in
 * Expo Go while development and production builds get reminders.
 */
export const Notifications: NotificationsModule | null =
  process.env.EXPO_OS === "web" || isRunningInExpoGo()
    ? null
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    : require("expo-notifications");
