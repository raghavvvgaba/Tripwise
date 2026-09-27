import { supabase } from "@/lib/supabase";
import type { CurrencyCode } from "@/types/models";
import type { SharedGroup } from "@/types/shared-group";

export async function listGroups(userId: string): Promise<SharedGroup[]> {
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, currency, created_at, group_members!inner(archived_at, joined_at)")
    .eq("group_members.user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((group) => ({
    id: group.id,
    name: group.name,
    currency: group.currency as CurrencyCode,
    createdAt: group.created_at,
    archivedAt: group.group_members[0]?.archived_at ?? null,
  }));
}

export async function createGroup(name: string, currency: CurrencyCode): Promise<SharedGroup> {
  const { data, error } = await supabase
    .from("groups")
    .insert({ name: name.trim(), currency })
    .select("id, name, currency, created_at")
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    currency: data.currency as CurrencyCode,
    createdAt: data.created_at,
    archivedAt: null,
  };
}

export async function setGroupArchived(
  userId: string,
  groupId: string,
  archived: boolean,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("group_members")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("user_id", userId)
    .eq("group_id", groupId)
    .select("archived_at")
    .single();

  if (error) throw error;
  return data.archived_at;
}
