-- =====================================================================
-- M2-B: self-registered restaurants go live — listing basics, submit / withdraw, Admin review,
-- Owner publish / hide.
-- =====================================================================
-- #64 creates managed drafts (review_status 'draft', listing_visibility 'hidden'). Until now nobody
-- could publish them: D2-C refuses Admin publish/hide on managed rows by design. This package adds
-- the managed journey (managed rows only; legacy rows keep D2-C governance):
--
--   draft/rejected --submit--> pending --approve--> approved (still hidden) --publish--> public
--        ^                       |  |                                         <--hide---
--        +------withdraw---------+  +--reject (note required)--> rejected
--
-- 1. Listing basics. Name, location and cuisine are Admin-only paths (B0). A managed restaurant
--    that is not yet approved (draft or rejected) needs its Owner to fill them in, so
--    public.merchant_listing_basics_patch lets the Owner save exactly these three paths through
--    the same field-level compare-and-set (public.merchant_field_patch). The registry marks them
--    Owner-writable only inside that call (transaction-local app.listing_basics = merchant id).
--    After approval they are Admin-only again.
-- 2. public.merchant_listing_apply(owner, merchant, request_id, action)
--      submit    draft/rejected -> pending. Requires name, address, a valid contact method, at
--                least one cuisine tag and a dish in a category. Stores an immutable snapshot of
--                the submitted content. One pending submission per Owner (across restaurants)
--                and a site-wide pending capacity (private.merchant_review_settings); concurrent
--                attempts at the last slot are serialized on the settings row, so exactly one wins.
--      withdraw  pending -> draft; frees the slot.
--      publish   approved + hidden -> public. Rechecks contact and dish. The first publication
--                replaces the server-made `restaurant-<uuid>` slug with one made from the name
--                (numbered on collision), unless something already refers to the old slug.
--      hide      public -> hidden.
--    While pending, the restaurant is frozen for everyone (existing lock rule).
-- 3. public.merchant_review_decide(admin, request_id, submission_id, 'approve'|'reject', note)
--    Approval checks that the restaurant still has exactly the submitted content (hash of the
--    snapshot) and leaves it hidden; rejection needs a note (the Owner sees it) and keeps the draft.
-- 4. public.merchant_review_queue(admin), public.merchant_review_capacity_set(admin, n),
--    public.merchant_listing_read(actor, merchant).
-- 5. public.merchant_notifications: durable records of submit / approve / reject (an outbox; no
--    email is sent by this package, delivered_at stays null).
--
-- Every write is locked (merchant row first), audited by the D1a trigger (operation
-- merchant_listing:<action> / merchant_review:<decision>) and idempotent per request id (7 days).
-- CH confirmed 2026-09-27: pending capacity defaults to 20; pilot total defaults to 50.
-- Approval releases a queue place but retains a pilot place; withdrawal/rejection releases both.
-- Owner profile/contact/menu edits after approval are immediately effective; links remain reviewed.
-- Local first; staging and production each need CH approval, after 20260927120000.
-- Rollback: supabase/rollback/20260927130000_merchant_listing_review.rollback.STAGING_ONLY.sql
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table public.merchant_review_submissions (
  id            uuid        primary key default gen_random_uuid(),
  merchant_id   uuid        not null references public.merchants(id) on delete cascade,
  submitted_by  uuid        not null,
  status        text        not null default 'pending',
  snapshot      jsonb       not null,
  snapshot_hash text        not null,
  created_at    timestamptz not null default now(),
  decided_at    timestamptz,
  review_note   text,
  constraint merchant_review_submissions_status_check check (status in ('pending', 'withdrawn', 'approved', 'rejected')),
  constraint merchant_review_submissions_note_check check (review_note is null or char_length(review_note) <= 1000)
);
create unique index merchant_review_submissions_one_pending_merchant on public.merchant_review_submissions (merchant_id) where status = 'pending';
create unique index merchant_review_submissions_one_pending_owner on public.merchant_review_submissions (submitted_by) where status = 'pending';
create index merchant_review_submissions_queue_idx on public.merchant_review_submissions (status, created_at);
create index merchant_review_submissions_merchant_idx on public.merchant_review_submissions (merchant_id, created_at desc);
alter table public.merchant_review_submissions enable row level security;
revoke all on table public.merchant_review_submissions from public, anon, authenticated, service_role;
grant select, insert, update on table public.merchant_review_submissions to service_role;
comment on table public.merchant_review_submissions is
  'M2-B restaurant review submissions with an immutable content snapshot. Private: no anon/authenticated privileges, RLS on, no policies.';

