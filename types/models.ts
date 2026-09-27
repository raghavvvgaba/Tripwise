export type SplitMode = "equal" | "exact";

export type Member = {
  id: string;
  name: string;
  initials: string;
  color: string;
  isPlaceholder?: boolean;
};

export type ExpenseShare = {
  memberId: string;
  amount: number;
};

export type CurrencyCode = "INR" | "USD" | "EUR" | "GBP";

export type Expense = {
  id: string;
  description: string;
  amount: number;
  paidById: string;
  shares: ExpenseShare[];
  date: string;
  note?: string;
  splitMode: SplitMode;
  addedById: string;
  editedAt?: string;
  editedById?: string;
  deletedAt?: string;
  isSettlement?: boolean;
};

export type Group = {
  id: string;
  name: string;
  currency: CurrencyCode;
  members: Member[];
  expenses: Expense[];
  inviteCode: string;
  archivedAt?: string;
};

export type MemberBalance = {
  member: Member;
  paid: number;
  share: number;
  net: number;
};

export type Settlement = {
  from: Member;
  to: Member;
  amount: number;
};
