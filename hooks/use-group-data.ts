import { useQuery, useQueryClient, type QueryKey, type UseQueryOptions } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

import { expenseQueryOptions, expensesQueryOptions, membersQueryOptions, paymentsQueryOptions } from "@/lib/group-data-query";
import { queryErrorMessage } from "@/lib/query-error";
import { useAuthStore } from "@/store/use-auth-store";
import type { SharedExpense } from "@/types/shared-expense";

function useCachedGroupQuery<T, K extends QueryKey>(options: UseQueryOptions<T, Error, T, K>, enabled = true) {
  const client = useQueryClient();
  const canLoad = enabled && options.enabled === true;
  const query = useQuery({ ...options, enabled: canLoad });
  const key = JSON.stringify(options.queryKey);

  useFocusEffect(useCallback(() => {
    if (!canLoad) return;
    void client.refetchQueries({ queryKey: JSON.parse(key), exact: true, stale: true, type: "active" }, { cancelRefetch: false });
  }, [client, key, canLoad]));

  const errorMessage = queryErrorMessage(query.error, query.data !== undefined,
    canLoad && query.fetchStatus === "paused");
  return { ...query, errorMessage };
}

export function useGroupMembers(groupId: string, enabled = true) {
  const userId = useAuthStore((state) => state.session?.user.id ?? null);
  return useCachedGroupQuery(membersQueryOptions(userId, groupId), enabled);
}

export function useGroupExpenses(groupId: string, enabled = true) {
  const userId = useAuthStore((state) => state.session?.user.id ?? null);
  return useCachedGroupQuery(expensesQueryOptions(userId, groupId), enabled);
}

export function useGroupPayments(groupId: string, enabled = true) {
  const userId = useAuthStore((state) => state.session?.user.id ?? null);
  return useCachedGroupQuery(paymentsQueryOptions(userId, groupId), enabled);
}

export function useGroupExpense(groupId: string, expenseId: string) {
  const userId = useAuthStore((state) => state.session?.user.id ?? null);
  const client = useQueryClient();
  const listKey = expensesQueryOptions(userId, groupId).queryKey;
  const listState = client.getQueryState<SharedExpense[]>(listKey);
  const cachedExpense = listState?.data?.find((expense) => expense.id === expenseId);
  return useCachedGroupQuery({
    ...expenseQueryOptions(userId, groupId, expenseId),
    // Invalidation means refresh is needed; the saved result is still usable offline.
    ...(listState?.isInvalidated ? { staleTime: 0 } : {}),
    initialData: cachedExpense,
    initialDataUpdatedAt: cachedExpense ? listState?.dataUpdatedAt : undefined,
  });
}
