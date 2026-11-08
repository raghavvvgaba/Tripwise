-- Run once after 15_payment_reminders.sql.
-- Tiny public function for an uptime monitor (Better Stack) to call once a
-- day so the free-tier Supabase project is not paused for inactivity.
-- It reads no tables and returns no data.
begin;

create or replace function public.ping()
returns text
language sql
stable
security invoker
set search_path = ''
as $$ select 'ok'::text $$;

revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;

commit;
