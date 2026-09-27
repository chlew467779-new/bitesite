-- =====================================================================
-- Restaurant web address (slug) changes with permanent redirects from old addresses.
-- =====================================================================
-- 1. public.merchant_slug_history: every former address of a restaurant (except the never-public
--    M2-B draft address restaurant-<id>). The store page redirects an old address permanently to the
--    current one. Readable by anon only for restaurants that are public now (same predicate as
--    every public read), so hidden restaurants reveal nothing.
-- 2. Database guarantees (every write path, including Admin create and M2-B publication):
--      - a slug recorded for one restaurant cannot be taken by another (SLUG_TAKEN, SQLSTATE
--        23505 so existing "already used" handling applies);
--      - changing a slug records the old one and drops the
--        new one from its own history (changing back works);
--      - operational references follow: articles (FK now ON UPDATE CASCADE), story_submissions,
--        assisted_content_requests, merchant_content_cycles. Analytics rows keep the old slug
--        (history of what was visited then).
-- 3. public.merchant_slug_change(admin, merchant, request_id, new_slug, expected_slug): Admin
--    only; compare-and-set on the current slug, idempotent per request id (7 days), audited by
--    the D1a trigger with operation merchant_slug_change. Format: 2..64 lowercase letters,
--    digits and single hyphens (same as Admin create).
-- 4. private.merchant_publication_slug (M2-B) also skips addresses held in history.
--
-- Local first; staging and production each need CH approval, after 20260927130000.
-- Rollback: supabase/rollback/20260927140000_merchant_slug_history.rollback.STAGING_ONLY.sql
-- =====================================================================
begin;

