-- Run once after 13_remove_group_archiving.sql.
-- Only the sender/recipient may record or delete a payment. No restore flow.
begin;

alter table public.group_payments
  add column request_id uuid not null default gen_random_uuid(),
  add column deleted_at timestamptz,
  add column deleted_by uuid references auth.users(id) on delete restrict,
  add constraint group_payments_request_id_key unique (request_id),
  add constraint group_payments_deletion_fields check (
    (deleted_at is null and deleted_by is null)
    or (deleted_at is not null and deleted_by is not null)
  );

drop policy "Members can read active group payments" on public.group_payments;
create policy "Members can read active group payments"
on public.group_payments for select to authenticated
using (
  deleted_at is null
  and group_id in (select app_private.user_group_ids())
  and exists (select 1 from public.groups g where g.id = group_id and g.deleted_at is null)
);

alter table public.group_activity
  drop constraint group_activity_event_type_check,
  drop constraint group_activity_expense_fields,
  add constraint group_activity_event_type_check check (event_type in (
    'expense_added', 'expense_edited', 'expense_deleted',
    'payment_recorded', 'payment_deleted', 'group_deleted', 'group_restored'
  )),
  add constraint group_activity_expense_fields check (
    (event_type in ('expense_added', 'expense_edited', 'expense_deleted')
      and description is not null and amount_minor is not null
      and payment_from is null and payment_to is null and payment_date is null)
    or (event_type in ('payment_recorded', 'payment_deleted')
      and expense_id is null and description is null and amount_minor is not null
      and payment_from is not null and payment_to is not null
      and payment_from <> payment_to and payment_date is not null)
    or (event_type in ('group_deleted', 'group_restored')
      and expense_id is null and description is null and amount_minor is null
      and payment_from is null and payment_to is null and payment_date is null)
  );

drop policy "Members can read group activity" on public.group_activity;
create policy "Members can read group activity"
on public.group_activity for select to authenticated
using (
  group_id in (select app_private.user_group_ids())
  and (event_type not in ('expense_added', 'expense_edited', 'payment_recorded', 'payment_deleted')
    or exists (select 1 from public.groups g where g.id = group_id and g.deleted_at is null))
);

-- Remove the old callable signature so clients cannot bypass the new checks.
drop function public.record_group_payment(uuid, uuid, uuid, bigint, date, integer);
drop function app_private.record_group_payment(uuid, uuid, uuid, bigint, date, integer);

create function app_private.record_group_payment(
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

  select
    coalesce((select sum(e.amount_minor) from public.expenses e
      where e.group_id = p_group_id and e.paid_by = p_payer_id), 0)
    - coalesce((select sum(s.amount_minor) from public.expense_shares s
      join public.expenses e on e.id = s.expense_id
      where e.group_id = p_group_id and s.user_id = p_payer_id), 0)
    + coalesce((select sum(p.amount_minor) from public.group_payments p
      where p.group_id = p_group_id and p.payer_id = p_payer_id and p.deleted_at is null), 0)
    - coalesce((select sum(p.amount_minor) from public.group_payments p
      where p.group_id = p_group_id and p.recipient_id = p_payer_id and p.deleted_at is null), 0)
  into v_payer_net;

  select
    coalesce((select sum(e.amount_minor) from public.expenses e
      where e.group_id = p_group_id and e.paid_by = p_recipient_id), 0)
    - coalesce((select sum(s.amount_minor) from public.expense_shares s
      join public.expenses e on e.id = s.expense_id
      where e.group_id = p_group_id and s.user_id = p_recipient_id), 0)
    + coalesce((select sum(p.amount_minor) from public.group_payments p
      where p.group_id = p_group_id and p.payer_id = p_recipient_id and p.deleted_at is null), 0)
    - coalesce((select sum(p.amount_minor) from public.group_payments p
      where p.group_id = p_group_id and p.recipient_id = p_recipient_id and p.deleted_at is null), 0)
  into v_recipient_net;

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

create function public.record_group_payment(
  p_group_id uuid, p_payer_id uuid, p_recipient_id uuid, p_amount_minor bigint,
  p_payment_date date, p_timezone_offset_minutes integer,
  p_request_id uuid, p_allow_duplicate boolean
)
returns uuid language sql volatile security invoker set search_path = ''
as $$
  select app_private.record_group_payment(p_group_id, p_payer_id, p_recipient_id,
    p_amount_minor, p_payment_date, p_timezone_offset_minutes, p_request_id, p_allow_duplicate);
$$;

create function app_private.delete_group_payment(p_group_id uuid, p_payment_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_payment public.group_payments%rowtype;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  perform 1 from public.groups g
  where g.id = p_group_id and g.deleted_at is null
    and exists (select 1 from public.group_members gm
      where gm.group_id = g.id and gm.user_id = v_user_id)
  for update;
  if not found then
    raise exception 'This group is unavailable for payments' using errcode = '42501';
  end if;
  select * into v_payment from public.group_payments
    where id = p_payment_id and group_id = p_group_id for update;
  if not found then
    raise exception 'Payment not found' using errcode = '22023';
  end if;
  if v_user_id <> v_payment.payer_id and v_user_id <> v_payment.recipient_id then
    raise exception 'Only the sender or recipient can delete this payment' using errcode = '42501';
  end if;
  if v_payment.deleted_at is not null then return; end if;

  update public.group_payments set deleted_at = pg_catalog.clock_timestamp(), deleted_by = v_user_id
    where id = v_payment.id;
  insert into public.group_activity
    (group_id, actor_id, event_type, amount_minor, payment_from, payment_to, payment_date)
  values (p_group_id, v_user_id, 'payment_deleted', v_payment.amount_minor,
    v_payment.payer_id, v_payment.recipient_id, v_payment.payment_date);
end;
$$;

create function public.delete_group_payment(p_group_id uuid, p_payment_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select app_private.delete_group_payment(p_group_id, p_payment_id); $$;

revoke all on function app_private.record_group_payment(uuid, uuid, uuid, bigint, date, integer, uuid, boolean) from public, anon, authenticated;
revoke all on function public.record_group_payment(uuid, uuid, uuid, bigint, date, integer, uuid, boolean) from public, anon, authenticated;
revoke all on function app_private.delete_group_payment(uuid, uuid) from public, anon, authenticated;
revoke all on function public.delete_group_payment(uuid, uuid) from public, anon, authenticated;
grant execute on function app_private.record_group_payment(uuid, uuid, uuid, bigint, date, integer, uuid, boolean) to authenticated;
grant execute on function public.record_group_payment(uuid, uuid, uuid, bigint, date, integer, uuid, boolean) to authenticated;
grant execute on function app_private.delete_group_payment(uuid, uuid) to authenticated;
grant execute on function public.delete_group_payment(uuid, uuid) to authenticated;

commit;