create table private.merchant_review_settings (
  singleton        boolean     primary key default true check (singleton),
  pending_capacity integer     not null default 20 check (pending_capacity between 0 and 1000),
  pilot_capacity   integer     not null default 50 check (pilot_capacity between 0 and 100000),
  updated_at       timestamptz not null default now()
);
insert into private.merchant_review_settings (singleton) values (true);
alter table private.merchant_review_settings enable row level security;
revoke all on table private.merchant_review_settings from public, anon, authenticated;
grant select, update on table private.merchant_review_settings to service_role;

create table public.merchant_notifications (
  id            uuid        primary key default gen_random_uuid(),
  merchant_id   uuid        not null references public.merchants(id) on delete cascade,
  audience      text        not null,
  kind          text        not null,
  submission_id uuid        references public.merchant_review_submissions(id) on delete set null,
  message       text,
  created_at    timestamptz not null default now(),
  delivered_at  timestamptz,
  constraint merchant_notifications_audience_check check (audience in ('owner', 'admin')),
  constraint merchant_notifications_kind_check check (kind in ('review_submitted', 'review_withdrawn', 'review_approved', 'review_rejected')),
  constraint merchant_notifications_message_check check (message is null or char_length(message) <= 1000)
);
create index merchant_notifications_merchant_idx on public.merchant_notifications (merchant_id, created_at desc);
create index merchant_notifications_undelivered_idx on public.merchant_notifications (created_at) where delivered_at is null;
alter table public.merchant_notifications enable row level security;
revoke all on table public.merchant_notifications from public, anon, authenticated, service_role;
grant select, insert, update on table public.merchant_notifications to service_role;
comment on table public.merchant_notifications is
  'Durable notification records (outbox) for restaurant review events. Nothing is emailed yet; delivered_at stays null. Private.';

-- ---------------------------------------------------------------------
-- 1) Listing basics: Owner-writable only inside merchant_listing_basics_patch
-- ---------------------------------------------------------------------
create or replace function private.merchant_listing_basics_enabled()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('app.listing_basics', true), '') <> ''
$$;

