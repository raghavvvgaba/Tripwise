export type SharedExpenseShare = {
  userId: string;
  amountMinor: number;
};

export type SharedExpensePayer = {
  userId: string;
  amountMinor: number;
};

export type SharedExpense = {
  id: string;
  groupId: string;
  description: string;
  amountMinor: number;
  payers: SharedExpensePayer[];
  splitMode: "equal" | "exact";
  expenseDate: string;
  note: string | null;
  createdById: string;
  createdAt: string;
  updatedById: string | null;
  updatedAt: string | null;
  shares: SharedExpenseShare[];
};
