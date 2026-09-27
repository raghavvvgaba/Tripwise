import { router } from "expo-router";
import type { ReactNode } from "react";

export function RouteModal({ children }: { title: string; children: (dismiss: () => void) => ReactNode }) {
  return children(() => router.back());
}
