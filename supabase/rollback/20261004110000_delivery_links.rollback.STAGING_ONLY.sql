-- =====================================================================
-- ROLLBACK of 20261004110000_delivery_links.sql - STAGING ONLY.
-- =====================================================================
-- Roll the application back first is optional: the app hides ShopeeFood/foodpanda when
-- merchant_links_read has no such keys. DELETES every ShopeeFood/foodpanda link and request,
-- then restores the GrabFood-only rules of 20260927120000 / 20260927130000.
-- =====================================================================
begin;
do $$ begin
  if 'NO' <> 'yes' then  -- change 'NO' to 'yes' to allow this rollback
    raise exception 'Rollback switch is off. Edit deliberately to allow this rollback.';
  end if;
end $$;

delete from public.merchant_external_links where link_type in ('shopeefood', 'foodpanda');
delete from public.merchant_link_requests where field in ('shopeefood', 'foodpanda');

alter table public.merchant_external_links drop constraint merchant_external_links_link_type_check;
alter table public.merchant_external_links add constraint merchant_external_links_link_type_check check (link_type in ('grabfood'));
alter table public.merchant_link_requests drop constraint merchant_link_requests_field_check;
alter table public.merchant_link_requests add constraint merchant_link_requests_field_check
  check (field in ('website', 'instagram', 'facebook', 'menu_pdf_url', 'grabfood'));

drop policy if exists merchant_external_links_public_read on public.merchant_external_links;
create policy merchant_external_links_public_read on public.merchant_external_links
  for select to anon, authenticated
  using (is_active = true and link_type = 'grabfood' and private.merchant_id_is_public(merchant_id));

create or replace function private.merchant_link_problem(p_field text, p_url text)
returns text language plpgsql immutable set search_path = '' as $$
declare
  host text;
begin
  if p_url is null then return null; end if;
  if char_length(p_url) > 500 then return 'too_long'; end if;
  if p_url !~ '^https://[^\s]+$' then return 'https_only'; end if;
  host := lower(substring(p_url from '^https://([^/?#]*)'));
  if host like '%@%' then return 'credentials'; end if;
  host := regexp_replace(host, ':[0-9]+$', '');
  if host = '' or host !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
     or host ~ '^[0-9.]+$' or host = 'localhost' or host like '%.localhost' then
    return 'host';
  end if;
  if p_field = 'instagram' and host not in ('instagram.com', 'www.instagram.com') then return 'host_instagram'; end if;
  if p_field = 'facebook' and host not in ('facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.com', 'www.fb.com') then return 'host_facebook'; end if;
  if p_field = 'grabfood' and host <> 'grab.com' and host not like '%.grab.com' then return 'host_grabfood'; end if;
  return null;
end;
$$;

create or replace function private.merchant_link_current(p_merchant_id uuid, p_field text)
returns text language sql stable set search_path = '' as $$
  select case p_field
    when 'website' then (select website from public.merchants where id = p_merchant_id)
    when 'instagram' then (select instagram from public.merchants where id = p_merchant_id)
    when 'facebook' then (select facebook from public.merchants where id = p_merchant_id)
    when 'menu_pdf_url' then (select menu_pdf_url from public.merchants where id = p_merchant_id)
    when 'grabfood' then (select url from public.merchant_external_links
                            where merchant_id = p_merchant_id and link_type = 'grabfood' and is_active)
  end;
$$;

create or replace function private.merchant_link_apply(p_merchant_id uuid, p_field text, p_url text)
returns void language plpgsql volatile set search_path = '' as $$
begin
  if p_field = 'website' then update public.merchants set website = p_url where id = p_merchant_id;
  elsif p_field = 'instagram' then update public.merchants set instagram = p_url where id = p_merchant_id;
  elsif p_field = 'facebook' then update public.merchants set facebook = p_url where id = p_merchant_id;
  elsif p_field = 'menu_pdf_url' then update public.merchants set menu_pdf_url = p_url where id = p_merchant_id;
  elsif p_field = 'grabfood' then
    if p_url is null then
      delete from public.merchant_external_links where merchant_id = p_merchant_id and link_type = 'grabfood';
    else
      insert into public.merchant_external_links (merchant_id, link_type, url, is_active)
      values (p_merchant_id, 'grabfood', p_url, true)
      on conflict (merchant_id, link_type) do update set url = excluded.url, is_active = true, updated_at = now();
    end if;
  end if;
end;
$$;

create or replace function private.merchant_link_check(p_field text, p_url text)
returns text language plpgsql immutable set search_path = '' as $$
declare
  v text;
  problem text;
begin
  if p_field is null or p_field not in ('website', 'instagram', 'facebook', 'menu_pdf_url', 'grabfood') then
    perform private.merchant_write_error('VALIDATION_FAILED', 'unknown link');
  end if;
  v := nullif(btrim(coalesce(p_url, '')), '');
  problem := private.merchant_link_problem(p_field, v);
  if problem is not null then
    perform private.merchant_write_error('INVALID_LINK', problem);
  end if;
  return v;
end;
$$;

create or replace function public.merchant_links_read(p_actor_type text, p_actor_id text, p_merchant_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  m public.merchants;
begin
  if p_actor_type = 'owner' then
    if p_actor_id is null or p_actor_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      perform private.merchant_write_error('RESOURCE_NOT_FOUND');
    end if;
    select mer.* into m from public.merchants mer
      join public.merchant_memberships mm on mm.merchant_id = mer.id
     where mer.id = p_merchant_id and mm.user_id = p_actor_id::uuid and mm.role = 'owner' and mm.status = 'active';
  elsif p_actor_type = 'admin' and p_actor_id = 'legacy_admin' then
    select * into m from public.merchants where id = p_merchant_id;
  else
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'unknown actor');
  end if;
  if not found then perform private.merchant_write_error('RESOURCE_NOT_FOUND'); end if;
  return jsonb_build_object(
    'links', jsonb_build_object(
      'website', m.website, 'instagram', m.instagram, 'facebook', m.facebook, 'menu_pdf_url', m.menu_pdf_url,
      'grabfood', private.merchant_link_current(m.id, 'grabfood')),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'field', r.field, 'proposedUrl', r.proposed_url, 'status', r.status,
                                          'createdAt', r.created_at, 'decidedAt', r.decided_at, 'reviewNote', r.review_note)
                       order by r.created_at desc)
        from (select * from public.merchant_link_requests where merchant_id = m.id
               and (status = 'pending' or decided_at > now() - interval '30 days')
               order by created_at desc limit 20) r), '[]'::jsonb));
end;
$$;

create or replace function private.merchant_review_content(m public.merchants)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'name', m.name, 'tagline', m.tagline, 'description', m.description,
    'address', m.address, 'area', m.area, 'latitude', m.latitude, 'longitude', m.longitude,
    'cuisine', to_jsonb(m.cuisine), 'amenities', to_jsonb(m.amenities), 'occasion', to_jsonb(m.occasion),
    'phone', m.phone, 'whatsapp', m.whatsapp, 'email', m.email,
    'website', m.website, 'instagram', m.instagram, 'facebook', m.facebook, 'menuPdfUrl', m.menu_pdf_url,
    'grabfood', private.merchant_link_current(m.id, 'grabfood'),
    'logoImage', m.logo_image, 'coverImage', m.cover_image,
    'operatingHours', m.operating_hours, 'features', m.features, 'layout', m.layout,
    'menu', private.merchant_menu_snapshot(m.id))
$$;

commit;
