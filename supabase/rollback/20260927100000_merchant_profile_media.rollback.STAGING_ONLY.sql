-- =====================================================================
-- ROLLBACK of 20260927100000_merchant_profile_media.sql (M6b) — STAGING ONLY.
-- =====================================================================
-- Drops the media RPCs and the upload-ticket table. Restaurant logo_image / cover_image values
-- and stored objects are kept. Roll the application back first (the image controls call these).
-- =====================================================================
begin;

do $$
begin
  if 'NO' <> 'yes' then  -- change 'NO' to 'yes' to allow this rollback
    raise exception 'Rollback switch is off. Edit the script deliberately if you really mean it.';
  end if;
end $$;

drop function if exists public.merchant_media_bind(text, text, uuid, uuid, text, uuid, text, text);
drop function if exists public.merchant_media_ticket(text, text, uuid, text, text, text);
drop function if exists public.merchant_media_read(text, text, uuid);
drop table if exists public.merchant_media_uploads;

commit;