-- Same rows as B0 (20260927094400); only the three listing-basics paths change owner_writable.
create or replace function private.merchant_field_registry()
returns table (path text, kind text, target text, owner_writable boolean, admin_writable boolean, max_length int)
language sql
stable
set search_path = ''
as $$
  values
    ('profile.tagline',      'text',    'tagline',      true,  true,  300),
    ('profile.description',  'text',    'description',  true,  true,  10000),
    ('profile.phone',        'text',    'phone',        true,  true,  40),
    ('profile.whatsapp',     'text',    'whatsapp',     true,  true,  40),
    ('profile.email',        'text',    'email',        true,  true,  254),
    ('profile.website',      'text',    'website',      false, false, null),
    ('profile.instagram',    'text',    'instagram',    false, false, null),
    ('profile.facebook',     'text',    'facebook',     false, false, null),
    ('profile.menu_pdf_url', 'text',    'menu_pdf_url', false, false, null),
    ('hours.mon',            'hours',   'monday',       true,  true,  100),
    ('hours.tue',            'hours',   'tuesday',      true,  true,  100),
    ('hours.wed',            'hours',   'wednesday',    true,  true,  100),
    ('hours.thu',            'hours',   'thursday',     true,  true,  100),
    ('hours.fri',            'hours',   'friday',       true,  true,  100),
    ('hours.sat',            'hours',   'saturday',     true,  true,  100),
    ('hours.sun',            'hours',   'sunday',       true,  true,  100),
    ('features.hero',           'feature', 'hero',           false, true, null),
    ('features.about',          'feature', 'about',          false, true, null),
    ('features.contact',        'feature', 'contact',        false, true, null),
    ('features.gallery',        'feature', 'gallery',        false, true, null),
    ('features.events',         'feature', 'events',         false, true, null),
    ('features.appointment',    'feature', 'appointment',    false, true, null),
    ('features.seasonal_popup', 'feature', 'seasonal_popup', false, true, null),
    ('features.menu',           'feature', 'menu',           false, false, null),
    ('features.reviews',        'feature', 'reviews',        false, false, null),
    ('profile.name',         'text',      'name',      private.merchant_listing_basics_enabled(), true, 160),
    ('presentation.layout',  'layout',    'layout',    false, true, 32),
    ('tags.cuisine',         'tag_array', 'cuisine',   private.merchant_listing_basics_enabled(), true, 3),
    ('tags.amenities',       'tag_array', 'amenities', false, true, 5),
    ('tags.occasion',        'tag_array', 'occasion',  false, true, 3),
    ('location',             'location',  'location',  private.merchant_listing_basics_enabled(), true, null)
$$;

create or replace function public.merchant_listing_basics_patch(
  p_actor_type  text,
  p_actor_id    text,
  p_merchant_id uuid,
  p_request_id  uuid,
  p_patches     jsonb
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  m public.merchants;
  v_result jsonb;
begin
  if p_actor_type is distinct from 'owner' then
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'owner_only');
  end if;
  if jsonb_typeof(p_patches) is distinct from 'array' or jsonb_array_length(p_patches) = 0
     or exists (select 1 from jsonb_array_elements(p_patches) e
                 where jsonb_typeof(e) is distinct from 'object'
                    or coalesce(e ->> 'path', '') not in ('profile.name', 'location', 'tags.cuisine')) then
    perform private.merchant_write_error('VALIDATION_FAILED', 'listing basics are profile.name, location and tags.cuisine');
  end if;
  -- Ownership, suspension/archive and the pending-review freeze, under the merchant lock.
  m := private.lock_merchant_for_actor(p_actor_type, p_actor_id, p_merchant_id, true);
  if m.state_source <> 'managed' or m.review_status not in ('draft', 'rejected') then
    perform private.merchant_write_error('FIELD_NOT_WRITABLE', 'listing_basics_locked');
  end if;
  perform set_config('app.listing_basics', m.id::text, true);
  v_result := public.merchant_field_patch(p_actor_type, p_actor_id, p_merchant_id, p_request_id, p_patches);
  perform set_config('app.listing_basics', '', true);
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------
-- 2) Readiness, snapshot, state
-- ---------------------------------------------------------------------
create or replace function private.merchant_listing_checks(m public.merchants)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'name', coalesce(btrim(m.name), '') <> '',
    'address', coalesce(btrim(m.address), '') <> '',
    'contact', private.merchant_has_valid_contact(m),
    'category', coalesce(cardinality(m.cuisine), 0) > 0,
    'dish', private.merchant_menu_has_minimum(m.id))
$$;

create or replace function private.merchant_listing_ready(m public.merchants)
returns boolean
language sql
stable
set search_path = ''
as $$
  select not exists (select 1 from jsonb_each(private.merchant_listing_checks(m)) c where c.value <> 'true'::jsonb)
$$;

