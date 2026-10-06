import { infiniteQueryOptions } from "@tanstack/react-query";

import { listGroupActivity } from "@/lib/activity";

export const activityQueryKey = (userId: string | null) => ["activity", userId] as const;

export function activityQueryOptions(userId: string | null) {
  return infiniteQueryOptions({
    queryKey: activityQueryKey(userId),
    queryFn: ({ pageParam }) => {
      if (!userId) throw new Error("Sign in required");
      return listGroupActivity(pageParam);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _pages, offset) =>
      lastPage.hasMore && lastPage.events.length > 0 ? offset + lastPage.events.length : undefined,
    enabled: !!userId,
    staleTime: 60_000,
  });
}
