-- =====================================================================
-- Visitor reports: "Report a problem" on public restaurant and Story pages (Master Spec §30, §10.5).
-- =====================================================================
-- A visitor reports a public restaurant (closed, wrong address/phone/hours/menu, duplicate, fake,
-- other) or a public Story (rights, personal data, misleading, offensive, other) with an optional
-- note and contact email. Reports go to the Admin "Reports" inbox; nothing changes automatically
-- ("never treat one report as automatic truth"). Admin checks, fixes the page with the existing
-- tools if needed, and marks the report resolved or dismissed.
--
--   public.public_report_submit(type, slug, reason, note, contact_email, reporter_hash)
--       Server route only. Target must be public now (hidden pages look missing). The reporter is a
--       server-side HMAC of the client IP (no raw IP stored): the same reporter + target + reason
--       within 24 hours is a duplicate (no new row); at most 20 reports per reporter per 24 hours.
--   public.public_report_queue(admin, status|null)   newest first (200) + counts per status
--   public.public_report_decide(admin, id, 'new'|'resolved'|'dismissed', note)
--
-- Local first; staging and production each need CH approval, after 20260928120000.
-- Rollback: supabase/rollback/20260928130000_public_reports.rollback.STAGING_ONLY.sql
-- =====================================================================
begin;

