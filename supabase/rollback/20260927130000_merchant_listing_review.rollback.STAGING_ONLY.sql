-- ROLLBACK of 20260927130000_merchant_listing_review.sql - STAGING ONLY.
-- Roll back the application first. Export review/notification history before dropping it.
-- Managed restaurant review_status, listing_visibility, slugs and first_published_at are preserved.
-- This does not unpublish restaurants or restore their previous slugs.
begin;
do $$ begin
  if 'NO' <> 'yes' then
    raise exception 'Rollback switch is off. Edit deliberately to allow this rollback.';
  end if;
end $$;
drop function if exists public.merchant_review_capacity_set(text,text,integer,integer);
drop function if exists public.merchant_review_decide(text,text,uuid,uuid,text,text);
drop function if exists public.merchant_review_queue(text,text);
drop function if exists public.merchant_listing_apply(text,text,uuid,uuid,text);
drop function if exists public.merchant_listing_read(text,text,uuid);
drop function if exists private.merchant_publication_slug(public.merchants);
drop function if exists private.merchant_slug_referenced(text);
drop function if exists private.merchant_slug_base(text,uuid);
drop function if exists private.merchant_listing_state(public.merchants);
drop function if exists private.merchant_listing_check(public.merchants,text);
drop function if exists private.merchant_review_hash(jsonb);
drop function if exists private.merchant_review_content(public.merchants);
drop function if exists private.merchant_listing_ready(public.merchants);
drop function if exists private.merchant_listing_checks(public.merchants);
drop function if exists public.merchant_listing_basics_patch(text,text,uuid,uuid,jsonb);
create or replace function private.merchant_field_registry()
returns table (path text, kind text, target text, owner_writable boolean, admin_writable boolean, max_length int)
language sql
immutable
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
    -- B0: Admin-only paths. For tag_array, max_length is the maximum number of tags.
    ('profile.name',         'text',      'name',      false, true, 160),
    ('presentation.layout',  'layout',    'layout',    false, true, 32),
    ('tags.cuisine',         'tag_array', 'cuisine',   false, true, 3),
    ('tags.amenities',       'tag_array', 'amenities', false, true, 5),
    ('tags.occasion',        'tag_array', 'occasion',  false, true, 3),
    ('location',             'location',  'location',  false, true, null)
$$;
drop function if exists private.merchant_listing_basics_enabled();
drop table if exists public.merchant_notifications;
drop table if exists public.merchant_review_submissions;
drop table if exists private.merchant_review_settings;
commit;