create table public.merchant_slug_history (
  old_slug    text        primary key,
  merchant_id uuid        not null references public.merchants(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint merchant_slug_history_format check (old_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(old_slug) between 2 and 200)
);
create index merchant_slug_history_merchant_idx on public.merchant_slug_history (merchant_id);
alter table public.merchant_slug_history enable row level security;
revoke all on table public.merchant_slug_history from public, anon, authenticated, service_role;
grant select on table public.merchant_slug_history to anon, authenticated;
grant select, insert, delete on table public.merchant_slug_history to service_role;
create policy merchant_slug_history_public_read on public.merchant_slug_history
  for select to anon, authenticated
  using (private.merchant_id_is_public(merchant_id));
comment on table public.merchant_slug_history is
  'Former public web addresses of restaurants; the store page redirects them permanently. Public read only for restaurants that are public now.';

-- Articles follow a renamed restaurant instead of blocking the rename.
alter table public.articles drop constraint articles_merchant_slug_fkey;
alter table public.articles add constraint articles_merchant_slug_fkey
  foreign key (merchant_slug) references public.merchants(slug) on update cascade on delete set null;

-- A slug another restaurant used publicly stays theirs (so old links never point elsewhere).
create or replace function private.merchants_slug_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.slug is not distinct from old.slug then
    return new;
  end if;
  if exists (select 1 from public.merchant_slug_history h where h.old_slug = new.slug and h.merchant_id <> new.id) then
    raise exception using errcode = '23505', message = 'SLUG_TAKEN', detail = 'history';
  end if;
  return new;
end;
$$;

create or replace function private.merchants_slug_follow()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slug is not distinct from old.slug then
    return null;
  end if;
  delete from public.merchant_slug_history where old_slug = new.slug and merchant_id = new.id;
  -- Every old address is kept, except the server-made draft address of a restaurant that was
  -- never public (M2-B: restaurant-<id>). Legacy rows may lack first_published_at.
  if not (old.first_published_at is null and old.slug = 'restaurant-' || old.id::text) then
    insert into public.merchant_slug_history (old_slug, merchant_id) values (old.slug, new.id)
    on conflict (old_slug) do nothing;
  end if;
  update public.story_submissions set merchant_slug = new.slug where merchant_slug = old.slug;
  update public.assisted_content_requests set merchant_slug = new.slug where merchant_slug = old.slug;
  update public.merchant_content_cycles set merchant_slug = new.slug where merchant_slug = old.slug;
  return null;
end;
$$;

create trigger merchants_slug_guard
  before insert or update of slug on public.merchants
  for each row execute function private.merchants_slug_guard();
create trigger merchants_slug_follow
  after update of slug on public.merchants
  for each row execute function private.merchants_slug_follow();
revoke all on function private.merchants_slug_guard() from public, anon, authenticated, service_role;
revoke all on function private.merchants_slug_follow() from public, anon, authenticated, service_role;

create or replace function private.merchant_slug_valid(p_slug text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(p_slug) between 2 and 64, false)
$$;

-- M2-B first publication: also skip slugs held in any restaurant's history.
create or replace function private.merchant_publication_slug(m public.merchants)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  base text;
  candidate text;
  n int := 1;
begin
  if m.first_published_at is not null or m.slug <> 'restaurant-' || m.id::text or private.merchant_slug_referenced(m.slug) then
    return m.slug;
  end if;
  base := private.merchant_slug_base(m.name, m.id);
  candidate := base;
  while exists (select 1 from public.merchants where slug = candidate and id <> m.id)
     or exists (select 1 from public.merchant_slug_history where old_slug = candidate and merchant_id <> m.id) loop
    n := n + 1;
    if n > 50 then return base || '-' || left(m.id::text, 8); end if;
    candidate := base || '-' || n;
  end loop;
  return candidate;
end;
$$;

create or replace function public.merchant_slug_change(
  p_actor_type    text,
  p_actor_id      text,
  p_merchant_id   uuid,
  p_request_id    uuid,
  p_new_slug      text,
  p_expected_slug text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_op constant text := 'merchant_slug_change';
  v_slug text := lower(btrim(coalesce(p_new_slug, '')));
  v_hash text;
  v_prev jsonb;
  v_old text;
  m public.merchants;
begin
  if p_actor_type is distinct from 'admin' or p_actor_id is distinct from 'legacy_admin' then
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'admin_only');
  end if;
  if p_request_id is null then perform private.merchant_write_error('VALIDATION_FAILED', 'request id is required'); end if;
  if not private.merchant_slug_valid(v_slug) then perform private.merchant_write_error('VALIDATION_FAILED', 'slug_format'); end if;
  v_hash := encode(sha256(convert_to(jsonb_build_object('v', 1, 'op', v_op, 'merchant', p_merchant_id, 'slug', v_slug, 'expected', p_expected_slug)::text, 'UTF8')), 'hex');
  -- Archived restaurants are read-only; pending review is frozen (existing lock rules).
  m := private.lock_merchant_for_actor(p_actor_type, p_actor_id, p_merchant_id, true);
  v_prev := private.merchant_link_replay(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash);
  if v_prev is not null then return v_prev; end if;

  if m.slug is distinct from p_expected_slug then
    return private.merchant_link_remember(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash, 'conflict',
      jsonb_build_object('status', 'conflict', 'slug', m.slug));
  end if;
  if m.slug = v_slug then
    return private.merchant_link_remember(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash, 'noop',
      jsonb_build_object('status', 'noop', 'slug', m.slug));
  end if;
  if exists (select 1 from public.merchants where slug = v_slug and id <> m.id)
     or exists (select 1 from public.merchant_slug_history where old_slug = v_slug and merchant_id <> m.id) then
    perform private.merchant_write_error('SLUG_TAKEN');
  end if;

  v_old := m.slug;
  perform set_config('app.actor_type', p_actor_type, true);
  perform set_config('app.actor_id', p_actor_id, true);
  perform set_config('app.request_id', p_request_id::text, true);
  perform set_config('app.operation', v_op, true);
  update public.merchants set slug = v_slug where id = m.id returning * into m;
  return private.merchant_link_remember(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash, 'applied',
    jsonb_build_object('status', 'applied', 'slug', m.slug, 'previousSlug', v_old,
                       'redirects', (select coalesce(jsonb_agg(old_slug order by created_at), '[]'::jsonb) from public.merchant_slug_history where merchant_id = m.id)));
end;
$$;

-- Admin read: current slug and the old addresses that redirect to it.
create or replace function public.merchant_slug_read(p_actor_type text, p_actor_id text, p_merchant_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  m public.merchants;
begin
  if p_actor_type is distinct from 'admin' or p_actor_id is distinct from 'legacy_admin' then
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'admin_only');
  end if;
  select * into m from public.merchants where id = p_merchant_id;
  if not found then perform private.merchant_write_error('RESOURCE_NOT_FOUND'); end if;
  return jsonb_build_object('slug', m.slug, 'public', private.merchant_is_public(m), 'everPublic', m.first_published_at is not null,
    'redirects', (select coalesce(jsonb_agg(jsonb_build_object('slug', old_slug, 'since', created_at) order by created_at), '[]'::jsonb)
                    from public.merchant_slug_history where merchant_id = m.id));
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'private.merchant_slug_valid(text)',
    'private.merchant_publication_slug(public.merchants)',
    'public.merchant_slug_change(text,text,uuid,uuid,text,text)',
    'public.merchant_slug_read(text,text,uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
    if has_function_privilege('anon', fn, 'execute') or has_function_privilege('authenticated', fn, 'execute')
       or not has_function_privilege('service_role', fn, 'execute') then
      raise exception 'Slug history self-check: wrong EXECUTE grants on %', fn;
    end if;
  end loop;
  if has_table_privilege('anon', 'public.merchant_slug_history', 'insert') or has_table_privilege('authenticated', 'public.merchant_slug_history', 'delete') then
    raise exception 'Slug history self-check: browser roles must not write history';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'articles_merchant_slug_fkey' and confupdtype = 'c') then
    raise exception 'Slug history self-check: articles FK must cascade updates';
  end if;
end $$;

commit;
