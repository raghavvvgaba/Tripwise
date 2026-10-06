import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createGroupExpense, deleteGroupExpense, updateGroupExpense, type CreateGroupExpenseInput, type UpdateGroupExpenseInput } from "@/lib/expenses";
import { deleteGroupPayment, recordGroupPayment, type RecordPaymentInput } from "@/lib/payments";
import { expenseQueryOptions, expensesQueryOptions, paymentsQueryOptions } from "@/lib/group-data-query";
import { refreshActivity } from "@/lib/refresh-activity";
import { useAuthStore } from "@/store/use-auth-store";
import type { SharedExpense } from "@/types/shared-expense";
import type { SharedPayment } from "@/types/shared-payment";

export function useGroupDataActions(groupId: string) {
  const client = useQueryClient();
  const userId = useAuthStore((state) => state.session?.user.id ?? null);
  const expensesKey = expensesQueryOptions(userId, groupId).queryKey;
  const paymentsKey = paymentsQueryOptions(userId, groupId).queryKey;
  const sameAccount = () => !!userId && useAuthStore.getState().session?.user.id === userId;

  function requireAccess(inputGroupId = groupId) {
    if (!sameAccount()) throw new Error("Sign in required");
    if (!groupId || inputGroupId !== groupId) throw new Error("Invalid group");
  }

  async function refresh(queryKey: readonly (string | null)[]) {
    if (!sameAccount()) return;
    // Do not let a read begun before the write satisfy its refresh.
    await client.cancelQueries({ queryKey });
    if (sameAccount()) await Promise.all([client.invalidateQueries({ queryKey }), refreshActivity(client, userId)]);
  }

  const create = useMutation({
    mutationFn: (input: CreateGroupExpenseInput) => { requireAccess(input.groupId); return createGroupExpense(input); },
    onSuccess: async () => {
      await refresh(expensesKey);
    },
  });
  const update = useMutation({
    mutationFn: (input: UpdateGroupExpenseInput) => { requireAccess(input.groupId); return updateGroupExpense(input); },
    onSuccess: async () => {
      await refresh(expensesKey);
    },
  });
  const removeExpense = useMutation({
    mutationFn: (expenseId: string) => { requireAccess(); return deleteGroupExpense(groupId, expenseId); },
    onSuccess: async (_, expenseId) => {
      if (!sameAccount()) return;
      await client.cancelQueries({ queryKey: expensesKey });
      if (!sameAccount()) return;
      client.setQueryData<SharedExpense[]>(expensesKey, (expenses) => expenses?.filter((expense) => expense.id !== expenseId));
      // Keep a tombstone so a mounted detail screen cannot resurrect a deleted expense.
      client.setQueryData(expenseQueryOptions(userId, groupId, expenseId).queryKey, null);
      await Promise.all([client.invalidateQueries({ queryKey: expensesKey, exact: true }), refreshActivity(client, userId)]);
    },
  });
  const record = useMutation({
    mutationFn: ({ input, allowDuplicate }: { input: RecordPaymentInput; allowDuplicate: boolean }) => {
      requireAccess(input.groupId);
      return recordGroupPayment(input, allowDuplicate);
    },
    onSuccess: async () => {
      await refresh(paymentsKey);
    },
  });
  const removePayment = useMutation({
    mutationFn: (paymentId: string) => { requireAccess(); return deleteGroupPayment(groupId, paymentId); },
    onSuccess: async (_, paymentId) => {
      if (!sameAccount()) return;
      await client.cancelQueries({ queryKey: paymentsKey });
      if (!sameAccount()) return;
      client.setQueryData<SharedPayment[]>(paymentsKey, (payments) => payments?.filter((payment) => payment.id !== paymentId));
      await Promise.all([client.invalidateQueries({ queryKey: paymentsKey }), refreshActivity(client, userId)]);
    },
  });

  return {
    createExpense: create.mutateAsync,
    updateExpense: update.mutateAsync,
    deleteExpense: removeExpense.mutateAsync,
    recordPayment: (input: RecordPaymentInput, allowDuplicate = false) => record.mutateAsync({ input, allowDuplicate }),
    deletePayment: removePayment.mutateAsync,
  };
}
