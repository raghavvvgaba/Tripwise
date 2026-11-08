-- Run once after 16_keep_alive_ping.sql.
-- The send-payment-reminder Edge Function reads a debtor's push tokens and
-- prunes dead ones with the service role, which 15 did not grant.
grant select, delete on table public.push_tokens to service_role;
