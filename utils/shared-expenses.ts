import type { GroupMember } from "@/lib/group-invites";
import type { SharedExpense } from "@/types/shared-expense";

export type SharedMemberBalance = {
  member: GroupMember;
  paidMinor: number;
  shareMinor: number;
  netMinor: number;
};

export function getSharedMemberBalances(
  members: GroupMember[],
  expenses: SharedExpense[],
): SharedMemberBalance[] {
  const amounts = new Map(members.map((member) => [
    member.userId,
    { member, paidMinor: 0, shareMinor: 0, netMinor: 0 },
  ]));

  for (const expense of expenses) {
    const payer = amounts.get(expense.paidById);
    if (payer) payer.paidMinor += expense.amountMinor;

    for (const share of expense.shares) {
      const participant = amounts.get(share.userId);
      if (participant) participant.shareMinor += share.amountMinor;
    }
  }

  return Array.from(amounts.values()).map((balance) => ({
    ...balance,
    netMinor: balance.paidMinor - balance.shareMinor,
  }));
}
