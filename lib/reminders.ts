import { supabase } from "@/lib/supabase";

export class ReminderError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "ReminderError";
  }
}

/**
 * Asks the send-payment-reminder Edge Function to notify a group member who
 * owes the signed-in user money. The server validates membership, balances,
 * and the daily cooldown before delivering the push.
 */
export async function sendPaymentReminder(groupId: string, recipientId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) throw new ReminderError("Please sign in again to continue.", "signed_out");

  let response: Response;
  try {
    response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-payment-reminder`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ groupId, recipientId }),
    });
  } catch {
    throw new ReminderError("We couldn't connect. Check your internet connection and try again.", "network");
  }

  if (response.ok) return;

  let payload: { error?: string; message?: string | null } = {};
  try {
    payload = await response.json() as typeof payload;
  } catch {
    // Fall through to the generic error below.
  }
  if (payload.error === "no_push_tokens") {
    throw new ReminderError("This person hasn't enabled notifications yet.", "no_push_tokens");
  }
  if (payload.message) {
    // Known server messages (cooldown, balances, membership) are mapped to
    // friendly text by friendlyErrorMessage at display time.
    throw new ReminderError(payload.message, "reminder_rejected");
  }
  throw new ReminderError("Something went wrong. Please try again.", "unknown");
}
