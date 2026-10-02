import { focusManager, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { AppState, Platform } from "react-native";

import { createQueryClient } from "@/lib/query-client";

// RootLayout keys this provider by account, giving each session a fresh cache.
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);

  useEffect(() => () => client.clear(), [client]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    focusManager.setFocused(AppState.currentState === "active");
    const subscription = AppState.addEventListener("change", (status) => {
      focusManager.setFocused(status === "active");
    });
    return () => subscription.remove();
  }, []);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
