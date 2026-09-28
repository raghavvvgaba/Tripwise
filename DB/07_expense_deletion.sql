-- Run once after 06_expense_editing.sql.
-- app_private must not be exposed through the Data API.
begin;

-- Keep earlier add/edit activity as snapshots after an expense is removed.
alter table public.group_activity
  drop constraint group_activity_expense_id_fkey,
  add constraint group_activity_expense_id_fkey
    foreign key (expense_id) references public.expenses(id) on delete set null,
  drop constraint group_activity_event_type_check,
  drop constraint group_activity_expense_fields;

alter table public.group_activity
  add constraint group_activity_event_type_check
    check (event_type in ('expense_added', 'expense_edited', 'expense_deleted', 'group_deleted', 'group_restored')),
  add constraint group_activity_expense_fields check (
    (event_type in ('expense_added', 'expense_edited', 'expense_deleted')
      and description is not null and amount_minor is not null)
    or (event_type in ('group_deleted', 'group_restored')
      and expense_id is null and description is null and amount_minor is null)
  ),
  add constraint group_activity_deleted_expense_unlinked check (
    event_type <> 'expense_deleted' or expense_id is null
  );

create function app_private.delete_group_expense(p_group_id uuid, p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_description text;
  v_amount_minor bigint;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  -- Match the group-then-expense lock order used when editing.
  perform 1 from public.groups g
  where g.id = p_group_id and g.deleted_at is null
    and exists (
      select 1 from public.group_members gm
      where gm.group_id = g.id and gm.user_id = v_user_id
    )
  for share;
  if not found then
    raise exception 'This group is unavailable for deleting expenses' using errcode = '42501';
  end if;

  select e.description, e.amount_minor into v_description, v_amount_minor
  from public.expenses e
  where e.id = p_expense_id and e.group_id = p_group_id
  for update;
  if not found then
    raise exception 'Expense not found' using errcode = '22023';
  end if;

  delete from public.expenses e where e.id = p_expense_id;

  insert into public.group_activity (
    group_id, actor_id, event_type, description, amount_minor
  ) values (
    p_group_id, v_user_id, 'expense_deleted', v_description, v_amount_minor
  );
end;
$$;

create function public.delete_group_expense(p_group_id uuid, p_expense_id uuid)
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  select app_private.delete_group_expense(p_group_id, p_expense_id);
$$;

revoke all on function app_private.delete_group_expense(uuid, uuid) from public, anon, authenticated;
revoke all on function public.delete_group_expense(uuid, uuid) from public, anon, authenticated;
grant execute on function app_private.delete_group_expense(uuid, uuid) to authenticated;
grant execute on function public.delete_group_expense(uuid, uuid) to authenticated;

commit;
