export type SharedExpenseShare = {
  userId: string;
  amountMinor: number;
};

export type SharedExpense = {
  id: string;
  groupId: string;
  description: string;
  amountMinor: number;
  paidById: string;
  splitMode: "equal" | "exact";
  expenseDate: string;
  note: string | null;
  createdById: string;
  createdAt: string;
  shares: SharedExpenseShare[];
};
