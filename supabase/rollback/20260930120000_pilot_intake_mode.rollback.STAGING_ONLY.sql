-- =====================================================================
-- ROLLBACK of 20260930120000_pilot_intake_mode.sql — STAGING ONLY.
-- =====================================================================
-- Restores the two-number model: re-apply merchant_listing_apply, merchant_review_queue and
-- merchant_review_capacity_set from 20260927130000 AFTER running this, then roll the app back.
-- A paused setting is turned into pilot_capacity = 0 so nothing reopens by accident.
-- =====================================================================
begin;

do $$
begin
  if 'NO' <> 'yes' then  -- change 'NO' to 'yes' to allow this rollback
    raise exception 'Rollback switch is off. Edit the script deliberately if you really mean it.';
  end if;
end $$;

update private.merchant_review_settings
   set pilot_capacity = case intake_mode when 'paused' then 0 when 'open' then 100000 else pilot_capacity end
 where singleton;
drop function if exists public.pilot_intake_status();
drop function if exists public.merchant_review_capacity_set(text, text, integer, integer, text);
alter table private.merchant_review_settings drop constraint if exists merchant_review_settings_intake_mode_check;
alter table private.merchant_review_settings drop column if exists intake_mode;

commit;
