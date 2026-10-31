-- Run once after 14_payment_safety.sql.
-- Lets several members pay one expense. Each payer's amount is stored in
-- expense_payers and replaces the single expenses.paid_by column.
-- app_private must not be exposed through the Data API.
begin;

create table public.expense_payers (
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  primary key (expense_id, user_id)
);

alter table public.expense_payers enable row level security;
revoke all on public.expense_payers from public, anon, authenticated;
grant select on public.expense_payers to authenticated;

create policy "Members can read expense payers"
on public.expense_payers for select to authenticated
using (
  exists (
    select 1 from public.expenses e
    where e.id = expense_id
      and e.group_id in (select app_private.user_group_ids())
  )
);

-- Every existing expense was paid in full by one member.
insert into public.expense_payers (expense_id, user_id, amount_minor)
select e.id, e.paid_by, e.amount_minor from public.expenses e;

-- Old add/edit signatures take a single payer; remove them before the column.
drop function public.create_group_expense(uuid, text, bigint, uuid, uuid[], text, date, bigint[], text);
drop function app_private.create_group_expense(uuid, text, bigint, uuid, uuid[], text, date, bigint[], text);
drop function public.update_group_expense(uuid, uuid, text, bigint, uuid, uuid[], text, bigint[], text, timestamptz);
drop function app_private.update_group_expense(uuid, uuid, text, bigint, uuid, uuid[], text, bigint[], text, timestamptz);

alter table public.expenses drop column paid_by;

