-- Run once after 14_payment_safety.sql.
-- Push tokens for payment reminders, private reminder events in Activity,
-- and a member-only reminder RPC that validates balances and enforces a
-- one-per-day cooldown per (group, debtor, creditor).
begin;

-- Expo push tokens are the delivery address of an app on one device.
-- Tokens stay private: members can only manage their own rows, and the
-- send-payment-reminder Edge Function reads them with the service role.
create table public.push_tokens (
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null check (token <> ''),
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A device token belongs to exactly one user: whoever signed in last.
  primary key (token)
);
create index push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
revoke all on table public.push_tokens from public, anon, authenticated;
grant select, delete on table public.push_tokens to authenticated;

create policy "Users can read their push tokens"
on public.push_tokens for select to authenticated
using (user_id = (select auth.uid()));

create policy "Users can remove their push tokens"
on public.push_tokens for delete to authenticated
using (user_id = (select auth.uid()));

-- Registering claims the token for the caller, removing it from any previous
-- account on this device (e.g. when sign-out cleanup failed while offline).
-- Callers only supply a token their own device produced; RLS cannot express
-- this takeover, so it runs as definer with the caller fixed to auth.uid().
create function public.register_push_token(p_token text, p_platform text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  insert into public.push_tokens (user_id, token, platform)
  values (v_user_id, p_token, p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;
revoke all on function public.register_push_token(text, text) from public, anon, authenticated;
grant execute on function public.register_push_token(text, text) to authenticated;

-- Reminders borrow the payment direction columns: payment_from is the debtor
-- being reminded and payment_to is the creditor who sent the reminder.
-- Only the sender (actor) and the debtor can see reminder events, and like
-- payments they are hidden while the group is deleted.
alter table public.group_activity
  drop constraint group_activity_event_type_check,
  drop constraint group_activity_expense_fields,
  add constraint group_activity_event_type_check check (event_type in (
    'expense_added', 'expense_edited', 'expense_deleted',
    'payment_recorded', 'payment_deleted', 'group_deleted', 'group_restored',
    'reminder_sent'
  )),
  add constraint group_activity_expense_fields check (
    (event_type in ('expense_added', 'expense_edited', 'expense_deleted')
      and description is not null and amount_minor is not null
      and payment_from is null and payment_to is null and payment_date is null)
    or (event_type in ('payment_recorded', 'payment_deleted')
      and expense_id is null and description is null and amount_minor is not null
      and payment_from is not null and payment_to is not null
      and payment_from <> payment_to and payment_date is not null)
    or (event_type = 'reminder_sent'
      and expense_id is null and description is null and amount_minor is not null
      and payment_from is not null and payment_to is not null
      and payment_from <> payment_to and payment_date is null)
    or (event_type in ('group_deleted', 'group_restored')
      and expense_id is null and description is null and amount_minor is null
      and payment_from is null and payment_to is null and payment_date is null)
  );

drop policy "Members can read group activity" on public.group_activity;
create policy "Members can read group activity"
on public.group_activity for select to authenticated
using (
  group_id in (select app_private.user_group_ids())
  and (
    event_type in ('group_deleted', 'group_restored')
    or exists (select 1 from public.groups g where g.id = group_id and g.deleted_at is null)
  )
  and (
    event_type <> 'reminder_sent'
    or actor_id = (select auth.uid())
    or payment_from = (select auth.uid())
  )
);

-- One current attempt per pair. Pending attempts expire if the worker stops;
-- only the service-role finalizer can confirm Expo acceptance or release one.
create table app_private.payment_reminder_attempts (
  group_id uuid not null references public.groups(id) on delete cascade,
  debtor_id uuid not null references auth.users(id) on delete cascade,
  creditor_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null unique default gen_random_uuid(),
  amount_minor bigint not null check (amount_minor > 0),
  reserved_at timestamptz not null default clock_timestamp(),
  sent_at timestamptz,
  primary key (group_id, debtor_id, creditor_id),
  check (debtor_id <> creditor_id)
);
alter table app_private.payment_reminder_attempts enable row level security;
revoke all on app_private.payment_reminder_attempts from public, anon, authenticated;

-- Mirrors the client's getSharedSettlements greedy matching so the reminded
-- amount always equals the settle-up suggestion the sender sees.
create function app_private.send_payment_reminder(p_group_id uuid, p_recipient_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_group_name text;
  v_currency text;
  v_sender_name text;
  v_debtor_ids uuid[];
  v_debtor_net numeric[];
  v_creditor_ids uuid[];
  v_creditor_net numeric[];
  v_i integer := 1;
  v_j integer := 1;
  v_match numeric;
  v_amount_minor bigint;
  v_attempt_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if p_recipient_id is null or p_recipient_id = v_user_id then
    raise exception 'Invalid reminder details' using errcode = '22023';
  end if;

  -- Serialize reminders and wait for concurrent payment or expense changes.
  select g.name, g.currency into v_group_name, v_currency
  from public.groups g
  where g.id = p_group_id and g.deleted_at is null
    and exists (select 1 from public.group_members gm
      where gm.group_id = g.id and gm.user_id = v_user_id)
  for update;
  if not found then
    raise exception 'This group is unavailable for reminders' using errcode = '42501';
  end if;

  if not exists (select 1 from public.group_members gm
      where gm.group_id = p_group_id and gm.user_id = p_recipient_id) then
    raise exception 'This person is not a member of the group' using errcode = '22023';
  end if;

  if exists (
    select 1 from app_private.payment_reminder_attempts a
    where a.group_id = p_group_id
      and a.debtor_id = p_recipient_id and a.creditor_id = v_user_id
      and a.sent_at > pg_catalog.clock_timestamp() - interval '24 hours'
  ) then
    raise exception 'A reminder was already sent to this person today' using errcode = '22023';
  end if;

  if exists (
    select 1 from app_private.payment_reminder_attempts a
    where a.group_id = p_group_id
      and a.debtor_id = p_recipient_id and a.creditor_id = v_user_id
      and a.sent_at is null
      and a.reserved_at > pg_catalog.clock_timestamp() - interval '5 minutes'
  ) then
    raise exception 'A reminder is already being sent to this person' using errcode = '22023';
  end if;

  -- Member nets mirror record_group_payment: paid minus shares plus payments.
  select array_agg(m.user_id order by m.net, m.user_id), array_agg(m.net order by m.net, m.user_id)
  into v_debtor_ids, v_debtor_net
  from (
    select gm.user_id,
      coalesce((select sum(e.amount_minor) from public.expenses e
        where e.group_id = p_group_id and e.paid_by = gm.user_id), 0)
      - coalesce((select sum(s.amount_minor) from public.expense_shares s
        join public.expenses e on e.id = s.expense_id
        where e.group_id = p_group_id and s.user_id = gm.user_id), 0)
      + coalesce((select sum(p.amount_minor) from public.group_payments p
        where p.group_id = p_group_id and p.payer_id = gm.user_id and p.deleted_at is null), 0)
      - coalesce((select sum(p.amount_minor) from public.group_payments p
        where p.group_id = p_group_id and p.recipient_id = gm.user_id and p.deleted_at is null), 0)
      as net
    from public.group_members gm
    where gm.group_id = p_group_id
  ) m
  where m.net < 0;

  select array_agg(m.user_id order by m.net desc, m.user_id), array_agg(m.net order by m.net desc, m.user_id)
  into v_creditor_ids, v_creditor_net
  from (
    select gm.user_id,
      coalesce((select sum(e.amount_minor) from public.expenses e
        where e.group_id = p_group_id and e.paid_by = gm.user_id), 0)
      - coalesce((select sum(s.amount_minor) from public.expense_shares s
        join public.expenses e on e.id = s.expense_id
        where e.group_id = p_group_id and s.user_id = gm.user_id), 0)
      + coalesce((select sum(p.amount_minor) from public.group_payments p
        where p.group_id = p_group_id and p.payer_id = gm.user_id and p.deleted_at is null), 0)
      - coalesce((select sum(p.amount_minor) from public.group_payments p
        where p.group_id = p_group_id and p.recipient_id = gm.user_id and p.deleted_at is null), 0)
      as net
    from public.group_members gm
    where gm.group_id = p_group_id
  ) m
  where m.net > 0;

  -- Largest debt meets largest credit, exactly like the app's settle-up list.
  while v_i <= coalesce(array_length(v_debtor_ids, 1), 0)
    and v_j <= coalesce(array_length(v_creditor_ids, 1), 0) loop
    v_match := least(-v_debtor_net[v_i], v_creditor_net[v_j]);
    if v_debtor_ids[v_i] = p_recipient_id and v_creditor_ids[v_j] = v_user_id then
      v_amount_minor := v_match::bigint;
      exit;
    end if;
    v_debtor_net[v_i] := v_debtor_net[v_i] + v_match;
    v_creditor_net[v_j] := v_creditor_net[v_j] - v_match;
    if v_debtor_net[v_i] = 0 then v_i := v_i + 1; end if;
    if v_creditor_net[v_j] = 0 then v_j := v_j + 1; end if;
  end loop;

  if v_amount_minor is null or v_amount_minor <= 0 then
    raise exception 'This person does not owe you money right now' using errcode = '22023';
  end if;

  insert into app_private.payment_reminder_attempts
    (group_id, debtor_id, creditor_id, amount_minor)
  values (p_group_id, p_recipient_id, v_user_id, v_amount_minor)
  on conflict (group_id, debtor_id, creditor_id) do update
    set id = gen_random_uuid(), amount_minor = excluded.amount_minor,
        reserved_at = pg_catalog.clock_timestamp(), sent_at = null
  returning id into v_attempt_id;

  select nullif(pg_catalog.btrim(u.raw_user_meta_data ->> 'name'), '')
  into v_sender_name
  from auth.users u
  where u.id = v_user_id;

  return jsonb_build_object(
    'attemptId', v_attempt_id,
    'amountMinor', v_amount_minor,
    'groupName', v_group_name,
    'currency', v_currency,
    'senderName', coalesce(v_sender_name, 'Someone')
  );
end;
$$;

create function public.send_payment_reminder(p_group_id uuid, p_recipient_id uuid)
returns jsonb language sql volatile security invoker set search_path = ''
as $$ select app_private.send_payment_reminder(p_group_id, p_recipient_id); $$;

revoke all on function app_private.send_payment_reminder(uuid, uuid) from public, anon, authenticated;
revoke all on function public.send_payment_reminder(uuid, uuid) from public, anon, authenticated;
grant execute on function app_private.send_payment_reminder(uuid, uuid) to authenticated;
grant execute on function public.send_payment_reminder(uuid, uuid) to authenticated;

-- The caller must never be allowed to mark an attempt sent or bypass cooldown
-- by releasing it. The Edge Function calls this with its service-role client.
create function public.finish_payment_reminder(p_attempt_id uuid, p_sent boolean)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_group_id uuid;
  v_attempt app_private.payment_reminder_attempts%rowtype;
begin
  if p_sent is null then
    raise exception 'Invalid reminder result' using errcode = '22023';
  end if;
  select group_id into v_group_id from app_private.payment_reminder_attempts where id = p_attempt_id;
  if not found then return false; end if;
  -- Match the reservation's group-first lock order, then recheck the attempt ID.
  perform 1 from public.groups where id = v_group_id for update;
  select * into v_attempt from app_private.payment_reminder_attempts where id = p_attempt_id for update;
  if not found then return false; end if;
  if v_attempt.sent_at is not null then return p_sent; end if;
  if not p_sent then
    delete from app_private.payment_reminder_attempts where id = p_attempt_id;
    return true;
  end if;
  update app_private.payment_reminder_attempts
    set sent_at = pg_catalog.clock_timestamp() where id = p_attempt_id;
  insert into public.group_activity
    (group_id, actor_id, event_type, amount_minor, payment_from, payment_to)
  values (v_attempt.group_id, v_attempt.creditor_id, 'reminder_sent',
    v_attempt.amount_minor, v_attempt.debtor_id, v_attempt.creditor_id);
  return true;
end;
$$;
revoke all on function public.finish_payment_reminder(uuid, boolean) from public, anon, authenticated;
grant execute on function public.finish_payment_reminder(uuid, boolean) to service_role;

commit;
