-- =====================================================================
-- FoodStraits D1a: merchant state foundation (master spec 2026-09-26 §5, §7.2–7.4)
-- =====================================================================
-- Additive. One transaction with self-checks at the end: if any check fails,
-- nothing is changed.
--
-- 1. merchants gets the canonical state dimensions (review / visibility /
--    platform restriction), revision + updated_at, first_published_at and a
--    compatibility marker `state_source`.
--      * 'legacy'  – every row that exists today, and (until M2 switches the
--                    default) rows created by the current Admin CRUD. Their
--                    is_published / platform_status stay the source of truth,
--                    so nothing is published or unpublished by this migration.
--      * 'managed' – rows driven by the new state machine. Their
--                    is_published / platform_status are derived mirrors and
--                    cannot be written directly.
--    Moving a row from legacy to managed is a separate, per-merchant,
--    CH-approved operation. It is never done here, and an ordinary UPDATE
--    cannot do it: only private.convert_merchant_to_managed(), which only the
--    database owner may run, writes the one-time ticket the trigger requires.
-- 2. private.merchant_is_public(merchants) is the single public predicate.
--    Legacy rows are no longer public while SUSPENDED or ARCHIVED (AUD-04).
-- 3. Every public read policy (merchants, categories, products, videos,
--    external links, events) uses that predicate. merchant_stats is no longer
--    publicly readable (DEC-29).
-- 4. public.merchant_change_log records state changes (table in schema public;
--    no anon/authenticated privileges, RLS on without policies; service_role only).
-- 5. At most one active owner per merchant.
--
-- Staging first; production only after CTO review and explicit CH approval.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0) Preconditions: refuse rather than silently fix existing data
-- ---------------------------------------------------------------------
do $$
declare
  dupes text;
begin
  select string_agg(merchant_id::text, ', ')
    into dupes
    from (
      select merchant_id
        from public.merchant_memberships
       where role = 'owner' and status = 'active'
       group by merchant_id
      having count(*) > 1
    ) d;
  if dupes is not null then
    raise exception 'D1a: merchants with more than one active owner must be resolved first: %', dupes;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1) Canonical state columns
-- ---------------------------------------------------------------------
alter table public.merchants
  add column review_status        text        not null default 'draft',
  add column listing_visibility   text        not null default 'hidden',
  add column platform_restriction text        not null default 'none',
  add column state_source         text        not null default 'legacy',
  add column revision             bigint      not null default 0,
  add column updated_at           timestamptz not null default now(),
  add column first_published_at   timestamptz;

alter table public.merchants
  add constraint merchants_review_status_check
    check (review_status in ('draft', 'pending', 'rejected', 'approved')),
  add constraint merchants_listing_visibility_check
    check (listing_visibility in ('hidden', 'public')),
  add constraint merchants_platform_restriction_check
    check (platform_restriction in ('none', 'suspended', 'archived')),
  add constraint merchants_state_source_check
    check (state_source in ('legacy', 'managed')),
  add constraint merchants_revision_nonnegative
    check (revision >= 0);

comment on column public.merchants.review_status is
  'Canonical review state (managed rows): draft / pending / rejected / approved. Approval never publishes by itself.';
comment on column public.merchants.listing_visibility is
  'Canonical owner visibility (managed rows): hidden / public.';
comment on column public.merchants.platform_restriction is
  'Canonical platform governance (managed rows): none / suspended / archived. Only Admin changes it.';
comment on column public.merchants.state_source is
  'legacy: is_published/platform_status are the source of truth (compatibility window). managed: they are derived mirrors of the canonical columns.';
comment on column public.merchants.revision is
  'Incremented by trigger on every update that changes data.';

-- ---------------------------------------------------------------------
-- 2) The single public predicate (schema private: not exposed as a PostgREST RPC)
-- ---------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.merchant_is_public(m public.merchants)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when m.state_source = 'legacy' then
      coalesce(m.is_published, false)
      and coalesce(m.platform_status, 'DRAFT') not in ('SUSPENDED', 'ARCHIVED')
    else
      m.review_status = 'approved'
      and m.listing_visibility = 'public'
      and m.platform_restriction = 'none'
      and m.business_status in ('OPEN', 'TEMPORARILY_CLOSED')
  end;
$$;

