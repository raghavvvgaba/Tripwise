import AsyncStorage from "@react-native-async-storage/async-storage";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { focusManager, QueryClientProvider, useIsRestoring } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, AppState, Platform, View } from "react-native";

import { createQueryPersistence } from "@/lib/query-persistence";
import { useAuthStore } from "@/store/use-auth-store";
import { createQueryClient } from "@/lib/query-client";

// RootLayout keys this provider by account, giving each session a fresh cache.
export function QueryProvider({ children, userId }: { children: ReactNode; userId: string | null }) {
  const [client] = useState(createQueryClient);
  const [persistence] = useState(() => userId ? createQueryPersistence(userId, AsyncStorage,
    () => useAuthStore.getState().session?.user.id === userId) : null);

  useEffect(() => {
    const clearPreviousAccount = () => {
      if (!persistence || useAuthStore.getState().session?.user.id === userId) return;
      void persistence.remove().catch(() => console.warn("Could not remove saved query cache."));
      client.clear();
    };
    const unsubscribe = useAuthStore.subscribe(clearPreviousAccount);
    clearPreviousAccount();
    return () => { unsubscribe(); clearPreviousAccount(); };
  }, [client, persistence, userId]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    focusManager.setFocused(AppState.currentState === "active");
    const subscription = AppState.addEventListener("change", (status) => {
      focusManager.setFocused(status === "active");
    });
    return () => subscription.remove();
  }, []);

  if (!persistence) return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return (
    <PersistQueryClientProvider client={client} persistOptions={persistence.persistOptions}>
      <RestoredScreens>{children}</RestoredScreens>
    </PersistQueryClientProvider>
  );
}

// Mount screens after hydration, including their imperative focus fetches.
function RestoredScreens({ children }: { children: ReactNode }) {
  const restoring = useIsRestoring();
  if (!restoring) return children;
  return (
    <View className="flex-1 items-center justify-center bg-canvas">
      <ActivityIndicator accessibilityLabel="Loading saved data" color="#F5D298" />
    </View>
  );
}