-- What the reviewer approves: everything the public page would show (not the state columns).
create or replace function private.merchant_review_content(m public.merchants)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'name', m.name, 'tagline', m.tagline, 'description', m.description,
    'address', m.address, 'area', m.area, 'latitude', m.latitude, 'longitude', m.longitude,
    'cuisine', to_jsonb(m.cuisine), 'amenities', to_jsonb(m.amenities), 'occasion', to_jsonb(m.occasion),
    'phone', m.phone, 'whatsapp', m.whatsapp, 'email', m.email,
    'website', m.website, 'instagram', m.instagram, 'facebook', m.facebook, 'menuPdfUrl', m.menu_pdf_url,
    'grabfood', private.merchant_link_current(m.id, 'grabfood'),
    'logoImage', m.logo_image, 'coverImage', m.cover_image,
    'operatingHours', m.operating_hours, 'features', m.features, 'layout', m.layout,
    'menu', private.merchant_menu_snapshot(m.id))
$$;

create or replace function private.merchant_review_hash(p_content jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(p_content::text, 'UTF8')), 'hex')
$$;

-- Owner action check: 'ok', 'noop', or why it is refused.
create or replace function private.merchant_listing_check(m public.merchants, p_action text)
returns text
language plpgsql
stable
set search_path = ''
as $$
begin
  if m.state_source <> 'managed' then return 'legacy'; end if;
  if m.platform_restriction = 'archived' then return 'archived'; end if;
  if m.platform_restriction = 'suspended' then return 'suspended'; end if;
  if p_action = 'submit' then
    if m.review_status = 'pending' then return 'noop'; end if;
    if m.review_status = 'approved' then return 'already_approved'; end if;
    if not private.merchant_listing_ready(m) then return 'incomplete'; end if;
    return 'ok';
  elsif p_action = 'withdraw' then
    return case when m.review_status = 'pending' then 'ok' else 'not_pending' end;
  elsif p_action = 'publish' then
    if m.review_status <> 'approved' then return 'not_approved'; end if;
    if m.listing_visibility = 'public' then return 'noop'; end if;
    if m.business_status not in ('OPEN', 'TEMPORARILY_CLOSED') then return 'closed'; end if;
    if not private.merchant_has_valid_contact(m) then return 'contact'; end if;
    if not private.merchant_menu_has_minimum(m.id) then return 'dish'; end if;
    return 'ok';
  elsif p_action = 'hide' then
    if m.review_status <> 'approved' then return 'not_approved'; end if;
    return case when m.listing_visibility = 'public' then 'ok' else 'noop' end;
  end if;
  return null;
end;
$$;

create or replace function private.merchant_listing_state(m public.merchants)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'stateSource', m.state_source,
    'reviewStatus', m.review_status,
    'listingVisibility', m.listing_visibility,
    'restriction', private.merchant_governance_restriction(m),
    'businessStatus', m.business_status,
    'public', private.merchant_is_public(m),
    'slug', m.slug,
    'firstPublishedAt', m.first_published_at,
    'checks', private.merchant_listing_checks(m),
    'basicsEditable', m.state_source = 'managed' and m.review_status in ('draft', 'rejected') and m.platform_restriction = 'none',
    'allowedActions', coalesce((
      select jsonb_agg(a order by ord)
        from unnest(array['submit', 'withdraw', 'publish', 'hide']) with ordinality as t(a, ord)
       where private.merchant_listing_check(m, a) = 'ok'), '[]'::jsonb),
    'pendingSubmission', (
      select jsonb_build_object('id', s.id, 'createdAt', s.created_at)
        from public.merchant_review_submissions s where s.merchant_id = m.id and s.status = 'pending'),
    'lastDecision', (
      select jsonb_build_object('status', s.status, 'note', s.review_note, 'decidedAt', s.decided_at)
        from public.merchant_review_submissions s
       where s.merchant_id = m.id and s.status in ('approved', 'rejected')
       order by s.decided_at desc limit 1))
$$;

