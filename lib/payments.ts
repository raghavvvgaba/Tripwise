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
    .is("deleted_at", null)
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

export type RecordPaymentInput = {
  groupId: string;
  payerId: string;
  recipientId: string;
  amountMinor: number;
  paymentDate: string;
  timezoneOffsetMinutes: number;
  requestId: string;
};

export class PaymentError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "PaymentError";
  }
}

export function createPaymentRequestId(): string {
  // Supabase's existing get-random-values polyfill supports native and web.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function recordGroupPayment(input: RecordPaymentInput, allowDuplicate = false): Promise<void> {
  const { error } = await supabase.rpc("record_group_payment", {
    p_group_id: input.groupId,
    p_payer_id: input.payerId,
    p_recipient_id: input.recipientId,
    p_amount_minor: input.amountMinor,
    p_payment_date: input.paymentDate,
    p_timezone_offset_minutes: input.timezoneOffsetMinutes,
    p_request_id: input.requestId,
    p_allow_duplicate: allowDuplicate,
  });
  if (error) throw new PaymentError(error.message, error.code);
}

export async function deleteGroupPayment(groupId: string, paymentId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_group_payment", {
    p_group_id: groupId,
    p_payment_id: paymentId,
  });
  if (error) throw new PaymentError(error.message, error.code);
}
