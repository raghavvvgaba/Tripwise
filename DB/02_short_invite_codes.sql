-- Run once after 01_group_invites.sql. Existing UUID invite links stop working.
begin;

-- The first six bytes of a v4 UUID are random. Rejection sampling gives each
-- eight-letter code the same probability without adding a database extension.
create function app_private.generate_group_invite_code()
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_bytes bytea;
  v_number bigint;
  v_code text := '';
begin
  loop
    v_bytes := pg_catalog.decode(
      pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
      'hex'
    );
    v_number := 0;
    for i in 0..5 loop
      v_number := v_number * 256 + pg_catalog.get_byte(v_bytes, i);
    end loop;
    exit when v_number < (281474976710656::bigint / 208827064576::bigint) * 208827064576::bigint;
  end loop;

  for i in 1..8 loop
    v_code := pg_catalog.chr(65 + (v_number % 26)::integer) || v_code;
    v_number := v_number / 26;
  end loop;
  return v_code;
end;
$$;

revoke all on function app_private.generate_group_invite_code() from public, anon, authenticated;
grant execute on function app_private.generate_group_invite_code() to authenticated;

drop function public.preview_group_invite(uuid);
drop function public.accept_group_invite(uuid);
drop function app_private.preview_group_invite(uuid);
drop function app_private.accept_group_invite(uuid);

alter table public.groups
  alter column invite_code drop default;
alter table public.groups
  alter column invite_code type text using invite_code::text;

-- Preserve groups while replacing their old UUID codes. A unique collision
-- retries inside the same transaction; the existing unique constraint remains.
do $$
declare
  v_group_id uuid;
begin
  for v_group_id in select id from public.groups loop
    loop
      begin
        update public.groups
        set invite_code = app_private.generate_group_invite_code()
        where id = v_group_id;
        exit;
      exception when unique_violation then
        null; -- Generate another code.
      end;
    end loop;
  end loop;
end;
$$;

alter table public.groups
  alter column invite_code set default app_private.generate_group_invite_code();
alter table public.groups
  add constraint groups_invite_code_format check (invite_code ~ '^[A-Z]{8}$');

create function app_private.preview_group_invite(p_code text)
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
  where g.invite_code = pg_catalog.upper(pg_catalog.btrim(p_code))
    and (select auth.uid()) is not null;
$$;

create function public.preview_group_invite(p_code text)
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

create function app_private.accept_group_invite(p_code text)
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
  where g.invite_code = pg_catalog.upper(pg_catalog.btrim(p_code));

  if v_group_id is null then
    return null;
  end if;

  insert into public.group_members (group_id, user_id)
  values (v_group_id, v_user_id)
  on conflict (group_id, user_id) do nothing;

  return v_group_id;
end;
$$;

create function public.accept_group_invite(p_code text)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select app_private.accept_group_invite(p_code);
$$;

revoke all on function app_private.preview_group_invite(text) from public, anon, authenticated;
revoke all on function app_private.accept_group_invite(text) from public, anon, authenticated;
revoke all on function public.preview_group_invite(text) from public, anon, authenticated;
revoke all on function public.accept_group_invite(text) from public, anon, authenticated;

grant execute on function app_private.preview_group_invite(text) to authenticated;
grant execute on function app_private.accept_group_invite(text) to authenticated;
grant execute on function public.preview_group_invite(text) to authenticated;
grant execute on function public.accept_group_invite(text) to authenticated;

commit;
