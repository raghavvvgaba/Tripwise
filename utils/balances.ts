import type { Group, MemberBalance, Settlement } from "@/types/models";
import { roundMoney } from "@/utils/money";

export function getActiveExpenses(group: Group) {
  return group.expenses.filter((expense) => !expense.deletedAt);
}

export function getGroupTotal(group: Group) {
  return roundMoney(
    getActiveExpenses(group).reduce((total, expense) => total + expense.amount, 0),
  );
}

export function getMemberBalances(group: Group): MemberBalance[] {
  const balances = new Map(
    group.members.map((member) => [
      member.id,
      { member, paid: 0, share: 0, net: 0 },
    ]),
  );

  for (const expense of getActiveExpenses(group)) {
    const payer = balances.get(expense.paidById);
    if (payer) payer.paid = roundMoney(payer.paid + expense.amount);

    for (const share of expense.shares) {
      const participant = balances.get(share.memberId);
      if (participant) participant.share = roundMoney(participant.share + share.amount);
    }
  }

  return Array.from(balances.values()).map((balance) => ({
    ...balance,
    net: roundMoney(balance.paid - balance.share),
  }));
}

export function getSettlements(group: Group): Settlement[] {
  const balances = getMemberBalances(group);
  const debtors = balances
    .filter((balance) => balance.net < -0.009)
    .map((balance) => ({ member: balance.member, amount: -balance.net }))
    .sort((a, b) => b.amount - a.amount);
  const creditors = balances
    .filter((balance) => balance.net > 0.009)
    .map((balance) => ({ member: balance.member, amount: balance.net }))
    .sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = roundMoney(Math.min(debtor.amount, creditor.amount));

    if (amount > 0) {
      settlements.push({ from: debtor.member, to: creditor.member, amount });
    }

    debtor.amount = roundMoney(debtor.amount - amount);
    creditor.amount = roundMoney(creditor.amount - amount);

    if (debtor.amount < 0.01) debtorIndex += 1;
    if (creditor.amount < 0.01) creditorIndex += 1;
  }

  return settlements;
}
