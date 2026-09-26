-- =====================================================================
-- ROLLBACK of 20260926093811_merchant_state_foundation.sql — STAGING ONLY.
-- =====================================================================
-- WARNING: this re-opens known problems. Suspended/archived legacy merchants
-- become public again (AUD-04), events become readable for every merchant,
-- view counts become public, and the canonical state + audit history is DROPPED.
-- Prefer a forward fix. On production this needs an approved emergency and a
-- backup taken first, and it refuses to run while any managed merchant exists
-- (dropping state_source would silently republish/unpublish those rows).
--
-- Set the switch below to 'yes' deliberately before running.
-- =====================================================================
begin;

do $$
begin
  if 'NO' <> 'yes' then  -- change 'NO' to 'yes' to allow this rollback
    raise exception 'Rollback switch is off. Edit the script deliberately if you really mean it.';
  end if;
  if exists (select 1 from public.merchants where state_source = 'managed') then
    raise exception 'Refusing to roll back: managed merchants exist and would lose their state';
  end if;
end $$;

-- Policies back to the pre-D1a definitions
drop policy if exists pub_read_merchants on public.merchants;
create policy pub_read_merchants on public.merchants for select to anon, authenticated using (is_published = true);

drop policy if exists pub_read_categories on public.categories;
create policy pub_read_categories on public.categories for select to anon, authenticated
  using (exists (select 1 from public.merchants m where m.id = categories.merchant_id and m.is_published = true));

drop policy if exists pub_read_products on public.products;
create policy pub_read_products on public.products for select to anon, authenticated
  using (exists (select 1 from public.merchants m where m.id = products.merchant_id and m.is_published = true));

drop policy if exists pub_read_merchant_videos on public.merchant_videos;
create policy pub_read_merchant_videos on public.merchant_videos for select to anon, authenticated
  using (exists (select 1 from public.merchants m where m.id = merchant_videos.merchant_id and m.is_published = true));

drop policy if exists merchant_external_links_public_read on public.merchant_external_links;
create policy merchant_external_links_public_read on public.merchant_external_links for select to anon, authenticated
  using (is_active = true and link_type = 'grabfood'
         and exists (select 1 from public.merchants where merchants.id = merchant_external_links.merchant_id and merchants.is_published = true));

drop policy if exists pub_read_events on public.events;
create policy "Allow public read" on public.events for select using (true);

grant select on table public.merchant_stats to anon, authenticated;
create policy pub_read_merchant_stats on public.merchant_stats for select to anon, authenticated using (true);

-- Objects added by D1a
drop index if exists public.merchant_memberships_one_active_owner;
drop trigger if exists merchants_after_write_audit on public.merchants;
drop trigger if exists merchants_before_write on public.merchants;
drop function if exists private.merchants_after_write_audit();
drop function if exists private.merchants_before_write();
drop function if exists private.merchant_is_public(public.merchants);
drop table if exists public.merchant_change_log;

alter table public.merchants
  drop constraint if exists merchants_review_status_check,
  drop constraint if exists merchants_listing_visibility_check,
  drop constraint if exists merchants_platform_restriction_check,
  drop constraint if exists merchants_state_source_check,
  drop constraint if exists merchants_revision_nonnegative,
  drop column if exists review_status,
  drop column if exists listing_visibility,
  drop column if exists platform_restriction,
  drop column if exists state_source,
  drop column if exists revision,
  drop column if exists updated_at,
  drop column if exists first_published_at;

commit;
