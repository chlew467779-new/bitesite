-- =====================================================================
-- ROLLBACK of 20261003150000_owner_page_style.sql — STAGING ONLY.
-- =====================================================================
-- Restores the registry of 20261003140000 and the snapshot read of 20260927094400 (layout and
-- sections Admin-only again). Choices Owners already saved stay on the restaurants. Roll the
-- application back first.
-- =====================================================================
begin;

do $$
begin
  if 'NO' <> 'yes' then  -- change 'NO' to 'yes' to allow this rollback
    raise exception 'Rollback switch is off. Edit the script deliberately if you really mean it.';
  end if;
end $$;

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
              where (p_actor_type = 'admin' or r.kind <> 'feature') loop
    v_out := v_out || jsonb_build_object(reg.path, private.merchant_field_snapshot(m, reg.kind, reg.target));
  end loop;
  return jsonb_build_object('revision', m.revision, 'updatedAt', m.updated_at, 'fields', v_out);
end;
$$;

commit;
