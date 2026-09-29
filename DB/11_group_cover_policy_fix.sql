-- Run once after 10_group_covers.sql.
-- Qualify the outer object path: bare "name" inside the group subquery
-- resolves to groups.name rather than storage.objects.name.
begin;

alter policy "Members can read group covers"
on storage.objects to authenticated
using (
  storage.objects.bucket_id = 'Group-cover-images'
  and exists (
    select 1 from public.groups g
    where g.id::text = (storage.foldername(storage.objects.name))[1]
      and g.id in (select app_private.user_group_ids())
  )
);

alter policy "Members can upload active group covers"
on storage.objects to authenticated
with check (
  storage.objects.bucket_id = 'Group-cover-images'
  and exists (
    select 1 from public.groups g
    where g.id::text = (storage.foldername(storage.objects.name))[1]
      and g.id in (select app_private.user_group_ids())
      and g.deleted_at is null
  )
);

alter policy "Members can remove unused group covers"
on storage.objects to authenticated
using (
  storage.objects.bucket_id = 'Group-cover-images'
  and exists (
    select 1 from public.groups g
    where g.id::text = (storage.foldername(storage.objects.name))[1]
      and g.id in (select app_private.user_group_ids())
      and g.deleted_at is null
      and g.cover_path is distinct from storage.objects.name
  )
);

commit;