-- ---------------------------------------------------------------------
-- 3) Slug for the first publication
-- ---------------------------------------------------------------------
create or replace function private.merchant_slug_base(p_name text, p_id uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when char_length(b) >= 2 then b else 'restaurant-' || left(p_id::text, 8) end
    from (select btrim(left(btrim(regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', '-', 'g'), '-'), 60), '-') as b) x
$$;

-- Whether anything outside public.merchants refers to a slug (so it must not change here).
create or replace function private.merchant_slug_referenced(p_slug text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.articles where merchant_slug = p_slug)
      or exists (select 1 from public.story_submissions where merchant_slug = p_slug)
      or exists (select 1 from public.assisted_content_requests where merchant_slug = p_slug)
      or exists (select 1 from public.merchant_content_cycles where merchant_slug = p_slug)
$$;

create or replace function private.merchant_publication_slug(m public.merchants)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  base text;
  candidate text;
  n int := 1;
begin
  if m.first_published_at is not null or m.slug <> 'restaurant-' || m.id::text or private.merchant_slug_referenced(m.slug) then
    return m.slug;
  end if;
  base := private.merchant_slug_base(m.name, m.id);
  candidate := base;
  while exists (select 1 from public.merchants where slug = candidate and id <> m.id) loop
    n := n + 1;
    if n > 50 then return base || '-' || left(m.id::text, 8); end if;
    candidate := base || '-' || n;
  end loop;
  return candidate;
end;
$$;

-- ---------------------------------------------------------------------
-- 4) Owner: read and act
-- ---------------------------------------------------------------------
create or replace function public.merchant_listing_read(p_actor_type text, p_actor_id text, p_merchant_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  m public.merchants;
begin
  if p_actor_type = 'owner' then
    if p_actor_id is null or p_actor_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      perform private.merchant_write_error('RESOURCE_NOT_FOUND');
    end if;
    select mer.* into m from public.merchants mer
      join public.merchant_memberships mm on mm.merchant_id = mer.id
     where mer.id = p_merchant_id and mm.user_id = p_actor_id::uuid and mm.role = 'owner' and mm.status = 'active';
  elsif p_actor_type = 'admin' and p_actor_id = 'legacy_admin' then
    select * into m from public.merchants where id = p_merchant_id;
  else
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'unknown actor');
  end if;
  if not found then perform private.merchant_write_error('RESOURCE_NOT_FOUND'); end if;
  return jsonb_build_object('revision', m.revision, 'state', private.merchant_listing_state(m));
end;
$$;

create or replace function public.merchant_listing_apply(
  p_actor_type  text,
  p_actor_id    text,
  p_merchant_id uuid,
  p_request_id  uuid,
  p_action      text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_op constant text := 'merchant_listing';
  v_hash text;
  v_prev jsonb;
  v_check text;
  v_content jsonb;
  v_capacity int;
  v_pending int;
  v_pilot_capacity int;
  v_pilot_used int;
  v_slug text;
  v_old_slug text;
  v_submission uuid;
  m public.merchants;
begin
  if p_actor_type is distinct from 'owner' then
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'owner_only');
  end if;
  if p_request_id is null then
    perform private.merchant_write_error('VALIDATION_FAILED', 'request id is required');
  end if;
  if p_action is null or p_action not in ('submit', 'withdraw', 'publish', 'hide') then
    perform private.merchant_write_error('VALIDATION_FAILED', 'unknown action');
  end if;
  v_hash := encode(sha256(convert_to(jsonb_build_object('v', 1, 'op', v_op, 'merchant', p_merchant_id, 'action', p_action)::text, 'UTF8')), 'hex');

  -- Ownership under lock. Not a "write" lock: withdraw must work while pending; each action
  -- checks restriction and review state itself.
  m := private.lock_merchant_for_actor(p_actor_type, p_actor_id, p_merchant_id, false);
  v_prev := private.merchant_link_replay(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash);
  if v_prev is not null then return v_prev; end if;

  v_check := private.merchant_listing_check(m, p_action);
  if v_check = 'incomplete' then
    perform private.merchant_write_error('LISTING_INCOMPLETE', (
      select string_agg(c.key, ',' order by c.key) from jsonb_each(private.merchant_listing_checks(m)) c where c.value <> 'true'::jsonb));
  elsif v_check in ('contact', 'dish') then
    perform private.merchant_write_error('LISTING_INCOMPLETE', v_check);
  elsif v_check = 'suspended' then
    perform private.merchant_write_error('MERCHANT_SUSPENDED');
  elsif v_check not in ('ok', 'noop') then
    perform private.merchant_write_error('LISTING_ACTION_NOT_ALLOWED', v_check);
  end if;

  if v_check = 'noop' then
    return private.merchant_link_remember(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash, 'noop',
      jsonb_build_object('status', 'noop', 'action', p_action, 'slug', m.slug, 'state', private.merchant_listing_state(m)));
  end if;

  perform set_config('app.actor_type', p_actor_type, true);
  perform set_config('app.actor_id', p_actor_id, true);
  perform set_config('app.request_id', p_request_id::text, true);
  perform set_config('app.operation', v_op || ':' || p_action, true);

  if p_action = 'submit' then
    -- One pending submission per Owner: serialize this Owner's submits, then check.
    perform pg_advisory_xact_lock(hashtextextended('merchant_review_owner:' || p_actor_id, 0));
    if exists (select 1 from public.merchant_review_submissions where submitted_by = p_actor_id::uuid and status = 'pending') then
      perform private.merchant_write_error('REVIEW_ONE_PENDING');
    end if;
    -- Site-wide capacity: the settings row serializes every submit, so the last slot has one winner.
    select pending_capacity, pilot_capacity into v_capacity, v_pilot_capacity from private.merchant_review_settings where singleton for update;
    select count(*) into v_pending from public.merchant_review_submissions where status = 'pending';
    if v_pending >= v_capacity then
      perform private.merchant_write_error('REVIEW_CAPACITY_FULL');
    end if;
    -- Separate from the queue limit: pending and approved restaurants reserve a pilot place.
    -- Only managed (self-registered) restaurants count; legacy restaurants never take a place.
    select count(*) into v_pilot_used from public.merchants
      where state_source = 'managed' and review_status in ('pending', 'approved');
    if v_pilot_used >= v_pilot_capacity then
      perform private.merchant_write_error('PILOT_CAPACITY_FULL');
    end if;
    update public.merchants set review_status = 'pending' where id = m.id returning * into m;
    v_content := private.merchant_review_content(m);
    insert into public.merchant_review_submissions (merchant_id, submitted_by, snapshot, snapshot_hash)
    values (m.id, p_actor_id::uuid, v_content, private.merchant_review_hash(v_content))
    returning id into v_submission;
    insert into public.merchant_notifications (merchant_id, audience, kind, submission_id)
    values (m.id, 'admin', 'review_submitted', v_submission);
  elsif p_action = 'withdraw' then
    update public.merchant_review_submissions set status = 'withdrawn', decided_at = now()
     where merchant_id = m.id and status = 'pending'
    returning id into v_submission;
    update public.merchants set review_status = 'draft' where id = m.id returning * into m;
    insert into public.merchant_notifications (merchant_id, audience, kind, submission_id)
    values (m.id, 'admin', 'review_withdrawn', v_submission);
  elsif p_action = 'publish' then
    v_old_slug := m.slug;
    v_slug := private.merchant_publication_slug(m);
    update public.merchants set listing_visibility = 'public', slug = v_slug where id = m.id returning * into m;
  else
    update public.merchants set listing_visibility = 'hidden' where id = m.id returning * into m;
  end if;

  return private.merchant_link_remember(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash, 'applied',
    jsonb_build_object('status', 'applied', 'action', p_action, 'slug', m.slug, 'previousSlug', v_old_slug,
                       'state', private.merchant_listing_state(m)));
end;
$$;

-- ---------------------------------------------------------------------
-- 5) Admin: queue, decision, capacity
-- ---------------------------------------------------------------------
create or replace function public.merchant_review_queue(p_actor_type text, p_actor_id text)
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
  return jsonb_build_object(
    'capacity', (select pending_capacity from private.merchant_review_settings where singleton),
    'pilotCapacity', (select pilot_capacity from private.merchant_review_settings where singleton),
    'pilotUsed', (select count(*) from public.merchants where state_source = 'managed' and review_status in ('pending', 'approved')),
    'pending', (select count(*) from public.merchant_review_submissions where status = 'pending'),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'merchantId', s.merchant_id, 'slug', m.slug, 'createdAt', s.created_at,
               'snapshot', s.snapshot,
               'changed', private.merchant_review_hash(private.merchant_review_content(m)) <> s.snapshot_hash,
               'restriction', private.merchant_governance_restriction(m))
             order by s.created_at)
        from (select * from public.merchant_review_submissions where status = 'pending' order by created_at limit 100) s
        join public.merchants m on m.id = s.merchant_id), '[]'::jsonb));
