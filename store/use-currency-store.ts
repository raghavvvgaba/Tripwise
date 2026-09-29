import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { CurrencyCode } from "@/types/models";

type CurrencyState = {
  defaultCurrency: CurrencyCode;
  setDefaultCurrency: (currency: CurrencyCode) => void;
};

type PersistedCurrency = Pick<CurrencyState, "defaultCurrency">;

export const useCurrencyStore = create<CurrencyState>()(
  persist<CurrencyState, [], [], PersistedCurrency>(
    (set) => ({
      defaultCurrency: "INR",
      setDefaultCurrency: (defaultCurrency) => set({ defaultCurrency }),
    }),
    {
      // Keep the existing key and version so saved currency preferences survive.
      name: "tripwise-groups",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persisted) => ({
        defaultCurrency: (persisted as Partial<PersistedCurrency>).defaultCurrency ?? "INR",
      }),
      partialize: (state) => ({ defaultCurrency: state.defaultCurrency }),
    },
  ),
);
