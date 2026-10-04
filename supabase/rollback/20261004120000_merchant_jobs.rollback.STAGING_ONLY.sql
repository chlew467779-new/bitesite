-- =====================================================================
-- ROLLBACK of 20261004120000_merchant_jobs.sql - STAGING ONLY.
-- =====================================================================
-- The app hides job posting when the functions are missing, so rolling the app back is optional.
-- DELETES every job post and every visitor report about a job, then restores the visitor report
-- functions of 20260928130000.
-- =====================================================================
begin;
do $$ begin
  if 'NO' <> 'yes' then  -- change 'NO' to 'yes' to allow this rollback
    raise exception 'Rollback switch is off. Edit deliberately to allow this rollback.';
  end if;
end $$;

drop function if exists public.merchant_jobs_read(text, text, uuid);
drop function if exists public.merchant_job_save(text, text, uuid, uuid, text, text, text, text, text);
drop function if exists public.merchant_job_action(text, text, uuid, uuid, text);
drop function if exists public.merchant_job_admin_list(text, text, text);
drop function if exists public.merchant_job_admin_hide(text, text, uuid, boolean, text);
drop function if exists private.merchant_job_open_count(uuid, uuid);
drop function if exists private.merchant_job_can_post(text, public.merchants);
drop function if exists private.merchant_job_json(public.merchant_jobs);

delete from public.public_reports where target_type = 'job';
alter table public.public_reports drop constraint public_reports_target_check;
drop index if exists public.public_reports_job_idx;
alter table public.public_reports drop column job_id;
alter table public.public_reports add constraint public_reports_target_check check (
  (target_type = 'merchant' and article_id is null and reason in ('closed', 'address', 'phone', 'hours', 'menu', 'duplicate', 'fake', 'other'))
  or (target_type = 'story' and merchant_id is null and reason in ('rights', 'personal_data', 'misleading', 'offensive', 'other')));
drop table public.merchant_jobs;

-- Report functions as in 20260928130000:
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

commit;
