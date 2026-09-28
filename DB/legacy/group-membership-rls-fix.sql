-- Legacy patch: run once only if the original groups-schema.sql was applied
-- before its RLS fix. Fresh databases using ../00_groups.sql do not need this.
-- Keep app_private out of the Data API's exposed schemas.
begin;

create schema if not exists app_private;
grant usage on schema app_private to authenticated;

create or replace function app_private.user_group_ids()
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

drop policy if exists "Members can read groups" on public.groups;
create policy "Members can read groups"
on public.groups for select to authenticated
using (
  created_by = (select auth.uid())
  or id in (select app_private.user_group_ids())
);

commit;
