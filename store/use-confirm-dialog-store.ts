import { create } from "zustand";

type ConfirmRequest = {
  title: string;
  message: string;
  actionLabel: string;
  onConfirm: () => void;
  destructive: boolean;
};

type ConfirmDialogState = {
  request: ConfirmRequest | null;
  show: (request: ConfirmRequest) => void;
  dismiss: () => void;
  confirm: () => void;
};

export const useConfirmDialogStore = create<ConfirmDialogState>((set, get) => ({
  request: null,
  show: (request) => set((state) => state.request ? state : { request }),
  dismiss: () => set({ request: null }),
  confirm: () => {
    const request = get().request;
    if (!request) return;
    set({ request: null });
    request.onConfirm();
  },
}));
