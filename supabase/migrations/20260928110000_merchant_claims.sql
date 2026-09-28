-- =====================================================================
-- Merchant claim: a signed-in account asks to manage an existing public restaurant that has no
-- Owner yet; BiteSite reviews every claim (Master Spec §21, P1; OQ-002 decided for V1 below).
-- =====================================================================
-- V1 verification (Claude under CH delegation, SYNC-062): always Admin-reviewed. The claimant
-- gives their relationship (owner/manager), a contact name and phone, and evidence text (e.g. SSM
-- number, or when BiteSite may call the restaurant's listed phone). The database records whether
-- the account email's domain matches the restaurant website's domain (free-mail domains never
-- match) as a signal for the reviewer only; nothing is approved automatically.
--
--   public.merchant_claim_target(user, slug)       what the claim page shows (current or old slug)
--   public.merchant_claim_submit(user, email, request_id, merchant, relationship, name, phone, evidence)
--       Only public restaurants without an active Owner; one pending claim per account; at most
--       five pending claims per restaurant. Admin is notified (outbox kind claim_submitted).
--   public.merchant_claim_withdraw(user, request_id, claim_id)
--   public.merchant_claims_mine(user)               the account's claims (last 90 days + pending)
--   public.merchant_claim_queue(admin)              pending claims with restaurant contact details
--   public.merchant_claim_decide(admin, request_id, claim_id, 'approve'|'reject', note)
--       Approve: refuses if the restaurant already has an active Owner (CLAIM_OWNER_EXISTS);
--       creates (or reactivates) the Owner membership, writes merchant_membership_audit 'linked',
--       supersedes the restaurant's other pending claims and notifies everyone. Reject needs a note.
--
-- Notification outbox (20260927130000/190000): new kinds claim_submitted / claim_approved /
-- claim_rejected and recipient_user_id, because a claimant is not an Owner (yet or ever);
-- merchant_notification_claim prefers recipient_user_id over the active Owner.
--
-- Writes lock the restaurant row first and are idempotent per request id (7 days).
-- Local first; staging and production each need CH approval, after 20260928100000.
-- Rollback: supabase/rollback/20260928110000_merchant_claims.rollback.STAGING_ONLY.sql
-- =====================================================================
begin;

create table public.merchant_claims (
  id                 uuid        primary key default gen_random_uuid(),
  merchant_id        uuid        not null references public.merchants(id) on delete cascade,
  user_id            uuid        not null references auth.users(id) on delete cascade,
  relationship       text        not null,
  contact_name       text        not null,
  contact_phone      text        not null,
  evidence           text        not null,
  email_domain_match boolean     not null default false,
  status             text        not null default 'pending',
  created_at         timestamptz not null default now(),
  decided_at         timestamptz,
  review_note        text,
  constraint merchant_claims_relationship_check check (relationship in ('owner', 'manager')),
  constraint merchant_claims_name_check check (char_length(contact_name) between 1 and 120),
  constraint merchant_claims_phone_check check (char_length(contact_phone) between 5 and 40),
  constraint merchant_claims_evidence_check check (char_length(evidence) between 10 and 1000),
  constraint merchant_claims_status_check check (status in ('pending', 'approved', 'rejected', 'withdrawn', 'superseded')),
  constraint merchant_claims_note_check check (review_note is null or char_length(review_note) <= 1000)
);
create unique index merchant_claims_one_pending_user on public.merchant_claims (user_id) where status = 'pending';
create index merchant_claims_queue_idx on public.merchant_claims (status, created_at);
create index merchant_claims_merchant_idx on public.merchant_claims (merchant_id, status);
alter table public.merchant_claims enable row level security;
revoke all on table public.merchant_claims from public, anon, authenticated, service_role;
grant select, insert, update on table public.merchant_claims to service_role;
comment on table public.merchant_claims is
  'Requests to manage an existing restaurant, reviewed by Admin. Private: no anon/authenticated privileges, RLS on, no policies.';

-- ---------------------------------------------------------------------
-- Notification outbox: claim kinds and an explicit recipient
-- ---------------------------------------------------------------------
alter table public.merchant_notifications
  add column recipient_user_id uuid references auth.users(id) on delete set null,
  drop constraint merchant_notifications_kind_check,
  add constraint merchant_notifications_kind_check check (kind in (
    'review_submitted', 'review_withdrawn', 'review_approved', 'review_rejected',
    'claim_submitted', 'claim_approved', 'claim_rejected'));

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
           'ownerUserId', coalesce(c.recipient_user_id,
                            (select mm.user_id from public.merchant_memberships mm
                              where mm.merchant_id = c.merchant_id and mm.role = 'owner' and mm.status = 'active' limit 1)))
           order by c.created_at), '[]'::jsonb)
    into v_items
    from claimed c join public.merchants m on m.id = c.merchant_id;
  return v_items;