comment on function private.merchant_is_public(public.merchants) is
  'Whether a merchant row may be shown publicly. Used by every public RLS policy; server code must use the same rule.';

revoke all on function private.merchant_is_public(public.merchants) from public;
grant execute on function private.merchant_is_public(public.merchants) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3) Audit log (schema public, closed to anon/authenticated by revoke + RLS)
-- ---------------------------------------------------------------------
create table public.merchant_change_log (
  id            uuid        primary key default gen_random_uuid(),
  merchant_id   uuid        not null references public.merchants(id) on delete cascade,
  actor_type    text        not null default 'unknown',
  actor_id      text,
  action        text        not null,
  changed_paths text[]      not null default '{}',
  before        jsonb,
  after         jsonb,
  revision      bigint      not null,
  reason        text,
  created_at    timestamptz not null default now(),
  constraint merchant_change_log_actor_type_check
    check (actor_type in ('owner', 'admin', 'system', 'unknown')),
  constraint merchant_change_log_action_check
    check (action in ('insert', 'update')),
  constraint merchant_change_log_reason_length
    check (reason is null or char_length(reason) <= 1000)
);

create index merchant_change_log_merchant_created_idx
  on public.merchant_change_log (merchant_id, created_at desc);

alter table public.merchant_change_log enable row level security;
revoke all on table public.merchant_change_log from anon, authenticated;
grant select, insert on table public.merchant_change_log to service_role;

comment on table public.merchant_change_log is
  'Private audit of merchant changes (public schema; no anon/authenticated privileges, RLS on, no policies). before/after hold only state fields; changed_paths lists every changed column name. No secrets or tokens.';
comment on column public.merchant_change_log.reason is
  'Why the change was made, when the operation supplies one (e.g. the approved legacy-to-managed mapping). Audit metadata only, never an authorization.';

-- ---------------------------------------------------------------------
-- 3b) legacy -> managed conversion tickets
-- ---------------------------------------------------------------------
-- The before-write trigger lets a row change from legacy to managed only when
-- a ticket for this transaction, this merchant and exactly this state exists.
-- Tickets are written only by private.convert_merchant_to_managed() and are
-- consumed by the trigger, so they never outlive the transaction. No API role
-- can read or write them.
create table private.merchant_state_conversion_tickets (
  txid                 xid8 not null,
  merchant_id          uuid not null,
  review_status        text not null,
  listing_visibility   text not null,
  platform_restriction text not null,
  business_status      text not null,
  primary key (txid, merchant_id)
);
alter table private.merchant_state_conversion_tickets enable row level security;
revoke all on table private.merchant_state_conversion_tickets from public, anon, authenticated, service_role;

