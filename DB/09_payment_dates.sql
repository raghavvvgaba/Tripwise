-- Run once after 08_group_payments.sql.
-- Payment dates are calendar dates; created_at remains the recording time.
begin;

alter table public.group_payments add column payment_date date;
update public.group_payments
set payment_date = (created_at at time zone 'UTC')::date;
alter table public.group_payments alter column payment_date set not null;

alter table public.group_activity
  add column payment_date date,
  drop constraint group_activity_expense_fields;

update public.group_activity
set payment_date = (created_at at time zone 'UTC')::date
where event_type = 'payment_recorded';

alter table public.group_activity
  add constraint group_activity_expense_fields check (
    (event_type in ('expense_added', 'expense_edited', 'expense_deleted')
      and description is not null and amount_minor is not null
      and payment_from is null and payment_to is null and payment_date is null)
    or (event_type = 'payment_recorded'
      and expense_id is null and description is null and amount_minor is not null
      and payment_from is not null and payment_to is not null
      and payment_from <> payment_to and payment_date is not null)
    or (event_type in ('group_deleted', 'group_restored')
      and expense_id is null and description is null and amount_minor is null
      and payment_from is null and payment_to is null and payment_date is null)
  );

drop function public.record_group_payment(uuid, uuid, uuid, bigint);
drop function app_private.record_group_payment(uuid, uuid, uuid, bigint);

create function app_private.record_group_payment(
  p_group_id uuid,
  p_payer_id uuid,
  p_recipient_id uuid,
  p_amount_minor bigint,
  p_payment_date date,
  p_timezone_offset_minutes integer
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
  v_local_today date;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  -- JavaScript getTimezoneOffset is UTC minus local time, in minutes.
  if p_timezone_offset_minutes is null or p_timezone_offset_minutes not between -840 and 720 then
    raise exception 'Invalid time zone offset' using errcode = '22023';
  end if;
  v_local_today := ((pg_catalog.clock_timestamp() at time zone 'UTC')
    - p_timezone_offset_minutes * interval '1 minute')::date;
  if p_payment_date is null or p_payment_date > v_local_today then
    raise exception 'Payment date cannot be in the future' using errcode = '22023';
  end if;

  -- Serialize payments and wait for concurrent expense edits or group deletion.
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

  insert into public.group_payments
    (group_id, payer_id, recipient_id, amount_minor, payment_date, recorded_by)
  values
    (p_group_id, p_payer_id, p_recipient_id, p_amount_minor, p_payment_date, v_user_id)
  returning id into v_payment_id;

  insert into public.group_activity
    (group_id, actor_id, event_type, amount_minor, payment_from, payment_to, payment_date)
  values
    (p_group_id, v_user_id, 'payment_recorded', p_amount_minor, p_payer_id, p_recipient_id, p_payment_date);

  return v_payment_id;
end;
$$;

create function public.record_group_payment(
  p_group_id uuid,
  p_payer_id uuid,
  p_recipient_id uuid,
  p_amount_minor bigint,
  p_payment_date date,
  p_timezone_offset_minutes integer
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select app_private.record_group_payment(
    p_group_id, p_payer_id, p_recipient_id, p_amount_minor,
    p_payment_date, p_timezone_offset_minutes
  );
$$;

revoke all on function app_private.record_group_payment(uuid, uuid, uuid, bigint, date, integer) from public, anon, authenticated;
revoke all on function public.record_group_payment(uuid, uuid, uuid, bigint, date, integer) from public, anon, authenticated;
grant execute on function app_private.record_group_payment(uuid, uuid, uuid, bigint, date, integer) to authenticated;
grant execute on function public.record_group_payment(uuid, uuid, uuid, bigint, date, integer) to authenticated;

commit;
