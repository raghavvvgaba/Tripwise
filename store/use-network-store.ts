import { create } from "zustand";

type NetworkState = {
  // null means NetInfo has not reported a usable status yet.
  isOnline: boolean | null;
};

export const useNetworkStore = create<NetworkState>(() => ({ isOnline: null }));
