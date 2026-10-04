-- =====================================================================
-- Job posts (#23, CH 2026-10-04): restaurants post job openings, visitors apply by WhatsApp/phone.
-- =====================================================================
-- Only a PUBLIC restaurant's Owner (and Admin) can post. Posts are public at once (no pre-review);
-- Admin can hide a post with a note; visitors can report a post (public_reports target 'job').
-- A post is open for 30 days, then expires; the Owner can renew it (30 more days), close, reopen
-- or delete it. At most 10 open posts per restaurant. BiteSite stores no applicant data: the public
-- page links to the restaurant's own WhatsApp / phone.
--
--   public.merchant_jobs                       anon/authenticated read open, unhidden, unexpired
--                                              posts of public restaurants (column grants below)
--   public.merchant_jobs_read(actor, merchant) Owner/Admin: all posts of one restaurant + canPost
--   public.merchant_job_save(actor, merchant, job_id, title, type, salary, hours, description)
--       Create (job_id chosen by the client, so a retry cannot create twice) or update.
--   public.merchant_job_action(actor, merchant, job_id, 'close'|'renew'|'delete')
--   public.merchant_job_admin_list(admin, 'visible'|'hidden'|'all')
--   public.merchant_job_admin_hide(admin, job_id, hide, note)
--   public.public_report_submit / public_report_queue  now also accept target 'job' (slug = job id)
--
-- Local first; production with CH approval, after 20261004110000.
-- Rollback: supabase/rollback/20261004120000_merchant_jobs.rollback.STAGING_ONLY.sql
-- =====================================================================
begin;

create table public.merchant_jobs (
  id           uuid        primary key,
  merchant_id  uuid        not null references public.merchants(id) on delete cascade,
  title        text        not null,
  job_type     text        not null,
  salary       text,
  hours        text        not null,
  description  text        not null,
  status       text        not null default 'open',
  expires_at   timestamptz not null default now() + interval '30 days',
  hidden_at    timestamptz,
  hidden_note  text,
  created_by   text        not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint merchant_jobs_title_check check (char_length(title) between 2 and 80),
  constraint merchant_jobs_type_check check (job_type in ('full_time', 'part_time', 'temporary')),
  constraint merchant_jobs_salary_check check (salary is null or char_length(salary) between 1 and 80),
  constraint merchant_jobs_hours_check check (char_length(hours) between 1 and 120),
  constraint merchant_jobs_description_check check (char_length(description) between 1 and 1000),
  constraint merchant_jobs_status_check check (status in ('open', 'closed')),
  constraint merchant_jobs_hidden_note_check check (hidden_note is null or char_length(hidden_note) <= 500)
);
create index merchant_jobs_merchant_idx on public.merchant_jobs (merchant_id, created_at desc);
create index merchant_jobs_public_idx on public.merchant_jobs (expires_at desc) where status = 'open' and hidden_at is null;

alter table public.merchant_jobs enable row level security;
revoke all on table public.merchant_jobs from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.merchant_jobs to service_role;
grant select (id, merchant_id, title, job_type, salary, hours, description, expires_at, created_at, updated_at)
  on table public.merchant_jobs to anon, authenticated;
create policy merchant_jobs_public_read on public.merchant_jobs
  for select to anon, authenticated
  using (status = 'open' and hidden_at is null and expires_at > now() and private.merchant_id_is_public(merchant_id));
comment on table public.merchant_jobs is
  'Restaurant job posts. Public read: open, unhidden, unexpired posts of public restaurants (no created_by / hidden_note). Writes only through the merchant_job_* functions.';

create or replace function private.merchant_job_json(j public.merchant_jobs)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', j.id, 'title', j.title, 'jobType', j.job_type, 'salary', j.salary, 'hours', j.hours,
    'description', j.description, 'status', j.status, 'expiresAt', j.expires_at,
    'expired', j.expires_at <= now(), 'hidden', j.hidden_at is not null, 'hiddenNote', j.hidden_note,
    'live', j.status = 'open' and j.hidden_at is null and j.expires_at > now(),
    'createdAt', j.created_at, 'updatedAt', j.updated_at)
$$;

-- Owners may post only while the restaurant is public and not suspended/archived; Admin always.
create or replace function private.merchant_job_can_post(p_actor_type text, m public.merchants)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_actor_type = 'admin' or (
    private.merchant_is_public(m)
    and coalesce(m.platform_restriction, '') not in ('suspended', 'archived')
    and m.platform_status not in ('SUSPENDED', 'ARCHIVED'))