end;
$$;

create or replace function public.merchant_review_decide(
  p_actor_type    text,
  p_actor_id      text,
  p_request_id    uuid,
  p_submission_id uuid,
  p_decision      text,
  p_note          text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_op constant text := 'merchant_review';
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_hash text;
  v_prev jsonb;
  v_merchant uuid;
  sub public.merchant_review_submissions;
  m public.merchants;
begin
  if p_actor_type is distinct from 'admin' or p_actor_id is distinct from 'legacy_admin' then
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'admin_only');
  end if;
  if p_request_id is null or p_submission_id is null then perform private.merchant_write_error('VALIDATION_FAILED', 'ids are required'); end if;
  if p_decision is null or p_decision not in ('approve', 'reject') then perform private.merchant_write_error('VALIDATION_FAILED', 'unknown decision'); end if;
  if p_decision = 'reject' and v_note is null then perform private.merchant_write_error('VALIDATION_FAILED', 'note_required'); end if;
  if char_length(v_note) > 1000 then perform private.merchant_write_error('VALIDATION_FAILED', 'note_too_long'); end if;

  select merchant_id into v_merchant from public.merchant_review_submissions where id = p_submission_id;
  if not found then perform private.merchant_write_error('RESOURCE_NOT_FOUND', 'submission'); end if;
  -- Merchant row first, then the submission (same order as the Owner actions).
  m := private.lock_merchant_for_actor(p_actor_type, p_actor_id, v_merchant, false);
  v_hash := encode(sha256(convert_to(jsonb_build_object('v', 1, 'op', v_op, 'id', p_submission_id, 'decision', p_decision, 'note', v_note)::text, 'UTF8')), 'hex');
  v_prev := private.merchant_link_replay(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash);
  if v_prev is not null then return v_prev; end if;

  select * into sub from public.merchant_review_submissions where id = p_submission_id for update;
  if sub.status <> 'pending' or m.review_status <> 'pending' then
    perform private.merchant_write_error('VALIDATION_FAILED', 'not_pending');
  end if;
  if m.platform_restriction = 'archived' then
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'archived');
  end if;
  if p_decision = 'approve' and private.merchant_review_hash(private.merchant_review_content(m)) <> sub.snapshot_hash then
    perform private.merchant_write_error('SUBMISSION_CHANGED');
  end if;

  perform set_config('app.actor_type', p_actor_type, true);
  perform set_config('app.actor_id', p_actor_id, true);
  perform set_config('app.request_id', p_request_id::text, true);
  perform set_config('app.operation', v_op || ':' || p_decision, true);
  perform set_config('app.change_reason', coalesce(v_note, ''), true);
  update public.merchants set review_status = case p_decision when 'approve' then 'approved' else 'rejected' end
   where id = m.id returning * into m;
  perform set_config('app.change_reason', '', true);
  update public.merchant_review_submissions
     set status = case p_decision when 'approve' then 'approved' else 'rejected' end, decided_at = now(), review_note = v_note
   where id = sub.id;
  insert into public.merchant_notifications (merchant_id, audience, kind, submission_id, message)
  values (m.id, 'owner', case p_decision when 'approve' then 'review_approved' else 'review_rejected' end, sub.id, v_note);

  return private.merchant_link_remember(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash, 'applied',
    jsonb_build_object('status', 'applied', 'decision', p_decision, 'merchantId', m.id, 'slug', m.slug,
                       'state', private.merchant_listing_state(m)));
