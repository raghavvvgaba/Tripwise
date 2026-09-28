-- Run once after 04_group_expenses.sql. Group deletion is shared and reversible.
-- app_private must not be exposed through the Data API.
begin;

alter table public.groups add column deleted_at timestamptz;

-- Retire personal archiving. Previously archived memberships return to the
-- active list, while their groups and expenses remain intact.
update public.group_members set archived_at = null where archived_at is not null;
revoke update (archived_at) on public.group_members from authenticated;
drop policy "Users can archive their membership" on public.group_members;

-- One feed table gives expenses and group changes a single chronological order.
create table public.group_activity (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type in ('expense_added', 'group_deleted', 'group_restored')),
  expense_id uuid unique references public.expenses(id) on delete cascade,
  description text,
  amount_minor bigint,
  created_at timestamptz not null default now(),
  constraint group_activity_expense_fields check (
    (event_type = 'expense_added' and expense_id is not null and description is not null and amount_minor is not null)
    or (event_type <> 'expense_added' and expense_id is null and description is null and amount_minor is null)
  )
);

create index group_activity_created_idx on public.group_activity (created_at desc, id desc);
create index group_activity_group_idx on public.group_activity (group_id);

alter table public.group_activity enable row level security;
revoke all on public.group_activity from public, anon, authenticated;
grant select on public.group_activity to authenticated;

create policy "Members can read group activity"
on public.group_activity for select to authenticated
using (
  group_id in (select app_private.user_group_ids())
  and (
    event_type <> 'expense_added'
    or exists (
      select 1 from public.groups g
      where g.id = group_id and g.deleted_at is null
    )
  )
);

-- Deleted groups remain readable to members for recovery, but expenses and
-- shares disappear from normal queries until the group is restored.
drop policy "Members can read expenses" on public.expenses;
create policy "Members can read expenses"
on public.expenses for select to authenticated
using (
  group_id in (select app_private.user_group_ids())
  and exists (
    select 1 from public.groups g
    where g.id = group_id and g.deleted_at is null
  )
);

-- Existing expense-share policy checks the parent expense, so it inherits the
-- new visibility rule above.

-- Lock the group before writing an expense. A concurrent delete waits for the
-- expense transaction, so no expense can be added after deletion commits.
create function app_private.require_active_expense_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.groups g
  where g.id = new.group_id and g.deleted_at is null
  for share;
  if not found then
    raise exception 'Restore this group before adding an expense' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger require_active_expense_group_before_insert
before insert on public.expenses
for each row execute function app_private.require_active_expense_group();

create function app_private.log_expense_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.group_activity (
    group_id, actor_id, event_type, expense_id, description, amount_minor, created_at
  ) values (
    new.group_id, new.created_by, 'expense_added', new.id, new.description, new.amount_minor, new.created_at
  );
  return new;
end;
$$;

create trigger log_expense_activity_after_insert
after insert on public.expenses
for each row execute function app_private.log_expense_activity();

insert into public.group_activity (
  group_id, actor_id, event_type, expense_id, description, amount_minor, created_at
)
select e.group_id, e.created_by, 'expense_added', e.id, e.description, e.amount_minor, e.created_at
from public.expenses e
on conflict (expense_id) do nothing;

create function app_private.set_group_deleted(p_group_id uuid, p_deleted boolean)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_deleted_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select g.deleted_at into v_deleted_at
  from public.groups g
  where g.id = p_group_id
    and exists (
      select 1 from public.group_members gm
      where gm.group_id = g.id and gm.user_id = v_user_id
    )
  for update;

  if not found then
    raise exception 'Group not found or access denied' using errcode = '42501';
  end if;

  if p_deleted and v_deleted_at is null then
    v_deleted_at := pg_catalog.clock_timestamp();
    update public.groups set deleted_at = v_deleted_at where id = p_group_id;
    insert into public.group_activity (group_id, actor_id, event_type)
    values (p_group_id, v_user_id, 'group_deleted');
  elsif not p_deleted and v_deleted_at is not null then
    update public.groups set deleted_at = null where id = p_group_id;
    insert into public.group_activity (group_id, actor_id, event_type)
    values (p_group_id, v_user_id, 'group_restored');
    v_deleted_at := null;
  end if;

  return v_deleted_at;
end;
$$;

create function public.delete_group(p_group_id uuid)
returns timestamptz
language sql
volatile
security invoker
set search_path = ''
as $$
  select app_private.set_group_deleted(p_group_id, true);
$$;

create function public.restore_group(p_group_id uuid)
returns timestamptz
language sql
volatile
security invoker
set search_path = ''
as $$
  select app_private.set_group_deleted(p_group_id, false);
$$;

-- Invite codes cannot reveal or rejoin a deleted group.
create or replace function app_private.preview_group_invite(p_code text)
returns table (group_id uuid, group_name text, group_currency text, member_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.name, g.currency,
    (select count(*)::integer from public.group_members gm where gm.group_id = g.id)
  from public.groups g
  where g.invite_code = pg_catalog.upper(pg_catalog.btrim(p_code))
    and g.deleted_at is null
    and (select auth.uid()) is not null;
$$;

create or replace function app_private.accept_group_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_group_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select g.id into v_group_id
  from public.groups g
  where g.invite_code = pg_catalog.upper(pg_catalog.btrim(p_code))
    and g.deleted_at is null
  for share;

  if v_group_id is null then return null; end if;

  insert into public.group_members (group_id, user_id)
  values (v_group_id, v_user_id)
  on conflict (group_id, user_id) do nothing;

  return v_group_id;
end;
$$;

create or replace function app_private.count_group_members(p_group_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.group_members gm
      join public.groups g on g.id = gm.group_id
      where gm.group_id = p_group_id
        and gm.user_id = (select auth.uid())
        and g.deleted_at is null
    ) then (
      select count(*)::integer from public.group_members gm
      where gm.group_id = p_group_id
    )
    else null
  end;
$$;

revoke all on function app_private.require_active_expense_group() from public, anon, authenticated;
revoke all on function app_private.log_expense_activity() from public, anon, authenticated;
revoke all on function app_private.set_group_deleted(uuid, boolean) from public, anon, authenticated;
revoke all on function public.delete_group(uuid) from public, anon, authenticated;
revoke all on function public.restore_group(uuid) from public, anon, authenticated;
grant execute on function app_private.set_group_deleted(uuid, boolean) to authenticated;
grant execute on function public.delete_group(uuid) to authenticated;
grant execute on function public.restore_group(uuid) to authenticated;

commit;
