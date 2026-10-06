-- =====================================================================
-- R4b (CH 2026-10-06 redesign): Ocean colour + photo-grid menu.
-- =====================================================================
-- 1. private.merchant_persistable_layouts(): adds 'ocean' (copied from 20261004150000).
-- 2. private.merchant_field_registry(): adds features.menu_grid (Owner + Admin), and for R5 the
--    dietary labels (ChatGPT G28): features.vegetarian_options (Owner self-declared, shown as
--    "declared by the restaurant") and features.halal_certified (Admin only, set after BiteSite
--    checks a valid JAKIM / state / MUIS certificate). Copied from 20261003150000; three new rows. merchant_field_patch already validates feature
--    values as booleans and merchant_field_snapshot_read already returns every Owner-writable
--    feature, so nothing else changes. CREATE OR REPLACE keeps the EXECUTE grants.
-- DEPLOY ORDER: this SQL first, then the app. Before it runs the app hides the menu-look choice
-- (the field is absent from the snapshot), and the app does not offer Ocean until merged.
-- Rollback: supabase/rollback/20261006120000_page_style_grid_ocean.rollback.STAGING_ONLY.sql
-- =====================================================================
begin;

create or replace function private.merchant_persistable_layouts()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['classic', 'elegant', 'minimal', 'modern', 'rustic', 'chinese', 'malay', 'ocean']
$$;

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
    ('features.hero',           'feature', 'hero',           true,  true, null),
    ('features.about',          'feature', 'about',          true,  true, null),
    ('features.contact',        'feature', 'contact',        true,  true, null),
    ('features.gallery',        'feature', 'gallery',        true,  true, null),
    ('features.events',         'feature', 'events',         false, true, null),
    ('features.appointment',    'feature', 'appointment',    true,  true, null),
    ('features.seasonal_popup', 'feature', 'seasonal_popup', true,  true, null),
    ('features.menu_grid',      'feature', 'menu_grid',      true,  true, null),
    ('features.halal_certified',    'feature', 'halal_certified',    false, true, null),
    ('features.vegetarian_options', 'feature', 'vegetarian_options', true,  true, null),
    ('features.menu',           'feature', 'menu',           false, false, null),
    ('features.reviews',        'feature', 'reviews',        false, false, null),
    ('profile.name',         'text',      'name',      private.merchant_listing_basics_enabled(), true, 160),
    ('presentation.layout',  'layout',    'layout',    true,  true, 32),
    ('tags.cuisine',         'tag_array', 'cuisine',   private.merchant_listing_basics_enabled(), true, 3),
    ('tags.amenities',       'tag_array', 'amenities', true,  true, 5),
    ('tags.occasion',        'tag_array', 'occasion',  true,  true, 3),
    ('location',             'location',  'location',  private.merchant_listing_basics_enabled(), true, null),
    ('tags.payment',         'tag_array', 'payment_methods', true, true, 3)
$$;

do $$
begin
  if not ('ocean' = any (private.merchant_persistable_layouts())) then
    raise exception 'grid/ocean self-check: ocean is not persistable';
  end if;
  if has_function_privilege('anon', 'private.merchant_persistable_layouts()', 'execute')
     or has_function_privilege('authenticated', 'private.merchant_persistable_layouts()', 'execute') then
    raise exception 'grid/ocean self-check: wrong EXECUTE grants on merchant_persistable_layouts';
  end if;
  if (select count(*) from private.merchant_field_registry() where owner_writable and (kind = 'feature' or path = 'presentation.layout')) <> 9 then
    raise exception 'grid/ocean self-check: expected the layout and 8 switches to be Owner-writable';
  end if;
  -- Halal-certified is set only by BiteSite after checking the certificate (G28 / R5).
  if exists (select 1 from private.merchant_field_registry() where owner_writable and path in ('features.events', 'features.menu', 'features.reviews', 'features.halal_certified')) then
    raise exception 'grid/ocean self-check: events, menu, reviews and halal_certified must stay closed to Owners';
  end if;
  if not exists (select 1 from private.merchant_field_registry() where path = 'features.halal_certified' and admin_writable) then
    raise exception 'grid/ocean self-check: Admin must be able to set halal_certified';
  end if;
  if (select count(*) from private.merchant_field_registry()) <> 35 then
    raise exception 'grid/ocean self-check: expected 35 registry rows';
  end if;
  raise notice 'PASSED: page style grid + ocean';
end $$;

commit;
