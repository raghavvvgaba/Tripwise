import { supabase } from "@/lib/supabase";
import type { CurrencyCode } from "@/types/models";
import type { SharedGroup } from "@/types/shared-group";

export async function listGroups(userId: string): Promise<SharedGroup[]> {
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, currency, created_at, deleted_at, group_members!inner(user_id)")
    .eq("group_members.user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((group) => ({
    id: group.id,
    name: group.name,
    currency: group.currency as CurrencyCode,
    createdAt: group.created_at,
    deletedAt: group.deleted_at,
  }));
}

export async function createGroup(name: string, currency: CurrencyCode): Promise<SharedGroup> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase
      .from("groups")
      .insert({ name: name.trim(), currency })
      .select("id, name, currency, created_at, deleted_at")
      .single();

    if (!error) {
      return {
        id: data.id,
        name: data.name,
        currency: data.currency as CurrencyCode,
        createdAt: data.created_at,
        deletedAt: data.deleted_at,
      };
    }
    if (error.code !== "23505" || !error.message.includes("groups_invite_code_key") || attempt === 2) {
      throw error;
    }
  }

  throw new Error("Could not create a unique invite code.");
}

export async function deleteSharedGroup(groupId: string): Promise<string> {
  const { data, error } = await supabase.rpc("delete_group", { p_group_id: groupId });
  if (error) throw error;
  if (typeof data !== "string") throw new Error("The group could not be deleted.");
  return data;
}

export async function restoreSharedGroup(groupId: string): Promise<void> {
  const { error } = await supabase.rpc("restore_group", { p_group_id: groupId });
  if (error) throw error;
}
