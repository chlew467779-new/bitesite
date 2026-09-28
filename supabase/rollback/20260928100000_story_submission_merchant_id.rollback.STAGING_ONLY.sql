-- =====================================================================
-- ROLLBACK of 20260928100000_story_submission_merchant_id.sql — STAGING ONLY.
-- =====================================================================
-- Drops the sync trigger, the merchant_id indexes and the column. merchant_slug is untouched
-- (the trigger only ever normalised it to the restaurant's current slug). Roll the application
-- back first (the Owner Story list filters by merchant_id).
-- =====================================================================
begin;

do $$
begin
  if 'NO' <> 'yes' then  -- change 'NO' to 'yes' to allow this rollback
    raise exception 'Rollback switch is off. Edit the script deliberately if you really mean it.';
  end if;
end $$;

drop trigger if exists story_submissions_merchant_sync on public.story_submissions;
drop function if exists private.story_submission_merchant_sync();
drop index if exists public.idx_story_submissions_merchant_id_created;
drop index if exists public.idx_story_submissions_one_pending_per_merchant_id;
alter table public.story_submissions drop column if exists merchant_id;

commit;
