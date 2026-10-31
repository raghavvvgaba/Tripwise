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
    for (const payer of expense.payers) {
      const member = amounts.get(payer.userId);
      if (member) member.paidMinor += payer.amountMinor;
    }

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

/** A member's net for one expense: what they paid minus their share. */
export function getExpenseNetMinor(expense: SharedExpense, userId: string): number {
  const paidMinor = expense.payers.find((payer) => payer.userId === userId)?.amountMinor ?? 0;
  const shareMinor = expense.shares.find((share) => share.userId === userId)?.amountMinor ?? 0;
  return paidMinor - shareMinor;
}

/** "Alice", "Alice & Bob", or "Alice + 2 others". */
export function formatPayerNames(expense: SharedExpense, nameFor: (userId: string) => string): string {
  const [first, second] = expense.payers.map((payer) => nameFor(payer.userId));
  if (!first) return "A member";
  if (expense.payers.length === 1) return first;
  if (expense.payers.length === 2) return `${first} & ${second}`;
  return `${first} + ${expense.payers.length - 1} others`;
}
