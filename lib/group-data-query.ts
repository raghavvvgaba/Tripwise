import { queryOptions } from "@tanstack/react-query";

import { getGroupMembers } from "@/lib/group-invites";
import { getGroupExpense, listGroupExpenses } from "@/lib/expenses";
import { listGroupPayments } from "@/lib/payments";
import type { SharedExpense } from "@/types/shared-expense";

export const groupDataKey = (userId: string | null, groupId: string) => ["group-data", userId, groupId] as const;

export function membersQueryOptions(userId: string | null, groupId: string) {
  return queryOptions({
    queryKey: [...groupDataKey(userId, groupId), "members"],
    queryFn: () => getGroupMembers(groupId),
    enabled: !!userId && !!groupId,
  });
}

export function expensesQueryOptions(userId: string | null, groupId: string) {
  return queryOptions({
    queryKey: [...groupDataKey(userId, groupId), "expenses"],
    queryFn: () => listGroupExpenses(groupId),
    enabled: !!userId && !!groupId,
  });
}

export function paymentsQueryOptions(userId: string | null, groupId: string) {
  return queryOptions({
    queryKey: [...groupDataKey(userId, groupId), "payments"],
    queryFn: () => listGroupPayments(groupId),
    enabled: !!userId && !!groupId,
  });
}

export function expenseQueryOptions(userId: string | null, groupId: string, expenseId: string) {
  return queryOptions({
    queryKey: [...expensesQueryOptions(userId, groupId).queryKey, expenseId],
    queryFn: async (): Promise<SharedExpense | null> => getGroupExpense(groupId, expenseId),
    enabled: !!userId && !!groupId && !!expenseId,
  });
}
