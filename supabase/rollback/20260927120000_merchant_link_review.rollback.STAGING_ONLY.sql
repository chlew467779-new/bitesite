-- =====================================================================
-- ROLLBACK of 20260927120000_merchant_link_review.sql — STAGING ONLY.
-- =====================================================================
-- Drops the link review RPCs, helpers and the request table (request history is lost; export it
-- first if it matters). Links already applied to restaurants are kept. Roll the application back
-- first (the Link Reviews page and link controls call these RPCs).
-- =====================================================================
begin;

do $$
begin
  if 'NO' <> 'yes' then  -- change 'NO' to 'yes' to allow this rollback
    raise exception 'Rollback switch is off. Edit the script deliberately if you really mean it.';
  end if;
end $$;

drop function if exists public.merchant_link_request_submit(text, text, uuid, uuid, text, text);
drop function if exists public.merchant_link_request_withdraw(text, text, uuid, uuid, uuid);
drop function if exists public.merchant_link_review(text, text, uuid, uuid, text, text);
drop function if exists public.merchant_link_admin_set(text, text, uuid, uuid, text, text, text);
drop function if exists public.merchant_links_read(text, text, uuid);
drop function if exists public.merchant_link_queue(text, text);
drop function if exists private.merchant_link_remember(text, text, uuid, text, uuid, text, text, jsonb);
drop function if exists private.merchant_link_replay(text, text, uuid, text, uuid, text);
drop function if exists private.merchant_link_check(text, text);
drop function if exists private.merchant_link_apply(uuid, text, text);
drop function if exists private.merchant_link_current(uuid, text);
drop function if exists private.merchant_link_problem(text, text);
drop table if exists public.merchant_link_requests;

commit;
