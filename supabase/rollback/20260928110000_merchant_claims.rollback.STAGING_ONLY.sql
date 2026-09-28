-- =====================================================================
-- ROLLBACK of 20260928110000_merchant_claims.sql — STAGING ONLY.
-- =====================================================================
-- Drops the claim RPCs, helpers and table (claim history is lost; export it first if it
-- matters). Memberships created by approved claims are KEPT. Claim notification rows are deleted
-- (the old kind constraint does not allow them), recipient_user_id is dropped and
-- merchant_notification_claim is restored to the 20260927190000 version. Roll the application
-- back first (claim page, Admin Claims page, delivery templates).
-- =====================================================================
begin;

do $$
begin
  if 'NO' <> 'yes' then  -- change 'NO' to 'yes' to allow this rollback
    raise exception 'Rollback switch is off. Edit the script deliberately if you really mean it.';
  end if;
end $$;

drop function if exists public.merchant_claim_target(uuid, text);
drop function if exists public.merchant_claim_submit(uuid, text, uuid, uuid, text, text, text, text);
drop function if exists public.merchant_claim_withdraw(uuid, uuid, uuid);
drop function if exists public.merchant_claims_mine(uuid);
drop function if exists public.merchant_claim_queue(text, text);
drop function if exists public.merchant_claim_decide(text, text, uuid, uuid, text, text);
drop function if exists private.merchant_claim_status(public.merchants, uuid);
drop function if exists private.merchant_claim_domain_match(text, text);
drop function if exists private.merchant_has_active_owner(uuid);
drop table if exists public.merchant_claims;

delete from public.merchant_notifications where kind like 'claim_%';
alter table public.merchant_notifications
  drop constraint merchant_notifications_kind_check,
  add constraint merchant_notifications_kind_check check (kind in ('review_submitted', 'review_withdrawn', 'review_approved', 'review_rejected')),
  drop column if exists recipient_user_id;

create or replace function public.merchant_notification_claim(p_limit int)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_items jsonb;
begin
  if p_limit is null or p_limit not between 1 and 50 then
    perform private.merchant_write_error('VALIDATION_FAILED', 'limit must be 1..50');
  end if;
  with picked as (
    select n.id from public.merchant_notifications n
     where n.delivered_at is null and n.attempts < 5 and (n.claimed_until is null or n.claimed_until < now())
     order by n.created_at
     limit p_limit
     for update skip locked
  ), claimed as (
    update public.merchant_notifications n
       set claimed_until = now() + interval '5 minutes', attempts = n.attempts + 1
      from picked where n.id = picked.id
    returning n.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'merchantId', c.merchant_id, 'audience', c.audience, 'kind', c.kind, 'message', c.message,
           'attempts', c.attempts, 'createdAt', c.created_at, 'merchantName', m.name, 'slug', m.slug,
           'ownerUserId', (select mm.user_id from public.merchant_memberships mm
                            where mm.merchant_id = c.merchant_id and mm.role = 'owner' and mm.status = 'active' limit 1))
           order by c.created_at), '[]'::jsonb)
    into v_items
    from claimed c join public.merchants m on m.id = c.merchant_id;
  return v_items;
end;
$$;
revoke all on function public.merchant_notification_claim(int) from public, anon, authenticated;
grant execute on function public.merchant_notification_claim(int) to service_role;

commit;