$$;

create or replace function private.merchant_job_open_count(p_merchant_id uuid, p_except uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer from public.merchant_jobs
   where merchant_id = p_merchant_id and status = 'open' and expires_at > now() and id is distinct from p_except
$$;

create or replace function public.merchant_jobs_read(p_actor_type text, p_actor_id text, p_merchant_id uuid)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  m public.merchants;
begin
  m := private.lock_merchant_for_actor(p_actor_type, p_actor_id, p_merchant_id, false);
  return jsonb_build_object(
    'canPost', private.merchant_job_can_post(p_actor_type, m),
    'openLimit', 10,
    'jobs', coalesce((select jsonb_agg(private.merchant_job_json(j) order by j.created_at desc)
                        from public.merchant_jobs j where j.merchant_id = m.id), '[]'::jsonb));
end;
$$;

create or replace function public.merchant_job_save(
  p_actor_type text, p_actor_id text, p_merchant_id uuid, p_job_id uuid,
  p_title text, p_job_type text, p_salary text, p_hours text, p_description text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_salary text := nullif(btrim(coalesce(p_salary, '')), '');
  v_hours text := btrim(coalesce(p_hours, ''));
  v_description text := btrim(coalesce(p_description, ''));
  m public.merchants;
  j public.merchant_jobs;
begin
  if p_job_id is null then perform private.merchant_write_error('VALIDATION_FAILED', 'job id is required'); end if;
  if char_length(v_title) not between 2 and 80 or v_title ~ '[[:cntrl:]]' then perform private.merchant_write_error('VALIDATION_FAILED', 'title'); end if;
  if p_job_type is null or p_job_type not in ('full_time', 'part_time', 'temporary') then perform private.merchant_write_error('VALIDATION_FAILED', 'job_type'); end if;
  if char_length(v_salary) > 80 or v_salary ~ '[[:cntrl:]]' then perform private.merchant_write_error('VALIDATION_FAILED', 'salary'); end if;
  if char_length(v_hours) not between 1 and 120 or v_hours ~ '[[:cntrl:]]' then perform private.merchant_write_error('VALIDATION_FAILED', 'hours'); end if;
  if char_length(v_description) not between 1 and 1000 or v_description ~ '[\x01-\x09\x0b-\x1f\x7f]' then perform private.merchant_write_error('VALIDATION_FAILED', 'description'); end if;

  m := private.lock_merchant_for_actor(p_actor_type, p_actor_id, p_merchant_id, false);
  if not private.merchant_job_can_post(p_actor_type, m) then perform private.merchant_write_error('JOB_NOT_ALLOWED', 'not_public'); end if;

  select * into j from public.merchant_jobs where id = p_job_id for update;
  if found then
    if j.merchant_id <> m.id then perform private.merchant_write_error('RESOURCE_NOT_FOUND', 'job'); end if;
    update public.merchant_jobs
       set title = v_title, job_type = p_job_type, salary = v_salary, hours = v_hours, description = v_description, updated_at = now()
     where id = j.id
     returning * into j;
    return jsonb_build_object('status', 'updated', 'job', private.merchant_job_json(j));
  end if;

  if private.merchant_job_open_count(m.id, null) >= 10 then perform private.merchant_write_error('JOB_LIMIT'); end if;
  insert into public.merchant_jobs (id, merchant_id, title, job_type, salary, hours, description, created_by)
  values (p_job_id, m.id, v_title, p_job_type, v_salary, v_hours, v_description,
          case when p_actor_type = 'admin' then 'admin' else p_actor_id end)
  returning * into j;
  return jsonb_build_object('status', 'created', 'job', private.merchant_job_json(j));
end;
$$;

create or replace function public.merchant_job_action(
  p_actor_type text, p_actor_id text, p_merchant_id uuid, p_job_id uuid, p_action text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  m public.merchants;
  j public.merchant_jobs;
begin
  if p_action is null or p_action not in ('close', 'renew', 'delete') then perform private.merchant_write_error('VALIDATION_FAILED', 'action'); end if;
  m := private.lock_merchant_for_actor(p_actor_type, p_actor_id, p_merchant_id, false);
  select * into j from public.merchant_jobs where id = p_job_id and merchant_id = m.id for update;
  if not found then perform private.merchant_write_error('RESOURCE_NOT_FOUND', 'job'); end if;

  if p_action = 'delete' then
    delete from public.merchant_jobs where id = j.id;
    return jsonb_build_object('status', 'deleted', 'id', j.id);
  elsif p_action = 'close' then
    update public.merchant_jobs set status = 'closed', updated_at = now() where id = j.id returning * into j;
  else
    if not private.merchant_job_can_post(p_actor_type, m) then perform private.merchant_write_error('JOB_NOT_ALLOWED', 'not_public'); end if;
    if private.merchant_job_open_count(m.id, j.id) >= 10 then perform private.merchant_write_error('JOB_LIMIT'); end if;
    update public.merchant_jobs set status = 'open', expires_at = now() + interval '30 days', updated_at = now()
     where id = j.id returning * into j;
  end if;
  return jsonb_build_object('status', 'applied', 'job', private.merchant_job_json(j));
end;
$$;

create or replace function public.merchant_job_admin_list(p_actor_type text, p_actor_id text, p_filter text)
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
  if p_filter is null or p_filter not in ('visible', 'hidden', 'all') then perform private.merchant_write_error('VALIDATION_FAILED', 'filter'); end if;
  return jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(private.merchant_job_json(j) || jsonb_build_object(
               'merchantId', m.id, 'merchantName', m.name, 'slug', m.slug,
               'merchantPublic', private.merchant_is_public(m),
               'openReports', (select count(*) from public.public_reports r where r.job_id = j.id and r.status = 'new'))
               order by j.created_at desc)
        from public.merchant_jobs j
        join public.merchants m on m.id = j.merchant_id
       where j.id in (select x.id from public.merchant_jobs x
                       where p_filter = 'all' or (p_filter = 'hidden') = (x.hidden_at is not null)
                       order by x.created_at desc limit 300)), '[]'::jsonb),
    'counts', (select jsonb_build_object(
                 'visible', count(*) filter (where hidden_at is null),
                 'hidden', count(*) filter (where hidden_at is not null),
                 'live', count(*) filter (where hidden_at is null and status = 'open' and expires_at > now()))
                 from public.merchant_jobs));
