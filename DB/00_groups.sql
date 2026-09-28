-- Fresh database: run this first in your Supabase project's SQL Editor.
begin;

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  currency text not null check (currency in ('INR', 'USD', 'EUR', 'GBP')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  archived_at timestamptz,
  primary key (group_id, user_id)
);

create index group_members_user_group_idx
  on public.group_members (user_id, group_id);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

revoke all on table public.groups, public.group_members from anon, authenticated;
grant select, insert on public.groups to authenticated;
grant select on public.group_members to authenticated;
grant insert (group_id, user_id) on public.group_members to authenticated;
grant update (archived_at) on public.group_members to authenticated;

-- Keep membership lookup outside the group_members RLS policy. Otherwise its
-- insert policy reads groups, whose select policy reads group_members again.
-- Do not expose app_private through the Data API.
create schema if not exists app_private;
grant usage on schema app_private to authenticated;

create function app_private.user_group_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select gm.group_id
  from public.group_members gm
  where gm.user_id = (select auth.uid());
$$;

revoke all on function app_private.user_group_ids() from public, anon, authenticated;
grant execute on function app_private.user_group_ids() to authenticated;

create policy "Members can read groups"
on public.groups for select to authenticated
using (
  created_by = (select auth.uid())
  or id in (select app_private.user_group_ids())
);

create policy "Users can create groups"
on public.groups for insert to authenticated
with check (created_by = (select auth.uid()));

create policy "Users can read their membership"
on public.group_members for select to authenticated
using (user_id = (select auth.uid()));

create policy "Creators can add their own membership"
on public.group_members for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.groups g
    where g.id = group_id
      and g.created_by = (select auth.uid())
  )
);

create policy "Users can archive their membership"
on public.group_members for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create function public.add_creator_membership()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.group_members (group_id, user_id)
  values (new.id, new.created_by);
  return new;
end;
$$;

create trigger add_creator_membership_after_group_insert
after insert on public.groups
for each row execute function public.add_creator_membership();

commit;
