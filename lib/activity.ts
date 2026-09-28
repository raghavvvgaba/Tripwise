import { supabase } from "@/lib/supabase";

export type GroupActivityEvent = {
  id: string;
  groupId: string;
  actorId: string;
  eventType: "expense_added" | "group_deleted" | "group_restored";
  expenseId: string | null;
  description: string | null;
  amountMinor: number | null;
  createdAt: string;
};

type GroupActivityRow = {
  id: string;
  group_id: string;
  actor_id: string;
  event_type: GroupActivityEvent["eventType"];
  expense_id: string | null;
  description: string | null;
  amount_minor: number | null;
  created_at: string;
};

export async function listGroupActivity(offset: number): Promise<{ events: GroupActivityEvent[]; hasMore: boolean }> {
  const pageSize = 20;
  const { data, error, count } = await supabase
    .from("group_activity")
    .select("id, group_id, actor_id, event_type, expense_id, description, amount_minor, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + pageSize - 1)
    .overrideTypes<GroupActivityRow[], { merge: false }>();

  if (error) throw error;
  const rows = data ?? [];
  return {
    events: rows.map((row) => ({
      id: row.id,
      groupId: row.group_id,
      actorId: row.actor_id,
      eventType: row.event_type,
      expenseId: row.expense_id,
      description: row.description,
      amountMinor: row.amount_minor,
      createdAt: row.created_at,
    })),
    hasMore: count !== null && offset + rows.length < count,
  };
}
