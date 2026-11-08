import { Ionicons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import * as Updates from "expo-updates";

import { useThemeColors } from "@/constants/theme";
import { applyWebUpdate } from "@/lib/service-worker";
import { useWebUpdateStore } from "@/store/use-web-update-store";

export function UpdateBanner() {
  if (Platform.OS === "web") return <WebUpdateBanner />;
  // OTA updates are unavailable in Expo Go and in ordinary dev builds.
  if (!Updates.isEnabled || __DEV__) return null;

  return <NativeUpdateBanner />;
}

// A new service worker (see lib/service-worker.ts) is waiting to take over.
function WebUpdateBanner() {
  const waitingWorker = useWebUpdateStore((state) => state.waitingWorker);
  const setWaitingWorker = useWebUpdateStore((state) => state.setWaitingWorker);
  const [isApplying, setIsApplying] = useState(false);

  if (!waitingWorker) return null;

  return (
    <UpdateCard
      message="Reload Tripwise to apply the latest improvements."
      busy={isApplying}
      busyLabel="Reloading…"
      restartLabel="Reload now"
      laterHint="Remind me next time"
      onLater={() => setWaitingWorker(null)}
      onRestart={() => {
        setIsApplying(true);
        applyWebUpdate(waitingWorker);
      }}
    />
  );
}

function NativeUpdateBanner() {
  const { isUpdatePending, downloadedUpdate, isRestarting } = Updates.useUpdates();
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
    <UpdateCard
      message={hasRestartError
        ? "Couldn’t restart. Try again, or close and reopen Tripwise."
        : "Restart Tripwise to apply the latest improvements."}
      busy={busy}
      busyLabel="Restarting…"
      restartLabel={hasRestartError ? "Try again" : "Restart now"}
      laterHint="Remind me on the next app launch"
      onLater={() => setDismissedUpdate(pendingUpdate)}
      onRestart={() => void restart()}
    />
  );
}

type UpdateCardProps = {
  message: string;
  busy: boolean;
  busyLabel: string;
  restartLabel: string;
  laterHint: string;
  onLater: () => void;
  onRestart: () => void;
};

function UpdateCard({ message, busy, busyLabel, restartLabel, laterHint, onLater, onRestart }: UpdateCardProps) {
  const colors = useThemeColors();

  return (
    <View className="update-banner">
      <View className="update-banner__card">
        <View className="flex-row items-start gap-3">
          <View className="update-banner__icon">
            <Ionicons name="cloud-done-outline" size={22} color={colors["brand-700"]} />
          </View>
          <View className="flex-1 gap-1" accessibilityLiveRegion="polite">
            <Text className="text-base font-bold text-ink">Update ready</Text>
            <Text className="text-sm leading-5 text-muted">
              {message}
            </Text>
          </View>
        </View>
        <View className="flex-row flex-wrap justify-end gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={laterHint}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={onLater}
            className={`update-banner__later ${busy ? "opacity-50" : ""}`}
          >
            <Text className="text-sm font-semibold text-ink">Later</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={restartLabel}
            accessibilityHint="Applies the downloaded update. Finish any unsaved changes first."
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            onPress={onRestart}
            className={`update-banner__restart ${busy ? "opacity-50" : ""}`}
          >
            <Text className="text-sm font-semibold text-[#2C254E]">
              {busy ? busyLabel : restartLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