end;
$$;

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function private.merchant_has_active_owner(p_merchant_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.merchant_memberships
                  where merchant_id = p_merchant_id and role = 'owner' and status = 'active')
$$;

-- 'available', or why this account cannot claim the restaurant now.
create or replace function private.merchant_claim_status(m public.merchants, p_user_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when exists (select 1 from public.merchant_memberships mm
                  where mm.merchant_id = m.id and mm.user_id = p_user_id and mm.role = 'owner' and mm.status = 'active') then 'already_owner'
    when private.merchant_has_active_owner(m.id) then 'managed'
    when not private.merchant_is_public(m) then 'not_public'
    else 'available'
  end
$$;

-- Whether the account email's domain is the restaurant website's domain (never for free mail).
create or replace function private.merchant_claim_domain_match(p_email text, p_website text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  d text := lower(btrim(split_part(coalesce(p_email, ''), '@', 2)));
  h text := lower(substring(coalesce(p_website, '') from '^https?://([^/?#:]+)'));
begin
  if d = '' or h is null or d in ('gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.com.my', 'ymail.com', 'hotmail.com',
                                  'outlook.com', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'proton.me', 'protonmail.com') then
    return false;
  end if;
  h := regexp_replace(h, '^www\.', '');
  return h = d or h like '%.' || d;
end;
$$;

-- ---------------------------------------------------------------------
-- Claimant
-- ---------------------------------------------------------------------
create or replace function public.merchant_claim_target(p_user_id uuid, p_slug text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  m public.merchants;
begin
  if p_user_id is null or p_slug is null then perform private.merchant_write_error('RESOURCE_NOT_FOUND'); end if;
  select * into m from public.merchants where slug = lower(btrim(p_slug));
  if not found then
    select mer.* into m from public.merchant_slug_history h join public.merchants mer on mer.id = h.merchant_id
     where h.old_slug = lower(btrim(p_slug));
  end if;
  -- Hidden restaurants are indistinguishable from missing ones.
  if not found or not private.merchant_is_public(m) then perform private.merchant_write_error('RESOURCE_NOT_FOUND'); end if;
  return jsonb_build_object(
    'merchantId', m.id, 'name', m.name, 'slug', m.slug, 'area', m.area,
    'status', private.merchant_claim_status(m, p_user_id),
    'myPending', (select jsonb_build_object('id', c.id, 'merchantId', c.merchant_id, 'createdAt', c.created_at)
                    from public.merchant_claims c where c.user_id = p_user_id and c.status = 'pending'));
end;
$$;

create or replace function public.merchant_claim_submit(
  p_user_id uuid, p_email text, p_request_id uuid, p_merchant_id uuid,
  p_relationship text, p_contact_name text, p_contact_phone text, p_evidence text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_op constant text := 'merchant_claim_submit';
  v_name text := btrim(coalesce(p_contact_name, ''));
  v_phone text := btrim(coalesce(p_contact_phone, ''));
  v_evidence text := btrim(coalesce(p_evidence, ''));
  v_hash text;
  v_prev jsonb;
  v_status text;
  v_id uuid;
  m public.merchants;
begin
  if p_user_id is null or p_request_id is null then perform private.merchant_write_error('VALIDATION_FAILED', 'ids are required'); end if;
  if p_relationship is null or p_relationship not in ('owner', 'manager') then perform private.merchant_write_error('VALIDATION_FAILED', 'relationship'); end if;
  if char_length(v_name) not between 1 and 120 then perform private.merchant_write_error('VALIDATION_FAILED', 'contact_name'); end if;
  if char_length(v_phone) not between 5 and 40 or v_phone !~ '^\+?[0-9 ()-]+$' then perform private.merchant_write_error('VALIDATION_FAILED', 'contact_phone'); end if;
  if char_length(v_evidence) not between 10 and 1000 then perform private.merchant_write_error('VALIDATION_FAILED', 'evidence'); end if;
  v_hash := encode(sha256(convert_to(jsonb_build_object('v', 1, 'op', v_op, 'merchant', p_merchant_id, 'relationship', p_relationship,
                     'name', v_name, 'phone', v_phone, 'evidence', v_evidence)::text, 'UTF8')), 'hex');

  select * into m from public.merchants where id = p_merchant_id for update;
  if not found then perform private.merchant_write_error('RESOURCE_NOT_FOUND'); end if;
  v_prev := private.merchant_link_replay('owner', p_user_id::text, m.id, v_op, p_request_id, v_hash);
  if v_prev is not null then return v_prev; end if;

  v_status := private.merchant_claim_status(m, p_user_id);
  if v_status = 'not_public' then perform private.merchant_write_error('RESOURCE_NOT_FOUND'); end if;
  if v_status <> 'available' then perform private.merchant_write_error('CLAIM_NOT_AVAILABLE', v_status); end if;
  if exists (select 1 from public.merchant_claims where user_id = p_user_id and status = 'pending') then
    perform private.merchant_write_error('CLAIM_ONE_PENDING');
  end if;
  if (select count(*) from public.merchant_claims where merchant_id = m.id and status = 'pending') >= 5 then
    perform private.merchant_write_error('CLAIM_QUEUE_FULL');
  end if;

  insert into public.merchant_claims (merchant_id, user_id, relationship, contact_name, contact_phone, evidence, email_domain_match)
  values (m.id, p_user_id, p_relationship, v_name, v_phone, v_evidence, private.merchant_claim_domain_match(p_email, m.website))
  returning id into v_id;
  insert into public.merchant_notifications (merchant_id, audience, kind) values (m.id, 'admin', 'claim_submitted');
  return private.merchant_link_remember('owner', p_user_id::text, m.id, v_op, p_request_id, v_hash, 'applied',
    jsonb_build_object('status', 'applied', 'claimId', v_id));
end;
$$;

create or replace function public.merchant_claim_withdraw(p_user_id uuid, p_request_id uuid, p_claim_id uuid)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_op constant text := 'merchant_claim_withdraw';
  v_hash text;
  v_prev jsonb;
  v_merchant uuid;
begin
  if p_user_id is null or p_request_id is null or p_claim_id is null then perform private.merchant_write_error('VALIDATION_FAILED', 'ids are required'); end if;
  select merchant_id into v_merchant from public.merchant_claims where id = p_claim_id and user_id = p_user_id;
  if not found then perform private.merchant_write_error('RESOURCE_NOT_FOUND', 'claim'); end if;
  perform 1 from public.merchants where id = v_merchant for update;
  v_hash := encode(sha256(convert_to(jsonb_build_object('v', 1, 'op', v_op, 'id', p_claim_id)::text, 'UTF8')), 'hex');
  v_prev := private.merchant_link_replay('owner', p_user_id::text, v_merchant, v_op, p_request_id, v_hash);
  if v_prev is not null then return v_prev; end if;
  update public.merchant_claims set status = 'withdrawn', decided_at = now()
   where id = p_claim_id and user_id = p_user_id and status = 'pending';
  if not found then perform private.merchant_write_error('RESOURCE_NOT_FOUND', 'claim'); end if;
  return private.merchant_link_remember('owner', p_user_id::text, v_merchant, v_op, p_request_id, v_hash, 'applied',
    jsonb_build_object('status', 'applied'));
end;
$$;

create or replace function public.merchant_claims_mine(p_user_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'merchantId', c.merchant_id, 'merchantName', m.name, 'slug', m.slug,
           'relationship', c.relationship, 'status', c.status, 'createdAt', c.created_at,
           'decidedAt', c.decided_at, 'reviewNote', c.review_note) order by c.created_at desc), '[]'::jsonb)
    from public.merchant_claims c join public.merchants m on m.id = c.merchant_id
   where c.user_id = p_user_id and (c.status = 'pending' or c.created_at > now() - interval '90 days')
$$;

-- ---------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------
create or replace function public.merchant_claim_queue(p_actor_type text, p_actor_id text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_actor_type is distinct from 'admin' or p_actor_id is distinct from 'legacy_admin' then
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'admin_only');
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', c.id, 'merchantId', c.merchant_id, 'userId', c.user_id,
             'relationship', c.relationship, 'contactName', c.contact_name, 'contactPhone', c.contact_phone,
             'evidence', c.evidence, 'emailDomainMatch', c.email_domain_match, 'createdAt', c.created_at,
             'restaurant', jsonb_build_object('name', m.name, 'slug', m.slug, 'phone', m.phone, 'whatsapp', m.whatsapp,
                                              'email', m.email, 'website', m.website, 'address', m.address, 'area', m.area),
             'ownerExists', private.merchant_has_active_owner(m.id),
             'otherPending', (select count(*) from public.merchant_claims o where o.merchant_id = c.merchant_id and o.status = 'pending' and o.id <> c.id))
             order by c.created_at)
      from (select * from public.merchant_claims where status = 'pending' order by created_at limit 200) c
      join public.merchants m on m.id = c.merchant_id), '[]'::jsonb);
