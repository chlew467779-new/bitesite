-- =====================================================================
-- Link review queue: Owners request link changes, Admin approves or rejects; Admin edits directly.
-- =====================================================================
-- Links: website, instagram, facebook, menu_pdf_url (merchants columns) and grabfood
-- (merchant_external_links, link_type 'grabfood'). They were read-only since D2-A/D2-B because a
-- link on a public page must be checked by BiteSite first.
--
--   public.merchant_link_request_submit(owner, merchant, request_id, field, url|null)
--       Owner asks for a new link (or removal). One pending request per restaurant + field; a
--       newer request supersedes the older one. Same authorization/state checks as a field save.
--   public.merchant_link_request_withdraw(owner, merchant, request_id, link_request_id)
--   public.merchant_link_review(admin, request_id, link_request_id, 'approve'|'reject', note)
--       Approve applies the link only if the stored value still equals the value when the Owner
--       asked (else LINK_CHANGED_SINCE_REQUEST, still pending); reject needs a note.
--   public.merchant_link_admin_set(admin, merchant, request_id, field, url|null, expected)
--       Admin direct edit with compare-and-set; a pending Owner request for the field is superseded.
--   public.merchant_links_read(actor, merchant)  current links + this restaurant's recent requests
--   public.merchant_link_queue(admin)            pending requests, oldest first
--
-- URL rules (private.merchant_link_problem, mirrored in lib/merchant-links-core.mjs): https only,
-- at most 500 characters, no spaces or user:password@, a real host name (no IP address or
-- localhost); instagram -> instagram.com, facebook -> facebook.com / fb.com, grabfood -> grab.com
-- or a subdomain. Writes are idempotent per request id (7 days); merchant columns are audited
-- by the D1a trigger with operation merchant_link_*.
--
-- Local first; staging and production each need CH approval, after 20260927110000.
-- Rollback: supabase/rollback/20260927120000_merchant_link_review.rollback.STAGING_ONLY.sql
-- =====================================================================
begin;

create table public.merchant_link_requests (
  id            uuid        primary key default gen_random_uuid(),
  merchant_id   uuid        not null references public.merchants(id) on delete cascade,
  field         text        not null,
  proposed_url  text,
  base_value    text,
  status        text        not null default 'pending',
  submitted_by  uuid        not null,
  created_at    timestamptz not null default now(),
  decided_at    timestamptz,
  review_note   text,
  constraint merchant_link_requests_field_check check (field in ('website', 'instagram', 'facebook', 'menu_pdf_url', 'grabfood')),
  constraint merchant_link_requests_status_check check (status in ('pending', 'approved', 'rejected', 'withdrawn', 'superseded')),
  constraint merchant_link_requests_note_check check (review_note is null or char_length(review_note) <= 500)
);
create unique index merchant_link_requests_one_pending on public.merchant_link_requests (merchant_id, field) where status = 'pending';
create index merchant_link_requests_queue_idx on public.merchant_link_requests (status, created_at);

alter table public.merchant_link_requests enable row level security;
revoke all on table public.merchant_link_requests from public, anon, authenticated, service_role;
grant select, insert, update on table public.merchant_link_requests to service_role;
comment on table public.merchant_link_requests is
  'Owner link change requests reviewed by Admin. Private: no anon/authenticated privileges, RLS on, no policies.';

-- Null when the URL is acceptable for the field, else a short reason.
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
  return null;
end;
$$;

create or replace function private.merchant_link_current(p_merchant_id uuid, p_field text)
returns text
language sql
stable
set search_path = ''
as $$
  select case p_field
    when 'website' then (select website from public.merchants where id = p_merchant_id)
    when 'instagram' then (select instagram from public.merchants where id = p_merchant_id)
    when 'facebook' then (select facebook from public.merchants where id = p_merchant_id)
    when 'menu_pdf_url' then (select menu_pdf_url from public.merchants where id = p_merchant_id)
    when 'grabfood' then (select url from public.merchant_external_links
                            where merchant_id = p_merchant_id and link_type = 'grabfood' and is_active)
  end;
$$;

