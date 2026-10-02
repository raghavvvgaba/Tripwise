import { queryOptions } from "@tanstack/react-query";

import { listGroups } from "@/lib/groups";

export function groupsQueryOptions(userId: string | null) {
  return queryOptions({
    queryKey: ["groups", userId],
    queryFn: () => {
      if (!userId) throw new Error("Sign in required");
      return listGroups(userId);
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}
