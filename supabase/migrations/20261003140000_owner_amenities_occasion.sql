-- =====================================================================
-- Owners choose amenities and occasions (issue #4, CH 2026-09-29): no review, shown on the page.
-- =====================================================================
-- registry: copied from 20260929120000 with tags.amenities and tags.occasion now Owner-writable.
-- Nothing else changes. merchant_field_patch already validates and writes both targets (Admin has
-- used them since 20260927094400); the allowed values are the presets in lib/presets.ts
-- (AMENITY_TAGS, OCCASION_TAGS), checked by the API before the database is called.
-- DEPLOY ORDER: this SQL first, then the app. The old app never offers these fields to Owners.
-- Rollback: supabase/rollback/20261003140000_owner_amenities_occasion.rollback.STAGING_ONLY.sql
-- =====================================================================
begin;

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
    ('tags.amenities',       'tag_array', 'amenities', true,  true, 5),
    ('tags.occasion',        'tag_array', 'occasion',  true,  true, 3),
    ('location',             'location',  'location',  private.merchant_listing_basics_enabled(), true, null),
    ('tags.payment',         'tag_array', 'payment_methods', true, true, 3)
$$;

do $$
begin
  if not exists (select 1 from private.merchant_field_registry() where path = 'tags.amenities' and owner_writable)
     or not exists (select 1 from private.merchant_field_registry() where path = 'tags.occasion' and owner_writable) then
    raise exception 'owner amenities self-check: both tags must be Owner-writable';
  end if;
  if (select count(*) from private.merchant_field_registry()) <> 32 then
    raise exception 'owner amenities self-check: expected 32 registry rows, found %', (select count(*) from private.merchant_field_registry());
  end if;
end $$;

commit;