end;
$$;

drop function if exists public.merchant_review_capacity_set(text,text,integer);
create or replace function public.merchant_review_capacity_set(p_actor_type text, p_actor_id text, p_capacity int, p_pilot_capacity int default null)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v int;
begin
  if p_actor_type is distinct from 'admin' or p_actor_id is distinct from 'legacy_admin' then
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'admin_only');
  end if;
  if p_capacity is null or p_capacity not between 0 and 1000 then
    perform private.merchant_write_error('VALIDATION_FAILED', 'capacity must be 0..1000');
  end if;
  if p_pilot_capacity is not null and p_pilot_capacity not between 0 and 100000 then
    perform private.merchant_write_error('VALIDATION_FAILED', 'pilot capacity must be 0..100000');
  end if;
  -- Setting a number is naturally idempotent; lowering it never cancels waiting submissions.
  update private.merchant_review_settings set pending_capacity = p_capacity, pilot_capacity = coalesce(p_pilot_capacity, pilot_capacity), updated_at = now()
   where singleton returning pending_capacity into v;
  return jsonb_build_object('capacity', v, 'pilotCapacity', (select pilot_capacity from private.merchant_review_settings where singleton), 'pilotUsed', (select count(*) from public.merchants where state_source = 'managed' and review_status in ('pending', 'approved')), 'pending', (select count(*) from public.merchant_review_submissions where status = 'pending'));
