-- =====================================================================
-- ROLLBACK of 20260928130000_public_reports.sql — STAGING ONLY.
-- =====================================================================
-- Drops the report RPCs and table (report history is lost; export it first if it matters).
-- Roll the application back first ("Report a problem" panels, /api/reports, Admin Reports page).
-- =====================================================================
begin;

do $$
begin
  if 'NO' <> 'yes' then  -- change 'NO' to 'yes' to allow this rollback
    raise exception 'Rollback switch is off. Edit the script deliberately if you really mean it.';
  end if;
end $$;

drop function if exists public.public_report_submit(text, text, text, text, text, text);
drop function if exists public.public_report_queue(text, text, text);
drop function if exists public.public_report_decide(text, text, uuid, text, text);
drop table if exists public.public_reports;

commit;