end;
$$;

create or replace function public.merchant_job_admin_hide(p_actor_type text, p_actor_id text, p_job_id uuid, p_hide boolean, p_note text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  j public.merchant_jobs;
begin
  if p_actor_type is distinct from 'admin' or p_actor_id is distinct from 'legacy_admin' then
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'admin_only');
  end if;
  if p_hide is null then perform private.merchant_write_error('VALIDATION_FAILED', 'hide'); end if;
  if p_hide and v_note is null then perform private.merchant_write_error('VALIDATION_FAILED', 'note_required'); end if;
  if char_length(v_note) > 500 then perform private.merchant_write_error('VALIDATION_FAILED', 'note_too_long'); end if;
  update public.merchant_jobs
     set hidden_at = case when p_hide then coalesce(hidden_at, now()) end,
         hidden_note = case when p_hide then v_note end,
         updated_at = now()
   where id = p_job_id
   returning * into j;
  if not found then perform private.merchant_write_error('RESOURCE_NOT_FOUND', 'job'); end if;
  return jsonb_build_object('status', 'applied', 'job', private.merchant_job_json(j));
end;
$$;

-- ---------------------------------------------------------------------
-- Visitor reports: target 'job' (slug = the job id). Same limits and duplicate rule as before.
-- ---------------------------------------------------------------------
alter table public.public_reports add column job_id uuid references public.merchant_jobs(id) on delete set null;
alter table public.public_reports drop constraint public_reports_target_check;
alter table public.public_reports add constraint public_reports_target_check check (
  (target_type = 'merchant' and article_id is null and job_id is null and reason in ('closed', 'address', 'phone', 'hours', 'menu', 'duplicate', 'fake', 'other'))
  or (target_type = 'story' and merchant_id is null and job_id is null and reason in ('rights', 'personal_data', 'misleading', 'offensive', 'other'))
  or (target_type = 'job' and article_id is null and reason in ('scam', 'misleading', 'discriminatory', 'filled', 'other')));
create index public_reports_job_idx on public.public_reports (job_id) where job_id is not null;

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
  v_job uuid;
  v_slug text;
  v_name text;
  v_id uuid;
