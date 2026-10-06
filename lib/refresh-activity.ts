import type { QueryClient } from "@tanstack/react-query";

import { activityQueryKey } from "@/lib/activity-query";
import { useAuthStore } from "@/store/use-auth-store";

export async function refreshActivity(client: QueryClient, userId: string | null) {
  const sameAccount = () => !!userId && useAuthStore.getState().session?.user.id === userId;
  if (!sameAccount()) return;
  const queryKey = activityQueryKey(userId);
  await client.cancelQueries({ queryKey });
  if (sameAccount()) await client.invalidateQueries({ queryKey });
}
