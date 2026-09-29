-- Run once after 11_group_cover_policy_fix.sql.
begin;

alter table public.groups
  add column cover_thumbnail_path text,
  add constraint groups_cover_thumbnail_group_folder check (
    cover_thumbnail_path is null
    or (cover_path is not null and cover_thumbnail_path like id::text || '/%')
  );

grant update (cover_thumbnail_path) on public.groups to authenticated;

-- The existing member-only SELECT and INSERT policies cover both files.
-- Protect the active thumbnail as well as the active cover during cleanup.
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
      and g.cover_thumbnail_path is distinct from storage.objects.name
  )
);

commit;