end;
$$;

-- ---------------------------------------------------------------------
-- 6) Grants and self-checks
-- ---------------------------------------------------------------------
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'private.merchant_listing_basics_enabled()',
    'private.merchant_field_registry()',
    'public.merchant_listing_basics_patch(text,text,uuid,uuid,jsonb)',
    'private.merchant_listing_checks(public.merchants)',
    'private.merchant_listing_ready(public.merchants)',
    'private.merchant_review_content(public.merchants)',
    'private.merchant_review_hash(jsonb)',
    'private.merchant_listing_check(public.merchants,text)',
    'private.merchant_listing_state(public.merchants)',
    'private.merchant_slug_base(text,uuid)',
    'private.merchant_slug_referenced(text)',
    'private.merchant_publication_slug(public.merchants)',
    'public.merchant_listing_read(text,text,uuid)',
    'public.merchant_listing_apply(text,text,uuid,uuid,text)',
    'public.merchant_review_queue(text,text)',
    'public.merchant_review_decide(text,text,uuid,uuid,text,text)',
    'public.merchant_review_capacity_set(text,text,integer,integer)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
    if has_function_privilege('anon', fn, 'execute') or has_function_privilege('authenticated', fn, 'execute')
       or not has_function_privilege('service_role', fn, 'execute') then
      raise exception 'M2-B self-check: wrong EXECUTE grants on %', fn;
    end if;
  end loop;
  -- Outside merchant_listing_basics_patch the B0 Admin-only paths stay Admin-only.
  if exists (select 1 from private.merchant_field_registry() where kind in ('layout', 'tag_array', 'location') and owner_writable)
     or exists (select 1 from private.merchant_field_registry() where path = 'profile.name' and owner_writable)
     or (select count(*) from private.merchant_field_registry() where owner_writable) <> 12 then
    raise exception 'M2-B self-check: registry Owner paths changed outside listing basics';
  end if;
  if (select count(*) from private.merchant_review_settings) <> 1 then
    raise exception 'M2-B self-check: exactly one review settings row';
  end if;
  if has_table_privilege('anon', 'public.merchant_review_submissions', 'select') or has_table_privilege('authenticated', 'public.merchant_review_submissions', 'select')
     or has_table_privilege('anon', 'public.merchant_notifications', 'select') or has_table_privilege('authenticated', 'public.merchant_notifications', 'select') then
    raise exception 'M2-B self-check: review tables must be private';
  end if;
end $$;

commit;
