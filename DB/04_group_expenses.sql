-- Run once after 03_group_member_names.sql.
-- app_private must not be exposed through the Data API.
begin;

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  description text not null check (length(btrim(description)) between 1 and 120),
  amount_minor bigint not null check (amount_minor > 0),
  paid_by uuid not null references auth.users(id) on delete restrict,
  split_mode text not null check (split_mode in ('equal', 'exact')),
  expense_date date not null,
  note text check (note is null or length(note) <= 2000),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index expenses_group_date_idx
  on public.expenses (group_id, expense_date desc, created_at desc);

create table public.expense_shares (
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  amount_minor bigint not null check (amount_minor >= 0),
  primary key (expense_id, user_id)
);

alter table public.expenses enable row level security;
alter table public.expense_shares enable row level security;

revoke all on public.expenses, public.expense_shares from public, anon, authenticated;
grant select on public.expenses, public.expense_shares to authenticated;

create policy "Members can read expenses"
on public.expenses for select to authenticated
using (group_id in (select app_private.user_group_ids()));

create policy "Members can read expense shares"
on public.expense_shares for select to authenticated
using (
  exists (
    select 1 from public.expenses e
    where e.id = expense_id
      and e.group_id in (select app_private.user_group_ids())
  )
);

create function app_private.create_group_expense(
  p_group_id uuid,
  p_description text,
  p_amount_minor bigint,
  p_paid_by uuid,
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
      and gm.archived_at is null
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

  insert into public.expenses (
    group_id, description, amount_minor, paid_by, split_mode,
    expense_date, note, created_by
  ) values (
    p_group_id, pg_catalog.btrim(p_description), p_amount_minor, p_paid_by,
    p_split_mode, p_expense_date, nullif(pg_catalog.btrim(p_note), ''), v_user_id
  ) returning id into v_expense_id;

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
  p_paid_by uuid,
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
    p_group_id, p_description, p_amount_minor, p_paid_by, p_member_ids,
    p_split_mode, p_expense_date, p_exact_amounts_minor, p_note
  );
$$;

revoke all on function app_private.create_group_expense(uuid, text, bigint, uuid, uuid[], text, date, bigint[], text) from public, anon, authenticated;
revoke all on function public.create_group_expense(uuid, text, bigint, uuid, uuid[], text, date, bigint[], text) from public, anon, authenticated;
grant execute on function app_private.create_group_expense(uuid, text, bigint, uuid, uuid[], text, date, bigint[], text) to authenticated;
grant execute on function public.create_group_expense(uuid, text, bigint, uuid, uuid[], text, date, bigint[], text) to authenticated;

commit;
