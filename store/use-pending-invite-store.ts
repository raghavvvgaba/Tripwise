import { create } from "zustand";

type PendingInviteState = {
  // Invite code to open once the user finishes signing in.
  code: string | null;
  setCode: (code: string | null) => void;
};

export const usePendingInviteStore = create<PendingInviteState>()((set) => ({
  code: null,
  setCode: (code) => set({ code }),
}));
