-- =====================================================================
-- FoodStraits D1b: column-level public projection of merchants
-- (master spec 2026-09-26 §7.4, §11; builds on D1a 20260926093811)
-- =====================================================================
-- One transaction with self-checks at the end: if any check fails, nothing
-- is changed.
--
-- 1. anon / authenticated lose table-wide SELECT on merchants and get SELECT
--    on an explicit list of public columns only. Legacy reviews, settings,
--    style internals and every state / review / audit column stay private.
--    Columns added later are private until a migration grants them.
-- 2. With column grants, a policy on a child table can no longer read the
--    parent merchants row as the caller. The child policies therefore call
--    private.merchant_id_is_public(merchant_id), a SECURITY DEFINER wrapper
--    around the same D1a predicate that returns only a boolean.
--
-- Deploy order: the application code that stops using select("*") and the
-- is_published filter on public reads must be live BEFORE this migration,
-- otherwise public pages fail with "permission denied".
--
-- Staging first; production only after CTO review and explicit CH approval.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) Parent predicate by id, for child-table policies
-- ---------------------------------------------------------------------
-- SECURITY DEFINER is required: the caller can no longer read the whole
-- merchants row. The function returns a boolean only, takes no text input,
-- fixes search_path and is not exposed as an RPC (schema private).
create or replace function private.merchant_id_is_public(p_merchant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select private.merchant_is_public(m) from public.merchants m where m.id = p_merchant_id),
    false
  );
$$;

comment on function private.merchant_id_is_public(uuid) is
  'Whether the merchant with this id may be shown publicly (same rule as private.merchant_is_public). For child-table RLS policies.';

revoke all on function private.merchant_id_is_public(uuid) from public;
grant execute on function private.merchant_id_is_public(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2) Child-table public policies use the id predicate
-- ---------------------------------------------------------------------
drop policy if exists pub_read_categories on public.categories;
create policy pub_read_categories on public.categories
  for select to anon, authenticated
  using (private.merchant_id_is_public(merchant_id));

drop policy if exists pub_read_products on public.products;
create policy pub_read_products on public.products
  for select to anon, authenticated
  using (private.merchant_id_is_public(merchant_id));

drop policy if exists pub_read_merchant_videos on public.merchant_videos;
create policy pub_read_merchant_videos on public.merchant_videos
  for select to anon, authenticated
  using (private.merchant_id_is_public(merchant_id));

drop policy if exists merchant_external_links_public_read on public.merchant_external_links;
create policy merchant_external_links_public_read on public.merchant_external_links
  for select to anon, authenticated
  using (
    is_active = true
    and link_type = 'grabfood'
    and private.merchant_id_is_public(merchant_id)
  );

drop policy if exists pub_read_events on public.events;
create policy pub_read_events on public.events
  for select to anon, authenticated
  using (private.merchant_id_is_public(merchant_id));

-- ---------------------------------------------------------------------
-- 3) Column-level SELECT on merchants
-- ---------------------------------------------------------------------
-- Keep this list identical to PUBLIC_MERCHANT_COLUMNS in
-- lib/public-merchant-projection.mjs (scripts/test-merchant-public-projection.mjs
-- checks it).
revoke select on table public.merchants from anon, authenticated;

grant select (
  id, slug, name, tagline, description,
  cuisine_type, cuisine, amenities, occasion, tags, area,
  address, latitude, longitude,
  phone, whatsapp, email, website, instagram, facebook,
  cover_image, logo_image, operating_hours, dress_code, menu_pdf_url,
  video_url, video_type, video_caption, payment_methods,
  layout, features, status, business_status,
  created_at, updated_at
) on table public.merchants to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4) Self-checks
-- ---------------------------------------------------------------------
do $$
declare
  expected text[] := array[
    'id', 'slug', 'name', 'tagline', 'description',
    'cuisine_type', 'cuisine', 'amenities', 'occasion', 'tags', 'area',
    'address', 'latitude', 'longitude',
    'phone', 'whatsapp', 'email', 'website', 'instagram', 'facebook',
    'cover_image', 'logo_image', 'operating_hours', 'dress_code', 'menu_pdf_url',
    'video_url', 'video_type', 'video_caption', 'payment_methods',
    'layout', 'features', 'status', 'business_status',
    'created_at', 'updated_at'
  ];
  must_be_private text[] := array[
    'reviews', 'settings', 'reference_website', 'custom_style', 'style',
    'is_published', 'platform_status',
    'review_status', 'listing_visibility', 'platform_restriction', 'state_source',
    'revision', 'first_published_at'
  ];
  r text;
  granted text[];
  missing text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if has_table_privilege(r, 'public.merchants', 'SELECT') then
      raise exception 'D1b self-check: % still has table-wide SELECT on merchants', r;
    end if;

    select coalesce(array_agg(a.attname::text order by a.attname), '{}') into granted
      from pg_attribute a
     where a.attrelid = 'public.merchants'::regclass
       and a.attnum > 0 and not a.attisdropped
       and has_column_privilege(r, 'public.merchants', a.attname, 'SELECT');

    if granted <> (select array_agg(x order by x) from unnest(expected) x) then
      raise exception 'D1b self-check: % merchants columns differ from the public list: %', r, granted;
    end if;
  end loop;

  select string_agg(c, ', ') into missing
    from unnest(expected || must_be_private) c
   where not exists (
     select 1 from pg_attribute a
      where a.attrelid = 'public.merchants'::regclass
        and a.attname = c and a.attnum > 0 and not a.attisdropped
   );
  if missing is not null then
    raise exception 'D1b self-check: expected merchants columns not found: %', missing;
  end if;

  select string_agg(p, ', ') into missing
    from unnest(array[
      'categories.pub_read_categories', 'products.pub_read_products',
      'merchant_videos.pub_read_merchant_videos',
      'merchant_external_links.merchant_external_links_public_read',
      'events.pub_read_events'
    ]) p
   where not exists (
     select 1 from pg_policies
      where schemaname = 'public'
        and tablename = split_part(p, '.', 1)
        and policyname = split_part(p, '.', 2)
        and qual like '%private.merchant_id_is_public(merchant_id)%'
   );
  if missing is not null then
    raise exception 'D1b self-check: child policies not using merchant_id_is_public: %', missing;
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'merchants'
       and policyname = 'pub_read_merchants'
       and qual like '%private.merchant_is_public%'
  ) then
    raise exception 'D1b self-check: pub_read_merchants must keep the D1a predicate';
  end if;
end $$;

commit;
