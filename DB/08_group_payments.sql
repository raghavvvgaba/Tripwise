-- Run once after 07_expense_deletion.sql.
-- app_private must not be exposed through the Data API.
begin;

create table public.group_payments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  payer_id uuid not null references auth.users(id) on delete restrict,
  recipient_id uuid not null references auth.users(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint group_payments_distinct_members check (payer_id <> recipient_id)
);

create index group_payments_group_created_idx
  on public.group_payments (group_id, created_at desc, id desc);

alter table public.group_payments enable row level security;
revoke all on public.group_payments from public, anon, authenticated;
grant select on public.group_payments to authenticated;

create policy "Members can read active group payments"
on public.group_payments for select to authenticated
using (
  group_id in (select app_private.user_group_ids())
  and exists (
    select 1 from public.groups g
    where g.id = group_id and g.deleted_at is null
  )
);

alter table public.group_activity
  add column payment_from uuid references auth.users(id) on delete restrict,
  add column payment_to uuid references auth.users(id) on delete restrict,
  drop constraint group_activity_event_type_check,
  drop constraint group_activity_expense_fields;

alter table public.group_activity
  add constraint group_activity_event_type_check
    check (event_type in ('expense_added', 'expense_edited', 'expense_deleted', 'payment_recorded', 'group_deleted', 'group_restored')),
  add constraint group_activity_expense_fields check (
    (event_type in ('expense_added', 'expense_edited', 'expense_deleted')
      and description is not null and amount_minor is not null
      and payment_from is null and payment_to is null)
    or (event_type = 'payment_recorded'
      and expense_id is null and description is null and amount_minor is not null
      and payment_from is not null and payment_to is not null
      and payment_from <> payment_to)
    or (event_type in ('group_deleted', 'group_restored')
      and expense_id is null and description is null and amount_minor is null
      and payment_from is null and payment_to is null)
  );

drop policy "Members can read group activity" on public.group_activity;
create policy "Members can read group activity"
on public.group_activity for select to authenticated
using (
  group_id in (select app_private.user_group_ids())
  and (
    event_type not in ('expense_added', 'expense_edited', 'payment_recorded')
    or exists (
      select 1 from public.groups g
      where g.id = group_id and g.deleted_at is null
    )
  )
);

create function app_private.record_group_payment(
  p_group_id uuid,
  p_payer_id uuid,
  p_recipient_id uuid,
  p_amount_minor bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_payer_net numeric;
  v_recipient_net numeric;
  v_payment_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  -- This lock serializes payments and waits for concurrent expense edits.
  perform 1 from public.groups g
  where g.id = p_group_id and g.deleted_at is null
    and exists (
      select 1 from public.group_members gm
      where gm.group_id = g.id and gm.user_id = v_user_id
    )
  for update;
  if not found then
    raise exception 'This group is unavailable for payments' using errcode = '42501';
  end if;

  if p_payer_id is null or p_recipient_id is null
    or p_payer_id = p_recipient_id
    or p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'Invalid payment details' using errcode = '22023';
  end if;

  if (select count(*) from public.group_members gm
      where gm.group_id = p_group_id and gm.user_id in (p_payer_id, p_recipient_id)) <> 2 then
    raise exception 'Both people must belong to the group' using errcode = '22023';
  end if;

  -- Positive net means a member is owed money. A payment reduces the
  -- payer's debt and the recipient's credit by the same amount.
  select
    coalesce((select sum(e.amount_minor) from public.expenses e
      where e.group_id = p_group_id and e.paid_by = p_payer_id), 0)
    - coalesce((select sum(s.amount_minor) from public.expense_shares s
      join public.expenses e on e.id = s.expense_id
      where e.group_id = p_group_id and s.user_id = p_payer_id), 0)
    + coalesce((select sum(p.amount_minor) from public.group_payments p
      where p.group_id = p_group_id and p.payer_id = p_payer_id), 0)
    - coalesce((select sum(p.amount_minor) from public.group_payments p
      where p.group_id = p_group_id and p.recipient_id = p_payer_id), 0)
  into v_payer_net;

  select
    coalesce((select sum(e.amount_minor) from public.expenses e
      where e.group_id = p_group_id and e.paid_by = p_recipient_id), 0)
    - coalesce((select sum(s.amount_minor) from public.expense_shares s
      join public.expenses e on e.id = s.expense_id
      where e.group_id = p_group_id and s.user_id = p_recipient_id), 0)
    + coalesce((select sum(p.amount_minor) from public.group_payments p
      where p.group_id = p_group_id and p.payer_id = p_recipient_id), 0)
    - coalesce((select sum(p.amount_minor) from public.group_payments p
      where p.group_id = p_group_id and p.recipient_id = p_recipient_id), 0)
  into v_recipient_net;

  if v_payer_net >= 0 or v_recipient_net <= 0
    or p_amount_minor > -v_payer_net or p_amount_minor > v_recipient_net then
    raise exception 'Balances changed. Refresh the group and try again.' using errcode = '22023';
  end if;

  insert into public.group_payments (group_id, payer_id, recipient_id, amount_minor, recorded_by)
  values (p_group_id, p_payer_id, p_recipient_id, p_amount_minor, v_user_id)
  returning id into v_payment_id;

  insert into public.group_activity
    (group_id, actor_id, event_type, amount_minor, payment_from, payment_to)
  values
    (p_group_id, v_user_id, 'payment_recorded', p_amount_minor, p_payer_id, p_recipient_id);

  return v_payment_id;
end;
$$;

create function public.record_group_payment(
  p_group_id uuid,
  p_payer_id uuid,
  p_recipient_id uuid,
  p_amount_minor bigint
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select app_private.record_group_payment(p_group_id, p_payer_id, p_recipient_id, p_amount_minor);
$$;

revoke all on function app_private.record_group_payment(uuid, uuid, uuid, bigint) from public, anon, authenticated;
revoke all on function public.record_group_payment(uuid, uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function app_private.record_group_payment(uuid, uuid, uuid, bigint) to authenticated;
grant execute on function public.record_group_payment(uuid, uuid, uuid, bigint) to authenticated;

commit;
