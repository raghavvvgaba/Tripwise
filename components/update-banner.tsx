import { Ionicons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Updates from "expo-updates";

import { useThemeColors } from "@/constants/theme";

export function UpdateBanner() {
  // OTA updates are unavailable on web, in Expo Go, and in ordinary dev builds.
  if (Platform.OS === "web" || !Updates.isEnabled || __DEV__) return null;

  return <NativeUpdateBanner />;
}

function NativeUpdateBanner() {
  const { isUpdatePending, downloadedUpdate, isRestarting } = Updates.useUpdates();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [dismissedUpdate, setDismissedUpdate] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [hasRestartError, setHasRestartError] = useState(false);
  const restartInFlight = useRef(false);
  // Rollback directives have a creation date but no update ID.
  const pendingUpdate = downloadedUpdate?.updateId
    ?? downloadedUpdate?.createdAt.toISOString()
    ?? "pending";

  if (!isUpdatePending || dismissedUpdate === pendingUpdate) return null;

  const busy = isApplying || isRestarting;

  async function restart() {
    if (restartInFlight.current || isRestarting) return;
    restartInFlight.current = true;
    setIsApplying(true);
    setHasRestartError(false);
    try {
      await Updates.reloadAsync();
    } catch {
      restartInFlight.current = false;
      setIsApplying(false);
      setHasRestartError(true);
    }
  }

  return (
    <View
      pointerEvents="box-none"
      className="update-banner"
      style={{ top: insets.top + 64, left: insets.left + 16, right: insets.right + 16 }}
    >
      <View className="update-banner__card">
        <View className="flex-row items-start gap-3">
          <View className="update-banner__icon">
            <Ionicons name="cloud-done-outline" size={22} color={colors["brand-700"]} />
          </View>
          <View className="flex-1 gap-1" accessibilityLiveRegion="polite">
            <Text className="text-base font-bold text-ink">Update ready</Text>
            <Text className="text-sm leading-5 text-muted">
              {hasRestartError
                ? "Couldn’t restart. Try again, or close and reopen Tripwise."
                : "Restart Tripwise to apply the latest improvements."}
            </Text>
          </View>
        </View>
        <View className="flex-row flex-wrap justify-end gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remind me on the next app launch"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => setDismissedUpdate(pendingUpdate)}
            className={`update-banner__later ${busy ? "opacity-50" : ""}`}
          >
            <Text className="text-sm font-semibold text-ink">Later</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hasRestartError ? "Try restarting again" : "Restart Tripwise now"}
            accessibilityHint="Applies the downloaded update. Finish any unsaved changes first."
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            onPress={() => void restart()}
            className={`update-banner__restart ${busy ? "opacity-50" : ""}`}
          >
            <Text className="text-sm font-semibold text-[#2C254E]">
              {busy ? "Restarting…" : hasRestartError ? "Try again" : "Restart now"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
