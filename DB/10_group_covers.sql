-- Run once after 09_payment_dates.sql. The private Group-cover-images bucket
-- must already exist in Supabase Storage.
begin;

do $$
begin
  if not exists (
    select 1 from storage.buckets
    where id = 'Group-cover-images' and public = false
  ) then
    raise exception 'Create the private Group-cover-images Storage bucket before this migration';
  end if;
end;
$$;

alter table public.groups
  add column cover_path text
  constraint groups_cover_path_group_folder check (
    cover_path is null or cover_path like id::text || '/%'
  );

grant update (cover_path) on public.groups to authenticated;

create policy "Members can update active group covers"
on public.groups for update to authenticated
using (id in (select app_private.user_group_ids()) and deleted_at is null)
with check (id in (select app_private.user_group_ids()) and deleted_at is null);

create policy "Members can read group covers"
on storage.objects for select to authenticated
using (
  bucket_id = 'Group-cover-images'
  and exists (
    select 1 from public.groups g
    where g.id::text = (storage.foldername(name))[1]
      and g.id in (select app_private.user_group_ids())
  )
);

create policy "Members can upload active group covers"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'Group-cover-images'
  and exists (
    select 1 from public.groups g
    where g.id::text = (storage.foldername(name))[1]
      and g.id in (select app_private.user_group_ids())
      and g.deleted_at is null
  )
);

create policy "Members can remove unused group covers"
on storage.objects for delete to authenticated
using (
  bucket_id = 'Group-cover-images'
  and exists (
    select 1 from public.groups g
    where g.id::text = (storage.foldername(name))[1]
      and g.id in (select app_private.user_group_ids())
      and g.deleted_at is null
      and g.cover_path is distinct from name
  )
);

commit;
