import type { GroupMember } from "@/lib/group-invites";
import type { SharedExpense } from "@/types/shared-expense";
import type { SharedPayment } from "@/types/shared-payment";

export type SharedMemberBalance = {
  member: GroupMember;
  paidMinor: number;
  shareMinor: number;
  netMinor: number;
};

export function getSharedMemberBalances(
  members: GroupMember[],
  expenses: SharedExpense[],
  payments: SharedPayment[] = [],
): SharedMemberBalance[] {
  const amounts = new Map(members.map((member) => [
    member.userId,
    { member, paidMinor: 0, shareMinor: 0, paymentNetMinor: 0 },
  ]));

  for (const expense of expenses) {
    const payer = amounts.get(expense.paidById);
    if (payer) payer.paidMinor += expense.amountMinor;

    for (const share of expense.shares) {
      const participant = amounts.get(share.userId);
      if (participant) participant.shareMinor += share.amountMinor;
    }
  }

  for (const payment of payments) {
    const payer = amounts.get(payment.payerId);
    const recipient = amounts.get(payment.recipientId);
    if (payer) payer.paymentNetMinor += payment.amountMinor;
    if (recipient) recipient.paymentNetMinor -= payment.amountMinor;
  }

  return Array.from(amounts.values()).map((balance) => ({
    member: balance.member,
    paidMinor: balance.paidMinor,
    shareMinor: balance.shareMinor,
    netMinor: balance.paidMinor - balance.shareMinor + balance.paymentNetMinor,
  }));
}

export type SharedSettlement = {
  from: GroupMember;
  to: GroupMember;
  amountMinor: number;
};

export function getSharedSettlements(balances: SharedMemberBalance[]): SharedSettlement[] {
  const debtors = balances
    .filter((balance) => balance.netMinor < 0)
    .map((balance) => ({ member: balance.member, amountMinor: -balance.netMinor }))
    .sort((a, b) => b.amountMinor - a.amountMinor || a.member.userId.localeCompare(b.member.userId));
  const creditors = balances
    .filter((balance) => balance.netMinor > 0)
    .map((balance) => ({ member: balance.member, amountMinor: balance.netMinor }))
    .sort((a, b) => b.amountMinor - a.amountMinor || a.member.userId.localeCompare(b.member.userId));

  const settlements: SharedSettlement[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amountMinor = Math.min(debtor.amountMinor, creditor.amountMinor);
    settlements.push({ from: debtor.member, to: creditor.member, amountMinor });
    debtor.amountMinor -= amountMinor;
    creditor.amountMinor -= amountMinor;
    if (debtor.amountMinor === 0) debtorIndex += 1;
    if (creditor.amountMinor === 0) creditorIndex += 1;
  }
  return settlements;
}