-- Consumes the matching ticket. Called by the trigger as the writing role, so service_role may
-- execute it; it can only remove a ticket, never create one.
create or replace function private.take_state_conversion_ticket(
  p_merchant_id uuid,
  p_review_status text,
  p_listing_visibility text,
  p_platform_restriction text,
  p_business_status text
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with taken as (
    delete from private.merchant_state_conversion_tickets t
     where t.txid = pg_current_xact_id()
       and t.merchant_id = p_merchant_id
       and t.review_status = p_review_status
       and t.listing_visibility = p_listing_visibility
       and t.platform_restriction = p_platform_restriction
       and t.business_status = p_business_status
    returning 1
  )
  select exists (select 1 from taken);
$$;

revoke all on function private.take_state_conversion_ticket(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function private.take_state_conversion_ticket(uuid, text, text, text, text) to service_role;

-- ---------------------------------------------------------------------
-- 4) Triggers: revision / updated_at, managed-state mirrors, audit
-- ---------------------------------------------------------------------
create or replace function private.merchants_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  derived_platform_status text;
  derived_public boolean;
begin
  if tg_op = 'UPDATE' then
    if old.state_source = 'managed' and new.state_source = 'legacy' then
      raise exception 'STATE_SOURCE_DOWNGRADE: a managed merchant cannot return to legacy state'
        using errcode = 'P0001';
    end if;
    if old.state_source = 'legacy' and new.state_source = 'managed'
       and not private.take_state_conversion_ticket(new.id, new.review_status, new.listing_visibility,
                                                    new.platform_restriction, new.business_status) then
      raise exception 'STATE_SOURCE_CONVERSION_FORBIDDEN: use private.convert_merchant_to_managed with an approved per-merchant state'
        using errcode = 'P0001';
    end if;

    -- revision and updated_at are server-owned; ignore client values.
    if (to_jsonb(new) - 'revision' - 'updated_at') is distinct from (to_jsonb(old) - 'revision' - 'updated_at') then
      new.revision   := old.revision + 1;
      new.updated_at := now();
    else
      new.revision   := old.revision;
      new.updated_at := old.updated_at;
    end if;
  else
    new.revision   := 0;
    new.updated_at := now();
  end if;

  if new.state_source = 'managed' then
    derived_platform_status := case
      when new.platform_restriction = 'suspended' then 'SUSPENDED'
      when new.platform_restriction = 'archived'  then 'ARCHIVED'
      when new.review_status = 'pending'  then 'PENDING_REVIEW'
      when new.review_status = 'approved' then 'PUBLISHED'
      else 'DRAFT'
    end;
    derived_public := private.merchant_is_public(new);

    -- Direct writes of the legacy mirrors are refused on managed rows.
    if tg_op = 'UPDATE' and (
         (new.is_published is distinct from old.is_published and new.is_published is distinct from derived_public)
      or (new.platform_status is distinct from old.platform_status and new.platform_status is distinct from derived_platform_status)
    ) then
      raise exception 'LEGACY_STATE_WRITE_FORBIDDEN: is_published and platform_status are derived for managed merchants'
        using errcode = 'P0001';
    end if;
    -- On INSERT the column defaults (is_published=false, platform_status='DRAFT') cannot be told
    -- apart from explicit values, so only an attempt to claim a more public state is refused.
    if tg_op = 'INSERT' and (
         (new.is_published is true and not derived_public)
      or (new.platform_status is distinct from 'DRAFT' and new.platform_status is distinct from derived_platform_status)
    ) then
      raise exception 'LEGACY_STATE_WRITE_FORBIDDEN: is_published and platform_status are derived for managed merchants'
        using errcode = 'P0001';
    end if;

    new.platform_status := derived_platform_status;
    new.is_published    := derived_public;
    if derived_public and new.first_published_at is null then
      new.first_published_at := now();
    end if;
  end if;

  return new;
end;
$$;

create trigger merchants_before_write
  before insert or update on public.merchants
  for each row execute function private.merchants_before_write();

create or replace function private.merchants_after_write_audit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  state_keys constant text[] := array[
    'review_status', 'listing_visibility', 'platform_restriction', 'business_status',
    'state_source', 'is_published', 'platform_status', 'first_published_at'
  ];
  old_json jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
  new_json jsonb := to_jsonb(new);
  paths text[];
  actor text := coalesce(nullif(current_setting('app.actor_type', true), ''), 'unknown');
begin
  if actor not in ('owner', 'admin', 'system', 'unknown') then
    actor := 'unknown';
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(k order by k), '{}')
      into paths
      from jsonb_object_keys(new_json) k
     where k not in ('revision', 'updated_at')
       and new_json -> k is distinct from old_json -> k;
    if cardinality(paths) = 0 then
      return null;
    end if;
  else
    paths := '{}';
  end if;

  insert into public.merchant_change_log
    (merchant_id, actor_type, actor_id, action, changed_paths, before, after, revision, reason)
  values (
    new.id,
    actor,
    nullif(current_setting('app.actor_id', true), ''),
    lower(tg_op),
    paths,
    case when tg_op = 'UPDATE' then
      (select coalesce(jsonb_object_agg(k, old_json -> k), '{}') from unnest(state_keys) k)
    end,
    (select coalesce(jsonb_object_agg(k, new_json -> k), '{}') from unnest(state_keys) k),
    new.revision,
    left(nullif(current_setting('app.change_reason', true), ''), 1000)
  );
  return null;
end;
$$;

create trigger merchants_after_write_audit
  after insert or update on public.merchants
  for each row execute function private.merchants_after_write_audit();

revoke all on function private.merchants_before_write() from public, anon, authenticated, service_role;
revoke all on function private.merchants_after_write_audit() from public, anon, authenticated, service_role;

