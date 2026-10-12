import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";
import { AppState, Platform } from "react-native";

import { useNetworkStore } from "@/store/use-network-store";

export function initializeNetworkMonitoring() {
  // Replaces and cleans up the previous listener on Fast Refresh.
  // Connectivity lives outside the account-keyed QueryProvider.
  onlineManager.setEventListener((setOnline) => {
    const updateStatus = (state: NetInfoState) => {
      if (state.isConnected === null && state.isInternetReachable === null) return;

      // Wi-Fi can be connected without internet. Unknown reachability alone
      // should not block requests before NetInfo provides a definite result.
      const isOnline = state.isConnected !== false && state.isInternetReachable !== false;
      useNetworkStore.setState({ isOnline });
      setOnline(isOnline);
    };

    const unsubscribe = NetInfo.addEventListener(updateStatus);
    const subscription = Platform.OS === "web" ? null : AppState.addEventListener("change", (status) => {
      if (status === "active") {
        // iOS can miss changes in the background. refresh notifies our listener.
        void NetInfo.refresh().catch(() => {});
      }
    });

    return () => {
      unsubscribe();
      subscription?.remove();
    };
  });
}
