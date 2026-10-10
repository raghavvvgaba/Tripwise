import { QueryClient } from "@tanstack/react-query";

export const OFFLINE_CACHE_MAX_AGE = 24 * 60 * 60_000;

export function createQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 30 * 60_000,
        retry: 1,
      },
    },
  });
  client.setQueryDefaults(["groups"], { gcTime: OFFLINE_CACHE_MAX_AGE });
  client.setQueryDefaults(["group-data"], { gcTime: OFFLINE_CACHE_MAX_AGE });
  return client;
}