-- The only way to move a row from legacy to managed. One call per merchant, with the complete
-- approved state, the revision it was approved against, who approved it and why. Executable by
-- the database owner only (a CH-approved operation), never by the application roles.
create or replace function private.convert_merchant_to_managed(
  p_merchant_id uuid,
  p_expected_revision bigint,
  p_review_status text,
  p_listing_visibility text,
  p_platform_restriction text,
  p_business_status text,
  p_actor_id text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row public.merchants;
  converted public.merchants;
  prev_actor_type text := coalesce(current_setting('app.actor_type', true), '');
  prev_actor_id text := coalesce(current_setting('app.actor_id', true), '');
  prev_reason text := coalesce(current_setting('app.change_reason', true), '');
begin
  if p_merchant_id is null or p_expected_revision is null
     or p_review_status is null or p_listing_visibility is null
     or p_platform_restriction is null or p_business_status is null
     or nullif(btrim(p_actor_id), '') is null or nullif(btrim(p_reason), '') is null then
    raise exception 'STATE_CONVERSION_INVALID: merchant, expected revision, the complete state, actor and reason are all required'
      using errcode = 'P0001';
  end if;
  if p_review_status not in ('draft', 'pending', 'rejected', 'approved')
     or p_listing_visibility not in ('hidden', 'public')
     or p_platform_restriction not in ('none', 'suspended', 'archived')
     or p_business_status not in ('OPEN', 'TEMPORARILY_CLOSED', 'MOVED', 'PERMANENTLY_CLOSED')
     or char_length(p_actor_id) > 200 or char_length(p_reason) > 1000 then
    raise exception 'STATE_CONVERSION_INVALID: unknown state value or over-long actor/reason'
      using errcode = 'P0001';
  end if;

  select * into current_row from public.merchants where id = p_merchant_id for update;
  if not found then
    raise exception 'STATE_CONVERSION_NOT_FOUND: merchant % does not exist', p_merchant_id using errcode = 'P0001';
  end if;
  if current_row.state_source <> 'legacy' then
    raise exception 'STATE_CONVERSION_NOT_LEGACY: merchant % is already managed', p_merchant_id using errcode = 'P0001';
  end if;
  if current_row.revision <> p_expected_revision then
    raise exception 'STATE_CONVERSION_REVISION_CONFLICT: merchant % is at revision %, not %',
      p_merchant_id, current_row.revision, p_expected_revision using errcode = 'P0001';
  end if;

  insert into private.merchant_state_conversion_tickets
    (txid, merchant_id, review_status, listing_visibility, platform_restriction, business_status)
  values (pg_current_xact_id(), p_merchant_id, p_review_status, p_listing_visibility, p_platform_restriction, p_business_status);

  perform set_config('app.actor_type', 'admin', true);
  perform set_config('app.actor_id', btrim(p_actor_id), true);
  perform set_config('app.change_reason', btrim(p_reason), true);

  update public.merchants
     set state_source         = 'managed',
         review_status        = p_review_status,
         listing_visibility   = p_listing_visibility,
         platform_restriction = p_platform_restriction,
         business_status      = p_business_status
   where id = p_merchant_id
  returning * into converted;

  perform set_config('app.actor_type', prev_actor_type, true);
  perform set_config('app.actor_id', prev_actor_id, true);
  perform set_config('app.change_reason', prev_reason, true);

  if exists (select 1 from private.merchant_state_conversion_tickets where txid = pg_current_xact_id()) then
    raise exception 'STATE_CONVERSION_INVALID: the conversion ticket was not consumed' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'merchant_id', converted.id,
    'revision', converted.revision,
    'is_published', converted.is_published,
    'platform_status', converted.platform_status
  );
end;
$$;

revoke all on function private.convert_merchant_to_managed(uuid, bigint, text, text, text, text, text, text)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5) One active owner per merchant
-- ---------------------------------------------------------------------
create unique index merchant_memberships_one_active_owner
  on public.merchant_memberships (merchant_id)
  where role = 'owner' and status = 'active';

-- ---------------------------------------------------------------------
-- 6) Public read policies use the shared predicate
-- ---------------------------------------------------------------------
drop policy if exists pub_read_merchants on public.merchants;
create policy pub_read_merchants on public.merchants
  for select to anon, authenticated
  using (private.merchant_is_public(merchants));

