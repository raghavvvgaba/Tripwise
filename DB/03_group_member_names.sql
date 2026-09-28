-- Run once after 02_short_invite_codes.sql.
-- app_private must not be exposed through the Data API.
begin;

create function app_private.list_group_member_names(p_group_id uuid)
returns table (user_id uuid, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select gm.user_id,
    nullif(pg_catalog.btrim(u.raw_user_meta_data ->> 'name'), '')
  from public.group_members gm
  join auth.users u on u.id = gm.user_id
  where gm.group_id = p_group_id
    and exists (
      select 1
      from public.group_members caller
      where caller.group_id = p_group_id
        and caller.user_id = (select auth.uid())
    )
  order by gm.joined_at, gm.user_id;
$$;

create function public.group_member_names(p_group_id uuid)
returns table (user_id uuid, name text)
language sql
stable
security invoker
set search_path = ''
as $$
  select m.user_id, m.name
  from app_private.list_group_member_names(p_group_id) m;
$$;

revoke all on function app_private.list_group_member_names(uuid) from public, anon, authenticated;
revoke all on function public.group_member_names(uuid) from public, anon, authenticated;
grant execute on function app_private.list_group_member_names(uuid) to authenticated;
grant execute on function public.group_member_names(uuid) to authenticated;

commit;
