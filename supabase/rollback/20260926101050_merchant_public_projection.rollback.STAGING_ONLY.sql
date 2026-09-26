-- =====================================================================
-- ROLLBACK of 20260926101050_merchant_public_projection.sql — STAGING ONLY.
-- =====================================================================
-- WARNING: this re-opens every merchants column to anon / authenticated,
-- including legacy reviews, settings and the review / visibility / audit
-- state. Row visibility (D1a) is unchanged. Prefer a forward fix. On
-- production this needs an approved emergency and a backup taken first.
-- The application code from D1b keeps working after this rollback (it only
-- asks for public columns), so the code does not need to be reverted.
--
-- Set the switch below to 'yes' deliberately before running.
-- =====================================================================
begin;

do $$
begin
  if 'NO' <> 'yes' then  -- change 'NO' to 'yes' to allow this rollback
    raise exception 'Rollback switch is off. Edit the script deliberately if you really mean it.';
  end if;
end $$;

-- Table-wide SELECT again (the D1a state). Column grants are removed first so
-- no stale per-column privilege is left behind.
revoke select (
  id, slug, name, tagline, description,
  cuisine_type, cuisine, amenities, occasion, tags, area,
  address, latitude, longitude,
  phone, whatsapp, email, website, instagram, facebook,
  cover_image, logo_image, operating_hours, dress_code, menu_pdf_url,
  video_url, video_type, video_caption, payment_methods,
  layout, features, status, business_status,
  created_at, updated_at
) on table public.merchants from anon, authenticated;
grant select on table public.merchants to anon, authenticated;

-- Child policies back to the D1a definitions
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

drop policy if exists pub_read_events on public.events;
create policy pub_read_events on public.events
  for select to anon, authenticated
  using (exists (
    select 1 from public.merchants m
     where m.id = events.merchant_id and private.merchant_is_public(m)
  ));

drop function if exists private.merchant_id_is_public(uuid);

do $$
begin
  if not has_table_privilege('anon', 'public.merchants', 'SELECT') then
    raise exception 'Rollback self-check: anon should have table-wide SELECT again';
  end if;
  if to_regprocedure('private.merchant_id_is_public(uuid)') is not null then
    raise exception 'Rollback self-check: merchant_id_is_public still exists';
  end if;
end $$;

commit;
