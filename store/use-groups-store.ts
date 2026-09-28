import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { seedMembers } from "@/data/seed";
import type { CurrencyCode, Expense, Group, Member } from "@/types/models";

type NewGroupInput = Pick<Group, "name"> & {
  currency?: Group["currency"];
  placeholderNames: string[];
};

type NewExpenseInput = Omit<Expense, "id" | "addedById">;

type GroupsState = {
  groups: Group[];
  currentUserId: string;
  defaultCurrency: CurrencyCode;
  setCurrentUserId: (userId: string) => void;
  setDefaultCurrency: (currency: CurrencyCode) => void;
  createGroup: (input: NewGroupInput) => string;
  addExpense: (groupId: string, input: NewExpenseInput) => string;
  updateExpense: (groupId: string, expenseId: string, input: NewExpenseInput) => void;
  deleteExpense: (groupId: string, expenseId: string) => void;
  recordSettlement: (groupId: string, fromId: string, toId: string, amount: number) => string;
  addPlaceholderMember: (groupId: string, name: string) => void;
  archiveGroup: (groupId: string) => void;
  unarchiveGroup: (groupId: string) => void;
  deleteGroup: (groupId: string) => void;
};

const placeholderColors = ["#E8E5FF", "#FFE3EA", "#E1F0FF", "#FEECD9"];

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function makeInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function makePlaceholder(name: string, index: number): Member {
  return {
    id: makeId("member"),
    name: name.trim(),
    initials: makeInitials(name),
    color: placeholderColors[index % placeholderColors.length],
    isPlaceholder: true,
  };
}

export const useGroupsStore = create<GroupsState>()(
  persist(
    (set, get) => ({
      groups: [],
      currentUserId: "",
      defaultCurrency: "INR",
      setCurrentUserId: (userId) => set({ currentUserId: userId }),
      setDefaultCurrency: (currency) => set({ defaultCurrency: currency }),
      createGroup: ({ name, currency, placeholderNames }) => {
        const groupId = makeId("group");
        const activeUserId = get().currentUserId;
        const owner = seedMembers.find((member) => member.id === activeUserId) ?? seedMembers[0];
        const group: Group = {
          id: groupId,
          name: name.trim(),
          currency: currency ?? get().defaultCurrency ?? "INR",
          inviteCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
          members: [
            owner,
            ...placeholderNames
              .filter((memberName) => memberName.trim())
              .map(makePlaceholder),
          ],
          expenses: [],
        };

        set((state) => ({ groups: [group, ...state.groups] }));
        return groupId;
      },
      addExpense: (groupId, input) => {
        const expenseId = makeId("expense");
        const activeUserId = get().currentUserId;
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  expenses: [
                    ...group.expenses,
                    { ...input, id: expenseId, addedById: activeUserId },
                  ],
                }
              : group,
          ),
        }));
        return expenseId;
      },
      updateExpense: (groupId, expenseId, input) => {
        const activeUserId = get().currentUserId;
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  expenses: group.expenses.map((expense) =>
                    expense.id === expenseId
                      ? {
                          ...expense,
                          ...input,
                          editedAt: new Date().toISOString(),
                          editedById: activeUserId,
                        }
                      : expense,
                  ),
                }
              : group,
          ),
        }));
      },
      deleteExpense: (groupId, expenseId) => {
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  expenses: group.expenses.filter((expense) => expense.id !== expenseId),
                }
              : group,
          ),
        }));
      },
      recordSettlement: (groupId, fromId, toId, amount) => {
        const expenseId = makeId("expense");
        const activeUserId = get().currentUserId;
        set((state) => ({
          groups: state.groups.map((group) => {
            if (group.id !== groupId) return group;
            const fromMember = group.members.find((m) => m.id === fromId);
            const toMember = group.members.find((m) => m.id === toId);
            const settlementExpense: Expense = {
              id: expenseId,
              description: `Settlement: ${fromMember?.name ?? "Member"} paid ${toMember?.name ?? "Member"}`,
              amount,
              paidById: fromId,
              shares: [{ memberId: toId, amount }],
              date: new Date().toISOString(),
              splitMode: "exact",
              addedById: activeUserId,
              isSettlement: true,
            };
            return {
              ...group,
              expenses: [...group.expenses, settlementExpense],
            };
          }),
        }));
        return expenseId;
      },
      addPlaceholderMember: (groupId, name) => {
        if (!name.trim()) return;

        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  members: [...group.members, makePlaceholder(name, group.members.length)],
                }
              : group,
          ),
        }));
      },
      archiveGroup: (groupId) => {
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === groupId ? { ...group, archivedAt: new Date().toISOString() } : group,
          ),
        }));
      },
      unarchiveGroup: (groupId) => {
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === groupId ? { ...group, archivedAt: undefined } : group,
          ),
        }));
      },
      deleteGroup: (groupId) => {
        set((state) => ({ groups: state.groups.filter((group) => group.id !== groupId) }));
      },
    }),
    {
      name: "tripwise-groups",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persisted) => ({
        groups: [],
        currentUserId: "",
        defaultCurrency: (persisted as Partial<GroupsState>).defaultCurrency ?? "INR",
      }),
      partialize: (state) => ({ defaultCurrency: state.defaultCurrency }),
    },
  ),
);
