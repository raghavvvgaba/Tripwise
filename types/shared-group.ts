import type { CurrencyCode } from "@/types/models";

export type SharedGroup = {
  id: string;
  name: string;
  currency: CurrencyCode;
  coverPath: string | null;
  createdAt: string;
  deletedAt: string | null;
};
