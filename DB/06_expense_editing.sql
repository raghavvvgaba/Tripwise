-- Run once after 05_group_deletion.sql.
-- app_private must not be exposed through the Data API.
begin;

alter table public.expenses
  add column updated_at timestamptz,
  add column updated_by uuid references auth.users(id) on delete restrict;

alter table public.expenses
  add constraint expense_edit_attribution_pair
  check ((updated_at is null) = (updated_by is null));

alter table public.group_activity
  drop constraint group_activity_expense_id_key,
  drop constraint group_activity_event_type_check,
  drop constraint group_activity_expense_fields;

alter table public.group_activity
  add constraint group_activity_event_type_check
    check (event_type in ('expense_added', 'expense_edited', 'group_deleted', 'group_restored')),
  add constraint group_activity_expense_fields check (
    (event_type in ('expense_added', 'expense_edited')
      and expense_id is not null and description is not null and amount_minor is not null)
    or (event_type in ('group_deleted', 'group_restored')
      and expense_id is null and description is null and amount_minor is null)
  );

create index group_activity_expense_idx on public.group_activity (expense_id)
  where expense_id is not null;

drop policy "Members can read group activity" on public.group_activity;
create policy "Members can read group activity"
on public.group_activity for select to authenticated
using (
  group_id in (select app_private.user_group_ids())
  and (
    event_type not in ('expense_added', 'expense_edited')
    or exists (
      select 1 from public.groups g
      where g.id = group_id and g.deleted_at is null
    )
  )
);

create function app_private.update_group_expense(
  p_group_id uuid,
  p_expense_id uuid,
  p_description text,
  p_amount_minor bigint,
  p_paid_by uuid,
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

  if not exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = p_paid_by
  ) then
    raise exception 'Payer must belong to the group' using errcode = '22023';
  end if;

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
    paid_by = p_paid_by,
    split_mode = p_split_mode,
    note = nullif(pg_catalog.btrim(p_note), ''),
    updated_at = v_updated_at,
    updated_by = v_user_id
  where e.id = p_expense_id;

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
  p_paid_by uuid,
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
    p_group_id, p_expense_id, p_description, p_amount_minor, p_paid_by,
    p_member_ids, p_split_mode, p_exact_amounts_minor, p_note, p_expected_updated_at
  );
$$;

revoke all on function app_private.update_group_expense(uuid, uuid, text, bigint, uuid, uuid[], text, bigint[], text, timestamptz) from public, anon, authenticated;
revoke all on function public.update_group_expense(uuid, uuid, text, bigint, uuid, uuid[], text, bigint[], text, timestamptz) from public, anon, authenticated;
grant execute on function app_private.update_group_expense(uuid, uuid, text, bigint, uuid, uuid[], text, bigint[], text, timestamptz) to authenticated;
grant execute on function public.update_group_expense(uuid, uuid, text, bigint, uuid, uuid[], text, bigint[], text, timestamptz) to authenticated;

commit;