-- A member's balance: paid for expenses - their shares + payments sent - payments received.
create function app_private.group_member_net(p_group_id uuid, p_user_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((select sum(ep.amount_minor) from public.expense_payers ep
      join public.expenses e on e.id = ep.expense_id
      where e.group_id = p_group_id and ep.user_id = p_user_id), 0)
    - coalesce((select sum(s.amount_minor) from public.expense_shares s
      join public.expenses e on e.id = s.expense_id
      where e.group_id = p_group_id and s.user_id = p_user_id), 0)
    + coalesce((select sum(p.amount_minor) from public.group_payments p
      where p.group_id = p_group_id and p.payer_id = p_user_id and p.deleted_at is null), 0)
    - coalesce((select sum(p.amount_minor) from public.group_payments p
      where p.group_id = p_group_id and p.recipient_id = p_user_id and p.deleted_at is null), 0);
$$;

revoke all on function app_private.group_member_net(uuid, uuid) from public, anon, authenticated;

-- Shared validation for the payer list; raises on any problem.
create function app_private.check_expense_payers(
  p_group_id uuid,
  p_amount_minor bigint,
  p_payer_ids uuid[],
  p_payer_amounts_minor bigint[]
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_payer_count integer := pg_catalog.cardinality(p_payer_ids);
  v_seen_ids uuid[] := array[]::uuid[];
  v_total numeric := 0;
begin
  if v_payer_count is null or v_payer_count = 0 then
    raise exception 'Choose who paid' using errcode = '22023';
  end if;
  if p_payer_amounts_minor is null or pg_catalog.cardinality(p_payer_amounts_minor) <> v_payer_count then
    raise exception 'Invalid payer amounts' using errcode = '22023';
  end if;

  for i in 1..v_payer_count loop
    if p_payer_ids[i] is null or p_payer_ids[i] = any(v_seen_ids) then
      raise exception 'Payers must be unique group members' using errcode = '22023';
    end if;
    v_seen_ids := pg_catalog.array_append(v_seen_ids, p_payer_ids[i]);

    if not exists (
      select 1 from public.group_members gm
      where gm.group_id = p_group_id and gm.user_id = p_payer_ids[i]
    ) then
      raise exception 'Payer must belong to the group' using errcode = '22023';
    end if;

    if p_payer_amounts_minor[i] is null or p_payer_amounts_minor[i] <= 0 then
      raise exception 'Each payer amount must be more than zero' using errcode = '22023';
    end if;
    v_total := v_total + p_payer_amounts_minor[i];
  end loop;

  if v_total <> p_amount_minor then
    raise exception 'Paid amounts must add up to the expense total' using errcode = '22023';
  end if;
end;
$$;

revoke all on function app_private.check_expense_payers(uuid, bigint, uuid[], bigint[]) from public, anon, authenticated;

create function app_private.create_group_expense(
  p_group_id uuid,
  p_description text,
  p_amount_minor bigint,
  p_payer_ids uuid[],
  p_payer_amounts_minor bigint[],
  p_member_ids uuid[],
  p_split_mode text,
  p_expense_date date,
  p_exact_amounts_minor bigint[],
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_expense_id uuid;
  v_member_count integer;
  v_seen_ids uuid[] := array[]::uuid[];
  v_exact_total numeric := 0;
  v_share_amount bigint;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = v_user_id
  ) then
    raise exception 'This group is unavailable for adding expenses' using errcode = '42501';
  end if;

  if p_description is null or pg_catalog.length(pg_catalog.btrim(p_description)) not between 1 and 120
    or p_amount_minor is null or p_amount_minor <= 0
    or p_expense_date is null
    or (p_split_mode is distinct from 'equal' and p_split_mode is distinct from 'exact')
    or (p_note is not null and pg_catalog.length(p_note) > 2000) then
    raise exception 'Invalid expense details' using errcode = '22023';
  end if;

  perform app_private.check_expense_payers(p_group_id, p_amount_minor, p_payer_ids, p_payer_amounts_minor);

  v_member_count := pg_catalog.cardinality(p_member_ids);
  if v_member_count is null or v_member_count = 0 then
    raise exception 'Choose at least one participant' using errcode = '22023';
  end if;

  if (p_split_mode = 'equal' and p_exact_amounts_minor is not null)
    or (p_split_mode = 'exact' and (
      p_exact_amounts_minor is null
      or pg_catalog.cardinality(p_exact_amounts_minor) <> v_member_count
    )) then
    raise exception 'Invalid split amounts' using errcode = '22023';
  end if;

  for i in 1..v_member_count loop
    if p_member_ids[i] is null or p_member_ids[i] = any(v_seen_ids) then
      raise exception 'Participants must be unique group members' using errcode = '22023';
    end if;
    v_seen_ids := pg_catalog.array_append(v_seen_ids, p_member_ids[i]);

    if not exists (
      select 1 from public.group_members gm
      where gm.group_id = p_group_id and gm.user_id = p_member_ids[i]
    ) then
      raise exception 'Participants must belong to the group' using errcode = '22023';
    end if;

    if p_split_mode = 'exact' then
      if p_exact_amounts_minor[i] is null or p_exact_amounts_minor[i] < 0 then
        raise exception 'Split amounts cannot be negative' using errcode = '22023';
      end if;
      v_exact_total := v_exact_total + p_exact_amounts_minor[i];
    end if;
  end loop;

  if p_split_mode = 'exact' and v_exact_total <> p_amount_minor then
    raise exception 'Split amounts must add up to the expense total' using errcode = '22023';
  end if;

  insert into public.expenses (
    group_id, description, amount_minor, split_mode,
    expense_date, note, created_by
  ) values (
    p_group_id, pg_catalog.btrim(p_description), p_amount_minor,
    p_split_mode, p_expense_date, nullif(pg_catalog.btrim(p_note), ''), v_user_id
  ) returning id into v_expense_id;

  insert into public.expense_payers (expense_id, user_id, amount_minor)
  select v_expense_id, payer.user_id, payer.amount_minor
  from unnest(p_payer_ids, p_payer_amounts_minor) as payer(user_id, amount_minor);

  for i in 1..v_member_count loop
    if p_split_mode = 'equal' then
      v_share_amount := p_amount_minor / v_member_count::bigint
        + case when i <= p_amount_minor % v_member_count::bigint then 1 else 0 end;
    else
      v_share_amount := p_exact_amounts_minor[i];
    end if;

    insert into public.expense_shares (expense_id, user_id, amount_minor)
    values (v_expense_id, p_member_ids[i], v_share_amount);
  end loop;

  return v_expense_id;
end;
$$;

create function public.create_group_expense(
  p_group_id uuid,
  p_description text,
  p_amount_minor bigint,
  p_payer_ids uuid[],
  p_payer_amounts_minor bigint[],
  p_member_ids uuid[],
  p_split_mode text,
  p_expense_date date,
  p_exact_amounts_minor bigint[],
  p_note text
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select app_private.create_group_expense(
    p_group_id, p_description, p_amount_minor, p_payer_ids, p_payer_amounts_minor,
    p_member_ids, p_split_mode, p_expense_date, p_exact_amounts_minor, p_note
  );
$$;

create function app_private.update_group_expense(
  p_group_id uuid,
  p_expense_id uuid,
  p_description text,
  p_amount_minor bigint,
  p_payer_ids uuid[],
  p_payer_amounts_minor bigint[],
  p_member_ids uuid[],
  p_split_mode text,
  p_exact_amounts_minor bigint[],
  p_note text,
  p_expected_updated_at timestamptz
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated_at timestamptz;
  v_member_count integer;
  v_seen_ids uuid[] := array[]::uuid[];
  v_exact_total numeric := 0;
  v_share_amount bigint;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  -- Lock the group first, matching the group deletion lock order.
  perform 1 from public.groups g
  where g.id = p_group_id and g.deleted_at is null
    and exists (
      select 1 from public.group_members gm
      where gm.group_id = g.id and gm.user_id = v_user_id
    )
  for share;
  if not found then
    raise exception 'This group is unavailable for editing expenses' using errcode = '42501';
  end if;

  select e.updated_at into v_updated_at
  from public.expenses e
  where e.id = p_expense_id and e.group_id = p_group_id
  for update;
  if not found then
    raise exception 'Expense not found' using errcode = '22023';
  end if;
  if v_updated_at is distinct from p_expected_updated_at then
    raise exception 'This expense changed since you opened it. Reopen it and try again.' using errcode = '40001';
  end if;

  if p_description is null or pg_catalog.length(pg_catalog.btrim(p_description)) not between 1 and 120
    or p_amount_minor is null or p_amount_minor <= 0
    or (p_split_mode is distinct from 'equal' and p_split_mode is distinct from 'exact')
    or (p_note is not null and pg_catalog.length(p_note) > 2000) then
    raise exception 'Invalid expense details' using errcode = '22023';
  end if;

  perform app_private.check_expense_payers(p_group_id, p_amount_minor, p_payer_ids, p_payer_amounts_minor);

  v_member_count := pg_catalog.cardinality(p_member_ids);
  if v_member_count is null or v_member_count = 0 then
    raise exception 'Choose at least one participant' using errcode = '22023';
  end if;
  if (p_split_mode = 'equal' and p_exact_amounts_minor is not null)
    or (p_split_mode = 'exact' and (
      p_exact_amounts_minor is null
      or pg_catalog.cardinality(p_exact_amounts_minor) <> v_member_count
    )) then
    raise exception 'Invalid split amounts' using errcode = '22023';
  end if;

  for i in 1..v_member_count loop
    if p_member_ids[i] is null or p_member_ids[i] = any(v_seen_ids) then
      raise exception 'Participants must be unique group members' using errcode = '22023';
    end if;
    v_seen_ids := pg_catalog.array_append(v_seen_ids, p_member_ids[i]);
    if not exists (
      select 1 from public.group_members gm
      where gm.group_id = p_group_id and gm.user_id = p_member_ids[i]
    ) then
      raise exception 'Participants must belong to the group' using errcode = '22023';
    end if;
    if p_split_mode = 'exact' then
      if p_exact_amounts_minor[i] is null or p_exact_amounts_minor[i] < 0 then
        raise exception 'Split amounts cannot be negative' using errcode = '22023';
      end if;
      v_exact_total := v_exact_total + p_exact_amounts_minor[i];
    end if;
  end loop;

  if p_split_mode = 'exact' and v_exact_total <> p_amount_minor then
    raise exception 'Split amounts must add up to the expense total' using errcode = '22023';
  end if;

  v_updated_at := pg_catalog.clock_timestamp();
  update public.expenses e set
    description = pg_catalog.btrim(p_description),
    amount_minor = p_amount_minor,
    split_mode = p_split_mode,
    note = nullif(pg_catalog.btrim(p_note), ''),
    updated_at = v_updated_at,
    updated_by = v_user_id
  where e.id = p_expense_id;

  delete from public.expense_payers where expense_id = p_expense_id;
  insert into public.expense_payers (expense_id, user_id, amount_minor)
  select p_expense_id, payer.user_id, payer.amount_minor
  from unnest(p_payer_ids, p_payer_amounts_minor) as payer(user_id, amount_minor);

  delete from public.expense_shares where expense_id = p_expense_id;
  for i in 1..v_member_count loop
    if p_split_mode = 'equal' then
      v_share_amount := p_amount_minor / v_member_count::bigint
        + case when i <= p_amount_minor % v_member_count::bigint then 1 else 0 end;
    else
      v_share_amount := p_exact_amounts_minor[i];
    end if;
    insert into public.expense_shares (expense_id, user_id, amount_minor)
    values (p_expense_id, p_member_ids[i], v_share_amount);
  end loop;

  insert into public.group_activity (
    group_id, actor_id, event_type, expense_id, description, amount_minor, created_at
  ) values (
    p_group_id, v_user_id, 'expense_edited', p_expense_id,
    pg_catalog.btrim(p_description), p_amount_minor, v_updated_at
  );

  return v_updated_at;
end;
$$;

create function public.update_group_expense(
  p_group_id uuid,
  p_expense_id uuid,
  p_description text,
  p_amount_minor bigint,
  p_payer_ids uuid[],
  p_payer_amounts_minor bigint[],
  p_member_ids uuid[],
  p_split_mode text,
  p_exact_amounts_minor bigint[],
  p_note text,
  p_expected_updated_at timestamptz
)
returns timestamptz
language sql
volatile
security invoker
set search_path = ''
as $$
  select app_private.update_group_expense(
    p_group_id, p_expense_id, p_description, p_amount_minor, p_payer_ids,
    p_payer_amounts_minor, p_member_ids, p_split_mode, p_exact_amounts_minor,
    p_note, p_expected_updated_at
  );
$$;

-- Same signature and checks as 14_payment_safety.sql; balances now read expense_payers.
create or replace function app_private.record_group_payment(
  p_group_id uuid, p_payer_id uuid, p_recipient_id uuid, p_amount_minor bigint,
  p_payment_date date, p_timezone_offset_minutes integer,
  p_request_id uuid, p_allow_duplicate boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.group_payments%rowtype;
  v_payer_net numeric;
  v_recipient_net numeric;
  v_payment_id uuid;
  v_local_today date;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if p_payer_id is null or p_recipient_id is null
    or (v_user_id <> p_payer_id and v_user_id <> p_recipient_id) then
    raise exception 'Only the sender or recipient can record this payment' using errcode = '42501';
  end if;

  -- This lock also serializes duplicate checks and balance changes.
  perform 1 from public.groups g
  where g.id = p_group_id and g.deleted_at is null
    and exists (select 1 from public.group_members gm
      where gm.group_id = g.id and gm.user_id = v_user_id)
  for update;
  if not found then
    raise exception 'This group is unavailable for payments' using errcode = '42501';
  end if;

  if p_request_id is null then
    raise exception 'A payment request ID is required' using errcode = '22023';
  end if;
  select * into v_existing from public.group_payments where request_id = p_request_id;
  if found then
    if v_existing.group_id is distinct from p_group_id
      or v_existing.payer_id is distinct from p_payer_id
      or v_existing.recipient_id is distinct from p_recipient_id
      or v_existing.amount_minor is distinct from p_amount_minor
      or v_existing.payment_date is distinct from p_payment_date
      or v_existing.recorded_by is distinct from v_user_id then
      raise exception 'This request ID was already used for another payment' using errcode = '22023';
    end if;
    if v_existing.deleted_at is not null then
      raise exception 'This payment was deleted. Return to the group and refresh.' using errcode = '22023';
    end if;
    -- A lost-response retry succeeds even when the balance is now settled.
    return v_existing.id;
  end if;

  if p_payer_id = p_recipient_id or p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'Invalid payment details' using errcode = '22023';
  end if;
  if p_timezone_offset_minutes is null or p_timezone_offset_minutes not between -840 and 720 then
    raise exception 'Invalid time zone offset' using errcode = '22023';
  end if;
  v_local_today := ((pg_catalog.clock_timestamp() at time zone 'UTC')
    - p_timezone_offset_minutes * interval '1 minute')::date;
  if p_payment_date is null or p_payment_date > v_local_today then
    raise exception 'Payment date cannot be in the future' using errcode = '22023';
  end if;
  if (select count(*) from public.group_members gm
      where gm.group_id = p_group_id and gm.user_id in (p_payer_id, p_recipient_id)) <> 2 then
    raise exception 'Both people must belong to the group' using errcode = '22023';
  end if;

  if not coalesce(p_allow_duplicate, false) and exists (
    select 1 from public.group_payments p
    where p.group_id = p_group_id and p.payer_id = p_payer_id
      and p.recipient_id = p_recipient_id and p.amount_minor = p_amount_minor
      and p.payment_date = p_payment_date and p.deleted_at is null
  ) then
    raise exception 'A payment with the same people, amount, and date is already recorded'
      using errcode = '23505';
  end if;

  v_payer_net := app_private.group_member_net(p_group_id, p_payer_id);
  v_recipient_net := app_private.group_member_net(p_group_id, p_recipient_id);

  if v_payer_net >= 0 or v_recipient_net <= 0
    or p_amount_minor > -v_payer_net or p_amount_minor > v_recipient_net then
    raise exception 'Balances changed. Refresh the group and try again.' using errcode = '22023';
  end if;

  insert into public.group_payments
    (group_id, payer_id, recipient_id, amount_minor, payment_date, recorded_by, request_id)
  values (p_group_id, p_payer_id, p_recipient_id, p_amount_minor, p_payment_date, v_user_id, p_request_id)
  returning id into v_payment_id;
  insert into public.group_activity
    (group_id, actor_id, event_type, amount_minor, payment_from, payment_to, payment_date)
  values (p_group_id, v_user_id, 'payment_recorded', p_amount_minor, p_payer_id, p_recipient_id, p_payment_date);
  return v_payment_id;
end;
$$;

revoke all on function app_private.create_group_expense(uuid, text, bigint, uuid[], bigint[], uuid[], text, date, bigint[], text) from public, anon, authenticated;
revoke all on function public.create_group_expense(uuid, text, bigint, uuid[], bigint[], uuid[], text, date, bigint[], text) from public, anon, authenticated;
grant execute on function app_private.create_group_expense(uuid, text, bigint, uuid[], bigint[], uuid[], text, date, bigint[], text) to authenticated;
grant execute on function public.create_group_expense(uuid, text, bigint, uuid[], bigint[], uuid[], text, date, bigint[], text) to authenticated;

revoke all on function app_private.update_group_expense(uuid, uuid, text, bigint, uuid[], bigint[], uuid[], text, bigint[], text, timestamptz) from public, anon, authenticated;
revoke all on function public.update_group_expense(uuid, uuid, text, bigint, uuid[], bigint[], uuid[], text, bigint[], text, timestamptz) from public, anon, authenticated;
grant execute on function app_private.update_group_expense(uuid, uuid, text, bigint, uuid[], bigint[], uuid[], text, bigint[], text, timestamptz) to authenticated;
grant execute on function public.update_group_expense(uuid, uuid, text, bigint, uuid[], bigint[], uuid[], text, bigint[], text, timestamptz) to authenticated;

commit;
