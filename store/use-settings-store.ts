import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ThemePreference = "system" | "light" | "dark";

type SettingsState = {
  themePreference: ThemePreference;
  isHydrated: boolean;
  setThemePreference: (preference: ThemePreference) => void;
  setHydrated: (hydrated: boolean) => void;
};

type PersistedSettings = Pick<SettingsState, "themePreference">;

export const useSettingsStore = create<SettingsState>()(
  persist<SettingsState, [], [], PersistedSettings>(
    (set) => ({
      themePreference: "system",
      isHydrated: false,
      setThemePreference: (themePreference) => set({ themePreference }),
      setHydrated: (isHydrated) => set({ isHydrated }),
    }),
    {
      name: "tripwise-settings",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ themePreference: state.themePreference }),
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    },
  ),
);
