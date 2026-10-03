-- =====================================================================
-- ROLLBACK of 20261003130000_menu_photos_bucket.sql — STAGING ONLY.
-- =====================================================================
-- Roll the application back first (dashboard "Send photos of your menu", Admin "Menu Photos").
-- Empty the bucket before running this: Supabase Dashboard → Storage → menu-photos → select all
-- → Delete (storage objects cannot be deleted with SQL). The script refuses while files remain.
-- =====================================================================
begin;

do $$
begin
  if 'NO' <> 'yes' then  -- change 'NO' to 'yes' to allow this rollback
    raise exception 'Rollback switch is off. Edit the script deliberately if you really mean it.';
  end if;
  if exists (select 1 from storage.objects where bucket_id = 'menu-photos') then
    raise exception 'menu-photos still has files. Empty it in the Supabase Dashboard first.';
  end if;
end $$;

delete from storage.buckets where id = 'menu-photos';

commit;