begin
  if p_target_type is null or p_target_type not in ('merchant', 'story', 'job') then perform private.merchant_write_error('VALIDATION_FAILED', 'target_type'); end if;
  if p_reporter_hash is null or p_reporter_hash !~ '^[0-9a-f]{64}$' then perform private.merchant_write_error('VALIDATION_FAILED', 'reporter'); end if;
  if char_length(v_note) > 1000 then perform private.merchant_write_error('VALIDATION_FAILED', 'note'); end if;
  if v_contact is not null and (char_length(v_contact) > 254 or v_contact !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    perform private.merchant_write_error('VALIDATION_FAILED', 'contact_email');
  end if;

  if p_target_type = 'merchant' then
    if p_reason is null or p_reason not in ('closed', 'address', 'phone', 'hours', 'menu', 'duplicate', 'fake', 'other') then perform private.merchant_write_error('VALIDATION_FAILED', 'reason'); end if;
    select m.id, m.slug, m.name into v_merchant, v_slug, v_name from public.merchants m
     where m.slug = p_slug and private.merchant_is_public(m);
  elsif p_target_type = 'story' then
    if p_reason is null or p_reason not in ('rights', 'personal_data', 'misleading', 'offensive', 'other') then perform private.merchant_write_error('VALIDATION_FAILED', 'reason'); end if;
    select a.id, a.slug, a.title into v_article, v_slug, v_name from public.articles a
     where a.slug = p_slug and private.article_is_public(a);
  else
    if p_reason is null or p_reason not in ('scam', 'misleading', 'discriminatory', 'filled', 'other') then perform private.merchant_write_error('VALIDATION_FAILED', 'reason'); end if;
    if p_slug is not null and p_slug ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select j.id, j.merchant_id, j.id::text, left(j.title || ' — ' || m.name, 300) into v_job, v_merchant, v_slug, v_name
        from public.merchant_jobs j join public.merchants m on m.id = j.merchant_id
       where j.id = p_slug::uuid and j.status = 'open' and j.hidden_at is null and j.expires_at > now() and private.merchant_is_public(m);
    end if;
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

  insert into public.public_reports (target_type, merchant_id, article_id, job_id, target_slug, target_name, reason, note, contact_email, reporter_hash)
  values (p_target_type, v_merchant, v_article, v_job, v_slug, v_name, p_reason, v_note, v_contact, p_reporter_hash)
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
               'id', r.id, 'targetType', r.target_type, 'merchantId', r.merchant_id, 'articleId', r.article_id, 'jobId', r.job_id,
               'slug', case when r.target_type = 'job' then coalesce(m.slug, r.target_slug) else coalesce(m.slug, a.slug, r.target_slug) end,
               'name', case when r.target_type = 'job' then coalesce(jb.title || ' — ' || m.name, r.target_name) else coalesce(m.name, a.title, r.target_name) end,
               'targetGone', case when r.target_type = 'job' then r.job_id is null else (r.merchant_id is null and r.article_id is null) end,
               'reason', r.reason, 'note', r.note, 'contactEmail', r.contact_email, 'status', r.status,
               'adminNote', r.admin_note, 'createdAt', r.created_at, 'decidedAt', r.decided_at,
               'sameTargetOpen', (select count(*) from public.public_reports o
                                   where o.status = 'new' and o.id <> r.id and o.target_type = r.target_type
                                     and (case when r.target_type = 'job' then o.job_id = r.job_id
                                               else (o.merchant_id = r.merchant_id or o.article_id = r.article_id) end)))
               order by r.created_at desc)
        from (select * from public.public_reports where p_status is null or status = p_status order by created_at desc limit 200) r
        left join public.merchants m on m.id = r.merchant_id
        left join public.articles a on a.id = r.article_id
        left join public.merchant_jobs jb on jb.id = r.job_id), '[]'::jsonb),
    'counts', (select jsonb_build_object(
                 'new', count(*) filter (where status = 'new'),
                 'resolved', count(*) filter (where status = 'resolved'),
                 'dismissed', count(*) filter (where status = 'dismissed')) from public.public_reports));
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.merchant_jobs_read(text,text,uuid)',
    'public.merchant_job_save(text,text,uuid,uuid,text,text,text,text,text)',
    'public.merchant_job_action(text,text,uuid,uuid,text)',
    'public.merchant_job_admin_list(text,text,text)',
    'public.merchant_job_admin_hide(text,text,uuid,boolean,text)',
    'public.public_report_submit(text,text,text,text,text,text)',
    'public.public_report_queue(text,text,text)',
    'private.merchant_job_json(public.merchant_jobs)',
    'private.merchant_job_can_post(text,public.merchants)',
    'private.merchant_job_open_count(uuid,uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
    if has_function_privilege('anon', fn, 'execute') or has_function_privilege('authenticated', fn, 'execute') then
      raise exception 'Jobs self-check: wrong EXECUTE grants on %', fn;
    end if;
  end loop;
end $$;

commit;
