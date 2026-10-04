-- =====================================================================
-- ShopeeFood and foodpanda links (#13, CH 2026-10-04), next to GrabFood.
-- =====================================================================
-- Same flow as GrabFood (20260927120000_merchant_link_review): the Owner asks, Admin approves,
-- the link lives in merchant_external_links (link_type 'shopeefood' / 'foodpanda'), and the
-- public store page shows an "Order on ..." button for each active link of a public restaurant.
--
-- Host rules (private.merchant_link_problem, mirrored in lib/merchant-links-core.mjs):
--   shopeefood -> shopee.com.my, shopeefood.my (or a subdomain), or the Shopee short link shp.ee
--   foodpanda  -> foodpanda.my, foodpanda.sg (or a subdomain, e.g. www.foodpanda.my)
-- Admin still checks every link by hand before it is shown.
--
-- merchant_review_content only adds the two new keys when a link is set, so the review hash of
-- every existing restaurant is unchanged ("changed since approval" does not light up).
-- The app hides the two fields until this migration runs (merchant_links_read has no such keys).
--
-- Local first; production with CH approval, after 20261004100000.
-- Rollback: supabase/rollback/20261004110000_delivery_links.rollback.STAGING_ONLY.sql
-- =====================================================================
begin;

alter table public.merchant_external_links drop constraint if exists merchant_external_links_link_type_check;
alter table public.merchant_external_links add constraint merchant_external_links_link_type_check
  check (link_type in ('grabfood', 'shopeefood', 'foodpanda'));

alter table public.merchant_link_requests drop constraint merchant_link_requests_field_check;
alter table public.merchant_link_requests add constraint merchant_link_requests_field_check
  check (field in ('website', 'instagram', 'facebook', 'menu_pdf_url', 'grabfood', 'shopeefood', 'foodpanda'));

drop policy if exists merchant_external_links_public_read on public.merchant_external_links;
create policy merchant_external_links_public_read on public.merchant_external_links
  for select to anon, authenticated
  using (
    is_active = true
    and link_type in ('grabfood', 'shopeefood', 'foodpanda')
    and private.merchant_id_is_public(merchant_id)
  );

create or replace function private.merchant_link_problem(p_field text, p_url text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
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
  if p_field = 'shopeefood' and host not in ('shopee.com.my', 'shopeefood.my', 'shp.ee')
     and host not like '%.shopee.com.my' and host not like '%.shopeefood.my' then return 'host_shopeefood'; end if;
  if p_field = 'foodpanda' and host not in ('foodpanda.my', 'foodpanda.sg')
     and host not like '%.foodpanda.my' and host not like '%.foodpanda.sg' then return 'host_foodpanda'; end if;
  return null;
end;
$$;

create or replace function private.merchant_link_current(p_merchant_id uuid, p_field text)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_field = 'website' then (select website from public.merchants where id = p_merchant_id)
    when p_field = 'instagram' then (select instagram from public.merchants where id = p_merchant_id)
    when p_field = 'facebook' then (select facebook from public.merchants where id = p_merchant_id)
    when p_field = 'menu_pdf_url' then (select menu_pdf_url from public.merchants where id = p_merchant_id)
    when p_field in ('grabfood', 'shopeefood', 'foodpanda') then (select url from public.merchant_external_links
                            where merchant_id = p_merchant_id and link_type = p_field and is_active)
  end;
$$;

create or replace function private.merchant_link_apply(p_merchant_id uuid, p_field text, p_url text)
returns void
language plpgsql
volatile
set search_path = ''
as $$
begin
  if p_field = 'website' then update public.merchants set website = p_url where id = p_merchant_id;
  elsif p_field = 'instagram' then update public.merchants set instagram = p_url where id = p_merchant_id;
  elsif p_field = 'facebook' then update public.merchants set facebook = p_url where id = p_merchant_id;
  elsif p_field = 'menu_pdf_url' then update public.merchants set menu_pdf_url = p_url where id = p_merchant_id;
  elsif p_field in ('grabfood', 'shopeefood', 'foodpanda') then
    if p_url is null then
      delete from public.merchant_external_links where merchant_id = p_merchant_id and link_type = p_field;
    else
      insert into public.merchant_external_links (merchant_id, link_type, url, is_active)
      values (p_merchant_id, p_field, p_url, true)
      on conflict (merchant_id, link_type) do update set url = excluded.url, is_active = true, updated_at = now();
    end if;
  end if;
end;
$$;

create or replace function private.merchant_link_check(p_field text, p_url text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text;
  problem text;
begin
  if p_field is null or p_field not in ('website', 'instagram', 'facebook', 'menu_pdf_url', 'grabfood', 'shopeefood', 'foodpanda') then
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
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
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
      'grabfood', private.merchant_link_current(m.id, 'grabfood'),
      'shopeefood', private.merchant_link_current(m.id, 'shopeefood'),
      'foodpanda', private.merchant_link_current(m.id, 'foodpanda')),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'field', r.field, 'proposedUrl', r.proposed_url, 'status', r.status,
                                          'createdAt', r.created_at, 'decidedAt', r.decided_at, 'reviewNote', r.review_note)
                       order by r.created_at desc)
        from (select * from public.merchant_link_requests where merchant_id = m.id
               and (status = 'pending' or decided_at > now() - interval '30 days')
               order by created_at desc limit 20) r), '[]'::jsonb));
end;
$$;

-- Unchanged from 20260927130000 except the two delivery keys, added only when set.
create or replace function private.merchant_review_content(m public.merchants)
returns jsonb
language sql
stable
set search_path = ''
as $$
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
  || jsonb_strip_nulls(jsonb_build_object(
    'shopeefood', private.merchant_link_current(m.id, 'shopeefood'),
    'foodpanda', private.merchant_link_current(m.id, 'foodpanda')))
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.merchant_links_read(text,text,uuid)',
    'private.merchant_link_problem(text,text)',
    'private.merchant_link_current(uuid,text)',
    'private.merchant_link_apply(uuid,text,text)',
    'private.merchant_link_check(text,text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
  if has_function_privilege('anon', 'public.merchant_links_read(text,text,uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.merchant_links_read(text,text,uuid)', 'execute') then
    raise exception 'Delivery links self-check: merchant_links_read is open to browser roles';
  end if;
end $$;

commit;
