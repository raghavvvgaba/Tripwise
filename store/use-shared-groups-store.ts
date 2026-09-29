import { create } from "zustand";

import { createGroup, deleteSharedGroup, listGroups, restoreSharedGroup, updateGroupCover } from "@/lib/groups";
import type { CurrencyCode } from "@/types/models";
import type { SharedGroup } from "@/types/shared-group";

type SharedGroupsState = {
  groups: SharedGroup[];
  isLoading: boolean;
  error: string | null;
  userId: string | null;
  loadGroups: (userId: string) => Promise<boolean>;
  createGroup: (name: string, currency: CurrencyCode) => Promise<SharedGroup>;
  deleteGroup: (groupId: string) => Promise<void>;
  restoreGroup: (groupId: string) => Promise<void>;
  setCover: (groupId: string, coverPath: string | null, coverThumbnailPath: string | null) => Promise<void>;
  clear: () => void;
};

let latestLoadId = 0;

export const useSharedGroupsStore = create<SharedGroupsState>((set, get) => ({
  groups: [],
  isLoading: false,
  error: null,
  userId: null,
  loadGroups: async (userId) => {
    const loadId = ++latestLoadId;
    set((state) => ({
      groups: state.userId === userId ? state.groups : [],
      isLoading: true,
      error: null,
      userId,
    }));
    try {
      const groups = await listGroups(userId);
      if (get().userId !== userId || latestLoadId !== loadId) return false;
      set({ groups, isLoading: false });
      return true;
    } catch (error) {
      if (get().userId === userId && latestLoadId === loadId) {
        set({ error: error instanceof Error ? error.message : "Could not load groups", isLoading: false });
      }
      return false;
    }
  },
  createGroup: async (name, currency) => {
    const userId = get().userId;
    if (!userId) throw new Error("Sign in required");
    const group = await createGroup(name, currency);
    if (get().userId === userId) set((state) => ({ groups: [group, ...state.groups] }));
    return group;
  },
  deleteGroup: async (groupId) => {
    const userId = get().userId;
    if (!userId) throw new Error("Sign in required");
    const deletedAt = await deleteSharedGroup(groupId);
    if (get().userId === userId) {
      set((state) => ({
        groups: state.groups.map((group) =>
          group.id === groupId ? { ...group, deletedAt } : group,
        ),
      }));
    }
  },
  restoreGroup: async (groupId) => {
    const userId = get().userId;
    if (!userId) throw new Error("Sign in required");
    await restoreSharedGroup(groupId);
    if (get().userId === userId) {
      set((state) => ({
        groups: state.groups.map((group) =>
          group.id === groupId ? { ...group, deletedAt: null } : group,
        ),
      }));
    }
  },
  setCover: async (groupId, coverPath, coverThumbnailPath) => {
    const userId = get().userId;
    if (!userId) throw new Error("Sign in required");
    await updateGroupCover(groupId, coverPath, coverThumbnailPath);
    if (get().userId === userId) {
      set((state) => ({
        groups: state.groups.map((group) =>
          group.id === groupId ? { ...group, coverPath, coverThumbnailPath } : group,
        ),
      }));
    }
  },
  clear: () => {
    latestLoadId++;
    set({ groups: [], isLoading: false, error: null, userId: null });
  },
}));
