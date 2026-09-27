import type { CurrencyCode } from "@/types/models";

export type SharedGroup = {
  id: string;
  name: string;
  currency: CurrencyCode;
  createdAt: string;
  archivedAt: string | null;
};
