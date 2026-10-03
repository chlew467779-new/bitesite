-- =====================================================================
-- Owners choose their page style and sections (issue #11, CH 2026-09-30: option C, no review).
-- =====================================================================
-- registry: copied from 20261003140000 with presentation.layout and six section switches now
--   Owner-writable: hero, about, contact, gallery, appointment (Book a Table), seasonal_popup
--   (Featured dishes). Events (hidden, CH 09-30), menu and reviews stay as they were.
-- merchant_field_snapshot_read: copied from 20260927094400; an Owner now also reads the section
--   switches they may write (before, Owners never saw any feature value).
-- merchant_field_patch already validates both kinds (booleans; layout must be a production layout
--   from private.merchant_persistable_layouts()). CREATE OR REPLACE keeps the EXECUTE grants.
-- DEPLOY ORDER: this SQL first, then the app. The current app never offers these to Owners.
-- Rollback: supabase/rollback/20261003150000_owner_page_style.rollback.STAGING_ONLY.sql
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

create or replace function public.merchant_field_snapshot_read(
  p_actor_type  text,
  p_actor_id    text,
  p_merchant_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  m public.merchants;
  v_user uuid;
  v_out jsonb := '{}';
  reg record;
begin
  if p_actor_type = 'owner' then
    if p_actor_id is null or p_actor_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      perform private.merchant_write_error('RESOURCE_NOT_FOUND');
    end if;
    v_user := p_actor_id::uuid;
    select mer.* into m from public.merchants mer
      join public.merchant_memberships mm on mm.merchant_id = mer.id
     where mer.id = p_merchant_id and mm.user_id = v_user and mm.role = 'owner' and mm.status = 'active';
  elsif p_actor_type = 'admin' and p_actor_id = 'legacy_admin' then
    select * into m from public.merchants where id = p_merchant_id;
  else
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'unknown actor');
  end if;
  if not found then
    perform private.merchant_write_error('RESOURCE_NOT_FOUND');
  end if;
  for reg in select * from private.merchant_field_registry() r
              where (p_actor_type = 'admin' or r.kind <> 'feature' or r.owner_writable) loop
    v_out := v_out || jsonb_build_object(reg.path, private.merchant_field_snapshot(m, reg.kind, reg.target));
  end loop;
  return jsonb_build_object('revision', m.revision, 'updatedAt', m.updated_at, 'fields', v_out);
end;
$$;

do $$
begin
  if (select count(*) from private.merchant_field_registry() where owner_writable and (kind = 'feature' or path = 'presentation.layout')) <> 7 then
    raise exception 'owner page style self-check: expected the layout and 6 section switches to be Owner-writable';
  end if;
  if exists (select 1 from private.merchant_field_registry() where owner_writable and path in ('features.events', 'features.menu', 'features.reviews')) then
    raise exception 'owner page style self-check: events, menu and reviews must stay closed to Owners';
  end if;
  if (select count(*) from private.merchant_field_registry()) <> 32 then
    raise exception 'owner page style self-check: expected 32 registry rows';
  end if;
end $$;

commit;
