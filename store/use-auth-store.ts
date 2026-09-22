import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";

import { supabase } from "@/lib/supabase";

type AuthState = {
  session: Session | null;
  isLoading: boolean;
  initialize: () => () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  isLoading: true,
  initialize: () => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) set({ session, isLoading: false });
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (active) set({ session, isLoading: false });
    }).catch(() => {
      if (active) set({ session: null, isLoading: false });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  },
}));
