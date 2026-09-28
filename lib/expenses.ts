import { supabase } from "@/lib/supabase";
import type { SharedExpense } from "@/types/shared-expense";

type ExpenseRow = {
  id: string;
  group_id: string;
  description: string;
  amount_minor: number;
  paid_by: string;
  split_mode: "equal" | "exact";
  expense_date: string;
  note: string | null;
  created_by: string;
  created_at: string;
  expense_shares: { user_id: string; amount_minor: number }[];
};

const EXPENSE_SELECT = "id, group_id, description, amount_minor, paid_by, split_mode, expense_date, note, created_by, created_at, expense_shares(user_id, amount_minor)";

function toExpense(row: ExpenseRow): SharedExpense {
  return {
    id: row.id,
    groupId: row.group_id,
    description: row.description,
    amountMinor: row.amount_minor,
    paidById: row.paid_by,
    splitMode: row.split_mode,
    expenseDate: row.expense_date,
    note: row.note,
    createdById: row.created_by,
    createdAt: row.created_at,
    shares: row.expense_shares.map((share) => ({
      userId: share.user_id,
      amountMinor: share.amount_minor,
    })),
  };
}

export async function listGroupExpenses(groupId: string): Promise<SharedExpense[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select(EXPENSE_SELECT)
    .eq("group_id", groupId)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .overrideTypes<ExpenseRow[], { merge: false }>();

  if (error) throw error;
  return (data ?? []).map(toExpense);
}

export async function getGroupExpense(groupId: string, expenseId: string): Promise<SharedExpense> {
  const { data, error } = await supabase
    .from("expenses")
    .select(EXPENSE_SELECT)
    .eq("group_id", groupId)
    .eq("id", expenseId)
    .single()
    .overrideTypes<ExpenseRow, { merge: false }>();

  if (error) throw error;
  return toExpense(data);
}

export type CreateGroupExpenseInput = {
  groupId: string;
  description: string;
  amountMinor: number;
  paidById: string;
  memberIds: string[];
  splitMode: "equal" | "exact";
  expenseDate: string;
  exactAmountsMinor: number[] | null;
  note: string;
};

export async function createGroupExpense(input: CreateGroupExpenseInput): Promise<string> {
  const { data, error } = await supabase.rpc("create_group_expense", {
    p_group_id: input.groupId,
    p_description: input.description,
    p_amount_minor: input.amountMinor,
    p_paid_by: input.paidById,
    p_member_ids: input.memberIds,
    p_split_mode: input.splitMode,
    p_expense_date: input.expenseDate,
    p_exact_amounts_minor: input.exactAmountsMinor,
    p_note: input.note,
  });

  if (error) throw error;
  if (typeof data !== "string") throw new Error("The expense could not be saved.");
  return data;
}