create table public.public_reports (
  id            uuid        primary key default gen_random_uuid(),
  target_type   text        not null,
  merchant_id   uuid        references public.merchants(id) on delete set null,
  article_id    uuid        references public.articles(id) on delete set null,
  target_slug   text        not null,
  target_name   text        not null,
  reason        text        not null,
  note          text,
  contact_email text,
  reporter_hash text        not null,
  status        text        not null default 'new',
  admin_note    text,
  created_at    timestamptz not null default now(),
  decided_at    timestamptz,
  constraint public_reports_target_check check (
    (target_type = 'merchant' and article_id is null and reason in ('closed', 'address', 'phone', 'hours', 'menu', 'duplicate', 'fake', 'other'))
    or (target_type = 'story' and merchant_id is null and reason in ('rights', 'personal_data', 'misleading', 'offensive', 'other'))),
  constraint public_reports_note_check check (note is null or char_length(note) <= 1000),
  constraint public_reports_contact_check check (contact_email is null or (char_length(contact_email) <= 254 and contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  constraint public_reports_hash_check check (reporter_hash ~ '^[0-9a-f]{64}$'),
  constraint public_reports_status_check check (status in ('new', 'resolved', 'dismissed')),
  constraint public_reports_admin_note_check check (admin_note is null or char_length(admin_note) <= 1000)
);
create index public_reports_status_idx on public.public_reports (status, created_at desc);
create index public_reports_reporter_idx on public.public_reports (reporter_hash, created_at desc);
alter table public.public_reports enable row level security;
revoke all on table public.public_reports from public, anon, authenticated, service_role;
grant select, insert, update on table public.public_reports to service_role;
comment on table public.public_reports is
  'Visitor reports about public restaurants and Stories, reviewed by Admin. Private: no anon/authenticated privileges, RLS on, no policies. reporter_hash is a server HMAC, never a raw IP.';

create or replace function public.public_report_submit(
  p_target_type text, p_slug text, p_reason text, p_note text, p_contact_email text, p_reporter_hash text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_contact text := nullif(lower(btrim(coalesce(p_contact_email, ''))), '');
  v_merchant uuid;
  v_article uuid;
  v_slug text;
  v_name text;
  v_id uuid;
begin
  if p_target_type is null or p_target_type not in ('merchant', 'story') then perform private.merchant_write_error('VALIDATION_FAILED', 'target_type'); end if;
  if p_reporter_hash is null or p_reporter_hash !~ '^[0-9a-f]{64}$' then perform private.merchant_write_error('VALIDATION_FAILED', 'reporter'); end if;
  if char_length(v_note) > 1000 then perform private.merchant_write_error('VALIDATION_FAILED', 'note'); end if;
  if v_contact is not null and (char_length(v_contact) > 254 or v_contact !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    perform private.merchant_write_error('VALIDATION_FAILED', 'contact_email');
  end if;

  if p_target_type = 'merchant' then
    if p_reason is null or p_reason not in ('closed', 'address', 'phone', 'hours', 'menu', 'duplicate', 'fake', 'other') then perform private.merchant_write_error('VALIDATION_FAILED', 'reason'); end if;
    select m.id, m.slug, m.name into v_merchant, v_slug, v_name from public.merchants m
     where m.slug = p_slug and private.merchant_is_public(m);
  else
    if p_reason is null or p_reason not in ('rights', 'personal_data', 'misleading', 'offensive', 'other') then perform private.merchant_write_error('VALIDATION_FAILED', 'reason'); end if;
    select a.id, a.slug, a.title into v_article, v_slug, v_name from public.articles a
     where a.slug = p_slug and private.article_is_public(a);
  end if;
  if v_slug is null then perform private.merchant_write_error('RESOURCE_NOT_FOUND', 'report_target'); end if;

  -- Serialise one reporter's submissions so the limit and duplicate checks cannot race.
  perform pg_advisory_xact_lock(hashtextextended('public_report:' || p_reporter_hash, 0));
  if exists (select 1 from public.public_reports
              where reporter_hash = p_reporter_hash and target_type = p_target_type and target_slug = v_slug
                and reason = p_reason and created_at > now() - interval '24 hours') then
    return jsonb_build_object('status', 'duplicate');
  end if;
  if (select count(*) from public.public_reports where reporter_hash = p_reporter_hash and created_at > now() - interval '24 hours') >= 20 then
    perform private.merchant_write_error('REPORT_LIMIT');
  end if;

  insert into public.public_reports (target_type, merchant_id, article_id, target_slug, target_name, reason, note, contact_email, reporter_hash)
  values (p_target_type, v_merchant, v_article, v_slug, v_name, p_reason, v_note, v_contact, p_reporter_hash)
  returning id into v_id;
  return jsonb_build_object('status', 'applied', 'reportId', v_id);
end;
$$;

create or replace function public.public_report_queue(p_actor_type text, p_actor_id text, p_status text)
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
  if p_status is not null and p_status not in ('new', 'resolved', 'dismissed') then perform private.merchant_write_error('VALIDATION_FAILED', 'status'); end if;
  return jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'targetType', r.target_type, 'merchantId', r.merchant_id, 'articleId', r.article_id,
               'slug', coalesce(m.slug, a.slug, r.target_slug), 'name', coalesce(m.name, a.title, r.target_name),
               'targetGone', (r.merchant_id is null and r.article_id is null),
               'reason', r.reason, 'note', r.note, 'contactEmail', r.contact_email, 'status', r.status,
               'adminNote', r.admin_note, 'createdAt', r.created_at, 'decidedAt', r.decided_at,
               'sameTargetOpen', (select count(*) from public.public_reports o
                                   where o.status = 'new' and o.id <> r.id and o.target_type = r.target_type
                                     and (o.merchant_id = r.merchant_id or o.article_id = r.article_id)))
               order by r.created_at desc)
        from (select * from public.public_reports where p_status is null or status = p_status order by created_at desc limit 200) r
        left join public.merchants m on m.id = r.merchant_id
        left join public.articles a on a.id = r.article_id), '[]'::jsonb),
    'counts', (select jsonb_build_object(
                 'new', count(*) filter (where status = 'new'),
                 'resolved', count(*) filter (where status = 'resolved'),
                 'dismissed', count(*) filter (where status = 'dismissed')) from public.public_reports));
end;
$$;

create or replace function public.public_report_decide(p_actor_type text, p_actor_id text, p_id uuid, p_status text, p_note text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_actor_type is distinct from 'admin' or p_actor_id is distinct from 'legacy_admin' then
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'admin_only');
  end if;
  if p_status is null or p_status not in ('new', 'resolved', 'dismissed') then perform private.merchant_write_error('VALIDATION_FAILED', 'status'); end if;
  if char_length(v_note) > 1000 then perform private.merchant_write_error('VALIDATION_FAILED', 'note'); end if;
  update public.public_reports
     set status = p_status, admin_note = coalesce(v_note, admin_note),
         decided_at = case when p_status = 'new' then null else now() end
   where id = p_id;
  if not found then perform private.merchant_write_error('RESOURCE_NOT_FOUND', 'report'); end if;
  return jsonb_build_object('status', 'applied');
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.public_report_submit(text,text,text,text,text,text)',
    'public.public_report_queue(text,text,text)',
    'public.public_report_decide(text,text,uuid,text,text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
    if has_function_privilege('anon', fn, 'execute') or has_function_privilege('authenticated', fn, 'execute') then
      raise exception 'Report self-check: wrong EXECUTE grants on %', fn;
    end if;
  end loop;
end $$;

commit;
