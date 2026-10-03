-- =====================================================================
-- ROLLBACK of 20261003160000_site_errors.sql - STAGING ONLY.
-- =====================================================================
-- Roll the application back first (instrumentation.ts, /api/site-errors, Admin "Site Errors").
-- The app copes without the table (nothing is recorded, the badge stays 0), so this is optional.
-- Drops the recorded errors.
-- =====================================================================
begin;
do $$ begin
  if 'NO' <> 'yes' then  -- change 'NO' to 'yes' to allow this rollback
    raise exception 'Rollback switch is off. Edit deliberately to allow this rollback.';
  end if;
end $$;
drop function if exists public.site_error_record(text, text, text, text);
drop table if exists public.site_errors;
commit;