-- Apply a checked value (caller holds the merchant lock and has set the audit settings).
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
returns text
language plpgsql
immutable
set search_path = ''
as $$
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

-- Idempotency helpers shared by the link RPCs.
create or replace function private.merchant_link_replay(p_actor_type text, p_actor_id text, p_merchant_id uuid, p_operation text, p_request_id uuid, p_hash text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  idem public.request_idempotency;
begin
  select * into idem from public.request_idempotency ri
   where ri.actor_type = p_actor_type and ri.actor_id = p_actor_id and ri.merchant_id = p_merchant_id
     and ri.operation = p_operation and ri.request_id = p_request_id;
  if not found then return null; end if;
  if idem.expires_at <= now() then perform private.merchant_write_error('IDEMPOTENCY_KEY_EXPIRED'); end if;
  if idem.payload_hash <> p_hash then perform private.merchant_write_error('IDEMPOTENCY_KEY_REUSED'); end if;
  return idem.result || jsonb_build_object('replayed', true);
end;
$$;

create or replace function private.merchant_link_remember(p_actor_type text, p_actor_id text, p_merchant_id uuid, p_operation text, p_request_id uuid, p_hash text, p_status text, p_result jsonb)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
begin
  insert into public.request_idempotency (actor_type, actor_id, merchant_id, operation, request_id, payload_hash, result_status, result, expires_at)
  values (p_actor_type, p_actor_id, p_merchant_id, p_operation, p_request_id, p_hash, p_status, p_result, now() + interval '7 days');
  return p_result || jsonb_build_object('replayed', false);
end;
$$;

create or replace function public.merchant_link_request_submit(
  p_actor_type text, p_actor_id text, p_merchant_id uuid, p_request_id uuid, p_field text, p_url text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_op constant text := 'merchant_link_request';
  v_url text;
  v_hash text;
  v_prev jsonb;
  v_current text;
  v_id uuid;
  m public.merchants;
begin
  if p_actor_type is distinct from 'owner' then perform private.merchant_write_error('OPERATION_FORBIDDEN', 'owner_only'); end if;
  if p_request_id is null then perform private.merchant_write_error('VALIDATION_FAILED', 'request id is required'); end if;
  v_url := private.merchant_link_check(p_field, p_url);
  v_hash := encode(sha256(convert_to(jsonb_build_object('v', 1, 'op', v_op, 'merchant', p_merchant_id, 'field', p_field, 'url', v_url)::text, 'UTF8')), 'hex');
  m := private.lock_merchant_for_actor(p_actor_type, p_actor_id, p_merchant_id, true);
  v_prev := private.merchant_link_replay(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash);
  if v_prev is not null then return v_prev; end if;

  v_current := private.merchant_link_current(m.id, p_field);
  if v_current is not distinct from v_url then
    return private.merchant_link_remember(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash, 'noop',
      jsonb_build_object('status', 'noop', 'field', p_field));
  end if;
  update public.merchant_link_requests set status = 'superseded', decided_at = now()
   where merchant_id = m.id and field = p_field and status = 'pending';
  insert into public.merchant_link_requests (merchant_id, field, proposed_url, base_value, submitted_by)
  values (m.id, p_field, v_url, v_current, p_actor_id::uuid)
  returning id into v_id;
  return private.merchant_link_remember(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash, 'applied',
    jsonb_build_object('status', 'applied', 'field', p_field, 'linkRequestId', v_id));
end;
$$;

create or replace function public.merchant_link_request_withdraw(
  p_actor_type text, p_actor_id text, p_merchant_id uuid, p_request_id uuid, p_link_request_id uuid)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_op constant text := 'merchant_link_withdraw';
  v_hash text;
  v_prev jsonb;
  m public.merchants;
begin
  if p_actor_type is distinct from 'owner' then perform private.merchant_write_error('OPERATION_FORBIDDEN', 'owner_only'); end if;
  if p_request_id is null then perform private.merchant_write_error('VALIDATION_FAILED', 'request id is required'); end if;
  v_hash := encode(sha256(convert_to(jsonb_build_object('v', 1, 'op', v_op, 'merchant', p_merchant_id, 'id', p_link_request_id)::text, 'UTF8')), 'hex');
  m := private.lock_merchant_for_actor(p_actor_type, p_actor_id, p_merchant_id, false);
  v_prev := private.merchant_link_replay(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash);
  if v_prev is not null then return v_prev; end if;
  update public.merchant_link_requests set status = 'withdrawn', decided_at = now()
   where id = p_link_request_id and merchant_id = m.id and status = 'pending';
  if not found then perform private.merchant_write_error('RESOURCE_NOT_FOUND', 'link_request'); end if;
  return private.merchant_link_remember(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash, 'applied',
    jsonb_build_object('status', 'applied'));
end;
$$;

create or replace function public.merchant_link_review(
  p_actor_type text, p_actor_id text, p_request_id uuid, p_link_request_id uuid, p_decision text, p_note text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_op constant text := 'merchant_link_review';
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_hash text;
  v_prev jsonb;
  v_merchant uuid;
  req public.merchant_link_requests;
  m public.merchants;
begin
  if p_actor_type is distinct from 'admin' or p_actor_id is distinct from 'legacy_admin' then
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'admin_only');
  end if;
  if p_request_id is null or p_link_request_id is null then perform private.merchant_write_error('VALIDATION_FAILED', 'ids are required'); end if;
  if p_decision is null or p_decision not in ('approve', 'reject') then perform private.merchant_write_error('VALIDATION_FAILED', 'unknown decision'); end if;
  if p_decision = 'reject' and v_note is null then perform private.merchant_write_error('VALIDATION_FAILED', 'note_required'); end if;
  if char_length(v_note) > 500 then perform private.merchant_write_error('VALIDATION_FAILED', 'note_too_long'); end if;

  select merchant_id into v_merchant from public.merchant_link_requests where id = p_link_request_id;
  if not found then perform private.merchant_write_error('RESOURCE_NOT_FOUND', 'link_request'); end if;
  -- Lock order as everywhere: merchant row first, then the request.
  m := private.lock_merchant_for_actor(p_actor_type, p_actor_id, v_merchant, true);
  v_hash := encode(sha256(convert_to(jsonb_build_object('v', 1, 'op', v_op, 'id', p_link_request_id, 'decision', p_decision, 'note', v_note)::text, 'UTF8')), 'hex');
  v_prev := private.merchant_link_replay(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash);
  if v_prev is not null then return v_prev; end if;

  select * into req from public.merchant_link_requests where id = p_link_request_id for update;
  if req.status <> 'pending' then perform private.merchant_write_error('VALIDATION_FAILED', 'not_pending'); end if;

  if p_decision = 'reject' then
    update public.merchant_link_requests set status = 'rejected', decided_at = now(), review_note = v_note where id = req.id;
    return private.merchant_link_remember(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash, 'applied',
      jsonb_build_object('status', 'applied', 'decision', 'reject'));
  end if;

  if private.merchant_link_current(m.id, req.field) is distinct from req.base_value then
    perform private.merchant_write_error('LINK_CHANGED_SINCE_REQUEST');
  end if;
  -- Re-check with today's rules before anything goes public.
  perform private.merchant_link_check(req.field, req.proposed_url);
  perform set_config('app.actor_type', p_actor_type, true);
  perform set_config('app.actor_id', p_actor_id, true);
  perform set_config('app.request_id', p_request_id::text, true);
  perform set_config('app.operation', 'merchant_link_review:' || req.field, true);
  perform private.merchant_link_apply(m.id, req.field, req.proposed_url);
  update public.merchant_link_requests set status = 'approved', decided_at = now(), review_note = v_note where id = req.id;
  return private.merchant_link_remember(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash, 'applied',
    jsonb_build_object('status', 'applied', 'decision', 'approve', 'merchantId', m.id, 'slug', m.slug));
end;
$$;

create or replace function public.merchant_link_admin_set(
  p_actor_type text, p_actor_id text, p_merchant_id uuid, p_request_id uuid, p_field text, p_url text, p_expected text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_op constant text := 'merchant_link_admin_set';
  v_url text;
  v_hash text;
  v_prev jsonb;
  v_current text;
  m public.merchants;
begin
  if p_actor_type is distinct from 'admin' or p_actor_id is distinct from 'legacy_admin' then
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'admin_only');
  end if;
  if p_request_id is null then perform private.merchant_write_error('VALIDATION_FAILED', 'request id is required'); end if;
  v_url := private.merchant_link_check(p_field, p_url);
  v_hash := encode(sha256(convert_to(jsonb_build_object('v', 1, 'op', v_op, 'merchant', p_merchant_id, 'field', p_field, 'url', v_url, 'expected', p_expected)::text, 'UTF8')), 'hex');
  m := private.lock_merchant_for_actor(p_actor_type, p_actor_id, p_merchant_id, true);
  v_prev := private.merchant_link_replay(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash);
  if v_prev is not null then return v_prev; end if;

  v_current := private.merchant_link_current(m.id, p_field);
  if v_current is distinct from nullif(btrim(coalesce(p_expected, '')), '') then
    return private.merchant_link_remember(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash, 'conflict',
      jsonb_build_object('status', 'conflict', 'field', p_field, 'current', v_current));
  end if;
  if v_current is not distinct from v_url then
    return private.merchant_link_remember(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash, 'noop',
      jsonb_build_object('status', 'noop', 'field', p_field, 'value', v_current));
  end if;
  perform set_config('app.actor_type', p_actor_type, true);
  perform set_config('app.actor_id', p_actor_id, true);
  perform set_config('app.request_id', p_request_id::text, true);
  perform set_config('app.operation', v_op || ':' || p_field, true);
  perform private.merchant_link_apply(m.id, p_field, v_url);
  update public.merchant_link_requests set status = 'superseded', decided_at = now(), review_note = 'Replaced by an Admin edit'
   where merchant_id = m.id and field = p_field and status = 'pending';
  return private.merchant_link_remember(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash, 'applied',
    jsonb_build_object('status', 'applied', 'field', p_field, 'value', v_url));
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

create or replace function public.merchant_link_queue(p_actor_type text, p_actor_id text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_actor_type is distinct from 'admin' or p_actor_id is distinct from 'legacy_admin' then
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'admin_only');
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', r.id, 'merchantId', r.merchant_id, 'merchantName', m.name, 'slug', m.slug, 'field', r.field,
             'proposedUrl', r.proposed_url, 'currentUrl', private.merchant_link_current(r.merchant_id, r.field),
             'baseValue', r.base_value, 'createdAt', r.created_at) order by r.created_at)
      from (select * from public.merchant_link_requests where status = 'pending' order by created_at limit 200) r
      join public.merchants m on m.id = r.merchant_id), '[]'::jsonb);
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.merchant_link_request_submit(text,text,uuid,uuid,text,text)',
    'public.merchant_link_request_withdraw(text,text,uuid,uuid,uuid)',
    'public.merchant_link_review(text,text,uuid,uuid,text,text)',
    'public.merchant_link_admin_set(text,text,uuid,uuid,text,text,text)',
    'public.merchant_links_read(text,text,uuid)',
    'public.merchant_link_queue(text,text)',
    'private.merchant_link_problem(text,text)',
    'private.merchant_link_current(uuid,text)',
    'private.merchant_link_apply(uuid,text,text)',
    'private.merchant_link_check(text,text)',
    'private.merchant_link_replay(text,text,uuid,text,uuid,text)',
    'private.merchant_link_remember(text,text,uuid,text,uuid,text,text,jsonb)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
  foreach fn in array array[
    'public.merchant_link_request_submit(text,text,uuid,uuid,text,text)',
    'public.merchant_link_review(text,text,uuid,uuid,text,text)',
    'public.merchant_link_admin_set(text,text,uuid,uuid,text,text,text)',
    'public.merchant_links_read(text,text,uuid)',
    'public.merchant_link_queue(text,text)'
  ] loop
    if has_function_privilege('anon', fn, 'execute') or has_function_privilege('authenticated', fn, 'execute')
       or not has_function_privilege('service_role', fn, 'execute') then
      raise exception 'Link review self-check: wrong EXECUTE grants on %', fn;
    end if;
  end loop;
end $$;

commit;
