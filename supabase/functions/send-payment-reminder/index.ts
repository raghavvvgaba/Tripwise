// Supabase Edge Function: sends an Expo push notification for a payment reminder.
//
// Deploy from the repo root with:
//   supabase functions deploy send-payment-reminder
//
// Uses the platform's built-in SUPABASE_URL, SUPABASE_ANON_KEY, and
// SUPABASE_SERVICE_ROLE_KEY secrets; no extra secrets are required.
//
// Flow: verify the caller's JWT, check the recipient has registered push
// tokens, run the member-only send_payment_reminder RPC as the caller
// (balance + cooldown checks happen in Postgres), then send through Expo.
// Only an accepted push is finalized as sent and added to Activity.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CURRENCY_SYMBOLS: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };

type Reminder = {
  attemptId: string;
  amountMinor: number;
  groupName: string;
  currency: string;
  senderName: string;
};

type PushTicket = {
  status: "ok" | "error";
  details?: { error?: string };
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "post, options",
    },
  });
}

function formatMoney(amountMinor: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? "";
  const major = amountMinor / 100;
  return `${symbol}${Number.isInteger(major) ? major : major.toFixed(2)}`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json({}, 200);
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) return json({ error: "unauthorized" }, 401);

  let body: { groupId?: unknown; recipientId?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  const groupId = typeof body.groupId === "string" ? body.groupId : "";
  const recipientId = typeof body.recipientId === "string" ? body.recipientId : "";
  if (!UUID.test(groupId) || !UUID.test(recipientId)) {
    return json({ error: "invalid_body" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: { user }, error: authError } = await admin.auth.getUser(accessToken);
  if (authError || !user) return json({ error: "unauthorized" }, 401);

  // Tokens stay private: only the service role can read them.
  const { data: tokens, error: tokenError } = await admin
    .from("push_tokens")
    .select("token")
    .eq("user_id", recipientId);
  if (tokenError) {
    console.error("Push token lookup failed:", tokenError);
    return json({ error: "token_lookup_failed" }, 500);
  }
  if (!tokens || tokens.length === 0) return json({ error: "no_push_tokens" }, 409);

  // The RPC's permission, membership, balance, and cooldown checks must run
  // as the calling user, so its client forwards the caller's JWT.
  const caller = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: reminder, error: rpcError } = await caller.rpc("send_payment_reminder", {
    p_group_id: groupId,
    p_recipient_id: recipientId,
  });
  if (rpcError || !reminder) {
    return json({ error: "reminder_rejected", message: rpcError?.message ?? null }, 409);
  }
  const details = reminder as Reminder;

  // Finalization is idempotent: retry once if its database response is lost.
  async function finish(sent: boolean): Promise<boolean> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const { data, error } = await admin.rpc("finish_payment_reminder", {
          p_attempt_id: details.attemptId,
          p_sent: sent,
        });
        if (!error) return data === true;
        console.error("Reminder finalization failed:", error);
      } catch (error) {
        console.error("Reminder finalization failed:", error);
      }
    }
    return false;
  }

  let tickets: PushTicket[];
  try {
    const push = await fetch(PUSH_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify([{
        to: tokens.map((row) => row.token),
        title: `${details.groupName} · Payment reminder`,
        body: `You owe ${formatMoney(details.amountMinor, details.currency)} to ${details.senderName} in ${details.groupName}.`,
        sound: "default",
        // Android: use the app's "Payment reminders" channel (created on sign-in).
        channelId: "default",
        data: { groupId },
      }]),
    });
    if (!push.ok) throw new Error(`Expo push HTTP ${push.status}`);
    const payload = await push.json();
    if (!Array.isArray(payload.data)) throw new Error("Invalid Expo push response");
    tickets = payload.data;
  } catch (error) {
    console.error("Reminder push failed:", error);
    await finish(false);
    return json({ error: "push_failed" }, 502);
  }

  let accepted = 0;
  const staleTokens: string[] = [];
  tickets.forEach((ticket, index) => {
    if (ticket?.status === "ok") {
      accepted += 1;
    } else if (ticket?.details?.error === "DeviceNotRegistered" && tokens[index]) {
      staleTokens.push(tokens[index].token);
    }
  });
  if (accepted === 0) {
    await finish(false);
  } else if (!await finish(true)) {
    // Do not release an accepted push on a database failure: retain its lease.
    return json({ error: "reminder_finalize_failed" }, 503);
  }
  if (staleTokens.length > 0) {
    try {
      await admin.from("push_tokens").delete().in("token", staleTokens);
    } catch (error) {
      console.error("Stale push token cleanup failed:", error);
    }
  }
  if (accepted === 0) return json({ error: "push_failed" }, 502);

  return json({ ok: true });
});
