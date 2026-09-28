-- Fresh database: run this after 00_groups.sql.
-- app_private must not be added to the Data API's exposed schemas.
begin;

alter table public.groups
  add column invite_code uuid not null default gen_random_uuid();

alter table public.groups
  add constraint groups_invite_code_key unique (invite_code);

-- The database, not a client, must generate invite codes.
revoke insert on public.groups from public, anon, authenticated;
grant insert (name, currency) on public.groups to authenticated;

create schema if not exists app_private;
grant usage on schema app_private to authenticated;

create function app_private.preview_group_invite(p_code uuid)
returns table (
  group_id uuid,
  group_name text,
  group_currency text,
  member_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.name, g.currency,
    (select count(*)::integer
     from public.group_members gm
     where gm.group_id = g.id)
  from public.groups g
  where g.invite_code = p_code
    and (select auth.uid()) is not null;
$$;

create function public.preview_group_invite(p_code uuid)
returns table (
  group_id uuid,
  group_name text,
  group_currency text,
  member_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.group_id, p.group_name, p.group_currency, p.member_count
  from app_private.preview_group_invite(p_code) p;
$$;

create function app_private.accept_group_invite(p_code uuid)
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
  where g.invite_code = p_code;

  if v_group_id is null then
    return null;
  end if;

  insert into public.group_members (group_id, user_id)
  values (v_group_id, v_user_id)
  on conflict (group_id, user_id) do nothing;

  return v_group_id;
end;
$$;

create function public.accept_group_invite(p_code uuid)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select app_private.accept_group_invite(p_code);
$$;

create function app_private.count_group_members(p_group_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.group_members gm
      where gm.group_id = p_group_id
        and gm.user_id = (select auth.uid())
    ) then (
      select count(*)::integer from public.group_members gm
      where gm.group_id = p_group_id
    )
    else null
  end;
$$;

create function public.group_member_count(p_group_id uuid)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select app_private.count_group_members(p_group_id);
$$;

revoke all on function app_private.preview_group_invite(uuid) from public, anon, authenticated;
revoke all on function app_private.accept_group_invite(uuid) from public, anon, authenticated;
revoke all on function app_private.count_group_members(uuid) from public, anon, authenticated;
revoke all on function public.preview_group_invite(uuid) from public, anon, authenticated;
revoke all on function public.accept_group_invite(uuid) from public, anon, authenticated;
revoke all on function public.group_member_count(uuid) from public, anon, authenticated;

grant execute on function app_private.preview_group_invite(uuid) to authenticated;
grant execute on function app_private.accept_group_invite(uuid) to authenticated;
grant execute on function app_private.count_group_members(uuid) to authenticated;
grant execute on function public.preview_group_invite(uuid) to authenticated;
grant execute on function public.accept_group_invite(uuid) to authenticated;
grant execute on function public.group_member_count(uuid) to authenticated;

commit;
