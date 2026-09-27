-- ROLLBACK of 20260927200000_merchant_owner_stats.sql - STAGING ONLY. Read-only feature; no data changes.
begin;
do $$ begin
  if 'NO' <> 'yes' then
    raise exception 'Rollback switch is off. Edit deliberately to allow this rollback.';
  end if;
end $$;
drop function if exists public.merchant_stats_read(text, text, uuid, integer);
drop index if exists public.page_views_slug_created_idx;
commit;
