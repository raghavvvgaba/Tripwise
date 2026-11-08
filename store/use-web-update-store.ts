import { create } from "zustand";

type WebUpdateState = {
  // A new service worker has installed and is waiting to take over.
  waitingWorker: ServiceWorker | null;
  setWaitingWorker: (worker: ServiceWorker | null) => void;
};

export const useWebUpdateStore = create<WebUpdateState>()((set) => ({
  waitingWorker: null,
  setWaitingWorker: (waitingWorker) => set({ waitingWorker }),
}));
