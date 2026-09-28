import { supabase } from "@/lib/supabase";
import type { CurrencyCode } from "@/types/models";

const INVITE_CODE_PATTERN = /^[A-Z]{8}$/;

export function normalizeInviteCode(value: string): string {
  return value.trim().toUpperCase();
}

export type InvitePreview = {
  groupId: string;
  name: string;
  currency: CurrencyCode;
  memberCount: number;
};

type InvitePreviewRow = {
  group_id: string;
  group_name: string;
  group_currency: string;
  member_count: number;
};

export function isInviteCode(value: unknown): value is string {
  return typeof value === "string" && INVITE_CODE_PATTERN.test(normalizeInviteCode(value));
}

export async function getGroupInvite(groupId: string): Promise<{ name: string; code: string }> {
  const { data, error } = await supabase
    .from("groups")
    .select("name, invite_code")
    .eq("id", groupId)
    .single();

  if (error) throw error;
  return { name: data.name, code: data.invite_code };
}

export async function previewGroupInvite(code: string): Promise<InvitePreview | null> {
  if (!isInviteCode(code)) return null;

  const { data, error } = await supabase
    .rpc("preview_group_invite", { p_code: normalizeInviteCode(code) })
    .maybeSingle()
    .overrideTypes<InvitePreviewRow | null, { merge: false }>();

  if (error) throw error;
  if (!data) return null;

  return {
    groupId: data.group_id,
    name: data.group_name,
    currency: data.group_currency as CurrencyCode,
    memberCount: data.member_count,
  };
}

export async function acceptGroupInvite(code: string): Promise<string> {
  if (!isInviteCode(code)) throw new Error("This invite code is invalid.");

  const { data, error } = await supabase.rpc("accept_group_invite", { p_code: normalizeInviteCode(code) });
  if (error) throw error;
  if (!data) throw new Error("This invite code is invalid.");
  return data;
}

export async function getGroupMemberCount(groupId: string): Promise<number> {
  const { data, error } = await supabase.rpc("group_member_count", { p_group_id: groupId });
  if (error) throw error;
  if (data === null) throw new Error("Group membership is unavailable.");
  return data;
}