end;
$$;

create or replace function public.merchant_claim_decide(
  p_actor_type text, p_actor_id text, p_request_id uuid, p_claim_id uuid, p_decision text, p_note text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_op constant text := 'merchant_claim_decide';
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_hash text;
  v_prev jsonb;
  v_merchant uuid;
  v_membership uuid;
  other record;
  c public.merchant_claims;
  m public.merchants;
begin
  if p_actor_type is distinct from 'admin' or p_actor_id is distinct from 'legacy_admin' then
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'admin_only');
  end if;
  if p_request_id is null or p_claim_id is null then perform private.merchant_write_error('VALIDATION_FAILED', 'ids are required'); end if;
  if p_decision is null or p_decision not in ('approve', 'reject') then perform private.merchant_write_error('VALIDATION_FAILED', 'unknown decision'); end if;
  if p_decision = 'reject' and v_note is null then perform private.merchant_write_error('VALIDATION_FAILED', 'note_required'); end if;
  if char_length(v_note) > 1000 then perform private.merchant_write_error('VALIDATION_FAILED', 'note_too_long'); end if;

  select merchant_id into v_merchant from public.merchant_claims where id = p_claim_id;
  if not found then perform private.merchant_write_error('RESOURCE_NOT_FOUND', 'claim'); end if;
  -- Lock order as everywhere: merchant row first, then the claim.
  select * into m from public.merchants where id = v_merchant for update;
  v_hash := encode(sha256(convert_to(jsonb_build_object('v', 1, 'op', v_op, 'id', p_claim_id, 'decision', p_decision, 'note', v_note)::text, 'UTF8')), 'hex');
  v_prev := private.merchant_link_replay(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash);
  if v_prev is not null then return v_prev; end if;

  select * into c from public.merchant_claims where id = p_claim_id for update;
  if c.status <> 'pending' then perform private.merchant_write_error('VALIDATION_FAILED', 'not_pending'); end if;

  if p_decision = 'reject' then
    update public.merchant_claims set status = 'rejected', decided_at = now(), review_note = v_note where id = c.id;
    insert into public.merchant_notifications (merchant_id, audience, kind, message, recipient_user_id)
    values (m.id, 'owner', 'claim_rejected', v_note, c.user_id);
    return private.merchant_link_remember(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash, 'applied',
      jsonb_build_object('status', 'applied', 'decision', 'reject'));
  end if;

  if private.merchant_has_active_owner(m.id) then perform private.merchant_write_error('CLAIM_OWNER_EXISTS'); end if;
  if m.platform_restriction = 'archived' or m.platform_status = 'ARCHIVED' then
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'archived');
  end if;

  insert into public.merchant_memberships (merchant_id, user_id, role, status)
  values (m.id, c.user_id, 'owner', 'active')
  on conflict (merchant_id, user_id) do update set status = 'active', role = 'owner'
  returning id into v_membership;
  insert into public.merchant_membership_audit (membership_id, merchant_id, action, previous_user_id, user_id, actor)
  values (v_membership, m.id, 'linked', null, c.user_id, 'admin');
  update public.merchant_claims set status = 'approved', decided_at = now(), review_note = v_note where id = c.id;
  insert into public.merchant_notifications (merchant_id, audience, kind, message, recipient_user_id)
  values (m.id, 'owner', 'claim_approved', v_note, c.user_id);

  for other in
    update public.merchant_claims set status = 'superseded', decided_at = now(),
           review_note = 'Another claim for this restaurant was approved. Contact BiteSite if you think this is wrong.'
     where merchant_id = m.id and status = 'pending'
    returning user_id, review_note
  loop
    insert into public.merchant_notifications (merchant_id, audience, kind, message, recipient_user_id)
    values (m.id, 'owner', 'claim_rejected', other.review_note, other.user_id);
  end loop;

  return private.merchant_link_remember(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash, 'applied',
    jsonb_build_object('status', 'applied', 'decision', 'approve', 'membershipId', v_membership));
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.merchant_claim_target(uuid,text)',
    'public.merchant_claim_submit(uuid,text,uuid,uuid,text,text,text,text)',
    'public.merchant_claim_withdraw(uuid,uuid,uuid)',
    'public.merchant_claims_mine(uuid)',
    'public.merchant_claim_queue(text,text)',
    'public.merchant_claim_decide(text,text,uuid,uuid,text,text)',
    'public.merchant_notification_claim(int)',
    'private.merchant_has_active_owner(uuid)',
    'private.merchant_claim_status(public.merchants,uuid)',
    'private.merchant_claim_domain_match(text,text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
    if has_function_privilege('anon', fn, 'execute') or has_function_privilege('authenticated', fn, 'execute') then
      raise exception 'Claim self-check: wrong EXECUTE grants on %', fn;
    end if;
  end loop;
end $$;

commit;
