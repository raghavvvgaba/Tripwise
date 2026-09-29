import { supabase } from "@/lib/supabase";
import type { SharedPayment } from "@/types/shared-payment";

type PaymentRow = {
  id: string;
  group_id: string;
  payer_id: string;
  recipient_id: string;
  amount_minor: number;
  payment_date: string;
  recorded_by: string;
  created_at: string;
};

export async function listGroupPayments(groupId: string): Promise<SharedPayment[]> {
  const { data, error } = await supabase
    .from("group_payments")
    .select("id, group_id, payer_id, recipient_id, amount_minor, payment_date, recorded_by, created_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .overrideTypes<PaymentRow[], { merge: false }>();

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    groupId: row.group_id,
    payerId: row.payer_id,
    recipientId: row.recipient_id,
    amountMinor: row.amount_minor,
    paymentDate: row.payment_date,
    recordedById: row.recorded_by,
    createdAt: row.created_at,
  }));
}

export async function recordGroupPayment(
  groupId: string,
  payerId: string,
  recipientId: string,
  amountMinor: number,
  paymentDate: string,
  timezoneOffsetMinutes: number,
): Promise<void> {
  const { error } = await supabase.rpc("record_group_payment", {
    p_group_id: groupId,
    p_payer_id: payerId,
    p_recipient_id: recipientId,
    p_amount_minor: amountMinor,
    p_payment_date: paymentDate,
    p_timezone_offset_minutes: timezoneOffsetMinutes,
  });
  if (error) throw error;
}
