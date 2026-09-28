-- =====================================================================
-- ROLLBACK of 20260928090000_merchant_basics_requests.sql — STAGING ONLY.
-- =====================================================================
-- Drops the basics request RPCs, helpers and the request table (request history is lost; export
-- it first if it matters). Changes already approved stay on the restaurants. Roll the application
-- back first (the Owner basics request form and the Admin change-request queue call these RPCs).
-- =====================================================================
begin;

do $$
begin
  if 'NO' <> 'yes' then  -- change 'NO' to 'yes' to allow this rollback
    raise exception 'Rollback switch is off. Edit the script deliberately if you really mean it.';
  end if;
end $$;

drop function if exists public.merchant_basics_request_submit(text, text, uuid, uuid, jsonb);
drop function if exists public.merchant_basics_request_withdraw(text, text, uuid, uuid, uuid);
drop function if exists public.merchant_basics_review(text, text, uuid, uuid, text, text);
drop function if exists public.merchant_basics_read(text, text, uuid);
drop function if exists public.merchant_basics_queue(text, text);
drop function if exists private.merchant_basics_changes_public(jsonb);
drop function if exists private.merchant_basics_public(jsonb);
drop function if exists private.merchant_basics_proposal(public.merchants, jsonb);
drop function if exists private.merchant_basics_requestable(public.merchants);
drop function if exists private.merchant_basics_snapshot(public.merchants);
drop table if exists public.merchant_basics_requests;

commit;