drop policy if exists pub_read_categories on public.categories;
create policy pub_read_categories on public.categories
  for select to anon, authenticated
  using (exists (
    select 1 from public.merchants m
     where m.id = categories.merchant_id and private.merchant_is_public(m)
  ));

drop policy if exists pub_read_products on public.products;
create policy pub_read_products on public.products
  for select to anon, authenticated
  using (exists (
    select 1 from public.merchants m
     where m.id = products.merchant_id and private.merchant_is_public(m)
  ));

drop policy if exists pub_read_merchant_videos on public.merchant_videos;
create policy pub_read_merchant_videos on public.merchant_videos
  for select to anon, authenticated
  using (exists (
    select 1 from public.merchants m
     where m.id = merchant_videos.merchant_id and private.merchant_is_public(m)
  ));

drop policy if exists merchant_external_links_public_read on public.merchant_external_links;
create policy merchant_external_links_public_read on public.merchant_external_links
  for select to anon, authenticated
  using (
    is_active = true
    and link_type = 'grabfood'
    and exists (
      select 1 from public.merchants m
       where m.id = merchant_external_links.merchant_id and private.merchant_is_public(m)
    )
  );

drop policy if exists "Allow public read" on public.events;
drop policy if exists pub_read_events on public.events;
create policy pub_read_events on public.events
  for select to anon, authenticated
  using (exists (
    select 1 from public.merchants m
     where m.id = events.merchant_id and private.merchant_is_public(m)
  ));

-- View counts are private (DEC-29). /api/view and /api/track write with service_role.
drop policy if exists pub_read_merchant_stats on public.merchant_stats;
revoke select on table public.merchant_stats from anon, authenticated;

-- ---------------------------------------------------------------------
-- 7) Backfill: every existing row stays legacy; nothing is published or hidden
-- ---------------------------------------------------------------------
-- The column default already set state_source = 'legacy' for existing rows.
-- The canonical columns keep their conservative defaults until a separate,
-- CH-approved mapping moves a row to managed.

-- ---------------------------------------------------------------------
-- 8) Self-checks
-- ---------------------------------------------------------------------
do $$
declare
  missing text;
begin
  if exists (select 1 from public.merchants where state_source <> 'legacy') then
    raise exception 'D1a self-check: existing rows must all start as legacy';
  end if;

  select string_agg(p, ', ') into missing
    from unnest(array[
      'merchants.pub_read_merchants', 'categories.pub_read_categories', 'products.pub_read_products',
      'merchant_videos.pub_read_merchant_videos', 'merchant_external_links.merchant_external_links_public_read',
      'events.pub_read_events'
    ]) p
   where not exists (
     select 1 from pg_policies
      where schemaname = 'public'
        and tablename = split_part(p, '.', 1)
        and policyname = split_part(p, '.', 2)
        and qual like '%private.merchant_is_public%'
   );
  if missing is not null then
    raise exception 'D1a self-check: policies not using merchant_is_public: %', missing;
  end if;

  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'events' and qual = 'true') then
    raise exception 'D1a self-check: events still has an unconditional read policy';
  end if;
  if has_table_privilege('anon', 'public.merchant_stats', 'SELECT')
     or has_table_privilege('authenticated', 'public.merchant_stats', 'SELECT') then
    raise exception 'D1a self-check: merchant_stats is still publicly readable';
  end if;
  if has_table_privilege('anon', 'public.merchant_change_log', 'SELECT')
     or has_table_privilege('authenticated', 'public.merchant_change_log', 'SELECT') then
    raise exception 'D1a self-check: merchant_change_log must be private';
  end if;
  if to_regclass('public.merchant_memberships_one_active_owner') is null then
    raise exception 'D1a self-check: one-active-owner index missing';
  end if;
  if exists (select 1 from private.merchant_state_conversion_tickets) then
    raise exception 'D1a self-check: no conversion ticket may exist after the migration';
  end if;
  if has_function_privilege('service_role', 'private.convert_merchant_to_managed(uuid, bigint, text, text, text, text, text, text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.convert_merchant_to_managed(uuid, bigint, text, text, text, text, text, text)', 'EXECUTE')
     or has_function_privilege('anon', 'private.convert_merchant_to_managed(uuid, bigint, text, text, text, text, text, text)', 'EXECUTE') then
    raise exception 'D1a self-check: application roles must not be able to convert merchants';
  end if;
end $$;

commit;
