-- =====================================================================
-- Menu photos from restaurant owners (CH 2026-09-30): a PRIVATE storage bucket.
-- =====================================================================
-- An Owner who does not want to type the menu sends photos of the printed menu from the dashboard;
-- BiteSite reads them (Gemini prompt in lib/menu-import-core.mjs), imports the menu and deletes
-- the photos. The photos of a restaurant that is not live yet must not be public, so they get
-- their own bucket instead of the public merchant-media bucket (which anyone can list).
--
-- - Private (public = false), images only, 10 MB per file.
-- - No storage.objects policies for this bucket: anon and authenticated can neither list, read,
--   upload nor delete. Only server code (service role) touches it; uploads use short-lived signed
--   upload URLs for server-chosen paths and are checked (size, real image type) before they count.
-- - Paths: <merchant id>/incoming/<uuid>.<ext> until checked, then <merchant id>/<uuid>.<ext>.
-- Rollback: supabase/rollback/20261003130000_menu_photos_bucket.rollback.STAGING_ONLY.sql
-- =====================================================================
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-photos', 'menu-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if (select public from storage.buckets where id = 'menu-photos') is distinct from false then
    raise exception 'menu-photos self-check: the bucket must be private';
  end if;
  -- A policy that names the bucket, or one with no bucket condition at all, would open it.
  if exists (
    select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and (coalesce(qual, '') || coalesce(with_check, '')) ilike '%menu-photos%'
  ) then
    raise exception 'menu-photos self-check: no storage policy may name this bucket';
  end if;
  if exists (
    select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and roles && array['public', 'anon', 'authenticated']::name[]
       and coalesce(qual, '') not ilike '%bucket_id%'
       and coalesce(with_check, '') not ilike '%bucket_id%'
  ) then
    raise exception 'menu-photos self-check: a storage policy without a bucket condition would apply to this bucket';
  end if;
end $$;

commit;
