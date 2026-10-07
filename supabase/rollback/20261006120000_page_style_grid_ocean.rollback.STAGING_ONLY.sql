-- =====================================================================
-- ROLLBACK of 20261006120000_page_style_grid_ocean.sql - STAGING ONLY.
-- =====================================================================
-- First set any restaurant using the Ocean colour back to another style (Admin), and roll the app
-- back so it no longer offers Ocean or the menu look. Stored features.menu_grid values stay in the
-- features JSON but can no longer be read or written through the field functions.
-- Restores the definitions from 20261004150000 (layouts) and 20261003150000 (registry).
-- =====================================================================
begin;
do $$ begin
  if 'NO' <> 'yes' then  -- change 'NO' to 'yes' to allow this rollback
    raise exception 'Rollback switch is off. Edit deliberately to allow this rollback.';
  end if;
  if exists (select 1 from public.merchants where layout = 'ocean') then
    raise exception 'Some restaurants still use the Ocean colour; change them first.';
  end if;
end $$;

create or replace function private.merchant_persistable_layouts()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['classic', 'elegant', 'minimal', 'modern', 'rustic', 'chinese', 'malay']
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

commit;
