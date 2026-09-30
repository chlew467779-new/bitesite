-- =====================================================================
-- Pilot intake: Open / Limited / Paused (dashboard phase 3, #34).
-- =====================================================================
-- Before: "0 = stop new restaurants" and "100000 = no limit" were hidden inside two numbers.
-- Now private.merchant_review_settings.intake_mode says it plainly:
--   open     new restaurants can submit; no limit on total pilot places
--   limited  as before: pilot places (pending + approved) are capped by pilot_capacity
--   paused   nobody can submit (INTAKE_PAUSED); drafts, pending reviews and live restaurants
--            are untouched
-- The "waiting for review" queue limit (pending_capacity) still applies when open or limited;
-- both numbers are now at least 1 (pausing is the mode, not a 0).
-- Existing settings map across: a 0 becomes paused, 100000 becomes open, else limited.
--
-- merchant_listing_apply is copied from 20260927130000 with only the mode check added.
-- public.pilot_intake_status() tells anyone (Join us, the merchant draft panel) whether new
-- restaurants are being accepted, without any counts.
-- Rollback: supabase/rollback/20260930120000_pilot_intake_mode.rollback.STAGING_ONLY.sql
-- =====================================================================
begin;

alter table private.merchant_review_settings
  add column if not exists intake_mode text not null default 'limited';
alter table private.merchant_review_settings drop constraint if exists merchant_review_settings_intake_mode_check;
alter table private.merchant_review_settings
  add constraint merchant_review_settings_intake_mode_check check (intake_mode in ('open', 'limited', 'paused'));

update private.merchant_review_settings
   set intake_mode = case
         when pending_capacity = 0 or pilot_capacity = 0 then 'paused'
         when pilot_capacity >= 100000 then 'open'
         else 'limited'
       end,
       -- 0 and 100000 only ever meant "paused" / "no limit"; give them working numbers.
       pending_capacity = case when pending_capacity = 0 then 20 else pending_capacity end,
       pilot_capacity = case when pilot_capacity = 0 or pilot_capacity >= 100000 then 50 else pilot_capacity end,
       updated_at = now()
 where singleton;

create or replace function public.merchant_listing_apply(
  p_actor_type  text,
  p_actor_id    text,
  p_merchant_id uuid,
  p_request_id  uuid,
  p_action      text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_op constant text := 'merchant_listing';
  v_hash text;
  v_prev jsonb;
  v_check text;
  v_content jsonb;
  v_capacity int;
  v_pending int;
  v_pilot_capacity int;
  v_pilot_used int;
  v_mode text;
  v_slug text;
  v_old_slug text;
  v_submission uuid;
  m public.merchants;
begin
  if p_actor_type is distinct from 'owner' then
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'owner_only');
  end if;
  if p_request_id is null then
    perform private.merchant_write_error('VALIDATION_FAILED', 'request id is required');
  end if;
  if p_action is null or p_action not in ('submit', 'withdraw', 'publish', 'hide') then
    perform private.merchant_write_error('VALIDATION_FAILED', 'unknown action');
  end if;
  v_hash := encode(sha256(convert_to(jsonb_build_object('v', 1, 'op', v_op, 'merchant', p_merchant_id, 'action', p_action)::text, 'UTF8')), 'hex');

  -- Ownership under lock. Not a "write" lock: withdraw must work while pending; each action
  -- checks restriction and review state itself.
  m := private.lock_merchant_for_actor(p_actor_type, p_actor_id, p_merchant_id, false);
  v_prev := private.merchant_link_replay(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash);
  if v_prev is not null then return v_prev; end if;

  v_check := private.merchant_listing_check(m, p_action);
  if v_check = 'incomplete' then
    perform private.merchant_write_error('LISTING_INCOMPLETE', (
      select string_agg(c.key, ',' order by c.key) from jsonb_each(private.merchant_listing_checks(m)) c where c.value <> 'true'::jsonb));
  elsif v_check in ('contact', 'dish') then
    perform private.merchant_write_error('LISTING_INCOMPLETE', v_check);
  elsif v_check = 'suspended' then
    perform private.merchant_write_error('MERCHANT_SUSPENDED');
  elsif v_check not in ('ok', 'noop') then
    perform private.merchant_write_error('LISTING_ACTION_NOT_ALLOWED', v_check);
  end if;

  if v_check = 'noop' then
    return private.merchant_link_remember(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash, 'noop',
      jsonb_build_object('status', 'noop', 'action', p_action, 'slug', m.slug, 'state', private.merchant_listing_state(m)));
  end if;

  perform set_config('app.actor_type', p_actor_type, true);
  perform set_config('app.actor_id', p_actor_id, true);
  perform set_config('app.request_id', p_request_id::text, true);
  perform set_config('app.operation', v_op || ':' || p_action, true);

  if p_action = 'submit' then
    -- One pending submission per Owner: serialize this Owner's submits, then check.
    perform pg_advisory_xact_lock(hashtextextended('merchant_review_owner:' || p_actor_id, 0));
    if exists (select 1 from public.merchant_review_submissions where submitted_by = p_actor_id::uuid and status = 'pending') then
      perform private.merchant_write_error('REVIEW_ONE_PENDING');
    end if;
    -- Site-wide capacity: the settings row serializes every submit, so the last slot has one winner.
    select pending_capacity, pilot_capacity, intake_mode into v_capacity, v_pilot_capacity, v_mode
      from private.merchant_review_settings where singleton for update;
    -- Paused: Admin is not taking new restaurants at all (drafts stay saved).
    if v_mode = 'paused' then
      perform private.merchant_write_error('INTAKE_PAUSED');
    end if;
    select count(*) into v_pending from public.merchant_review_submissions where status = 'pending';
    if v_pending >= v_capacity then
      perform private.merchant_write_error('REVIEW_CAPACITY_FULL');
    end if;
    -- Limited: pending and approved restaurants reserve a pilot place. Open: no total limit.
    -- Only managed (self-registered) restaurants count; legacy restaurants never take a place.
    if v_mode = 'limited' then
      select count(*) into v_pilot_used from public.merchants
        where state_source = 'managed' and review_status in ('pending', 'approved');
      if v_pilot_used >= v_pilot_capacity then
        perform private.merchant_write_error('PILOT_CAPACITY_FULL');
      end if;
    end if;
    update public.merchants set review_status = 'pending' where id = m.id returning * into m;
    v_content := private.merchant_review_content(m);
    insert into public.merchant_review_submissions (merchant_id, submitted_by, snapshot, snapshot_hash)
    values (m.id, p_actor_id::uuid, v_content, private.merchant_review_hash(v_content))
    returning id into v_submission;
    insert into public.merchant_notifications (merchant_id, audience, kind, submission_id)
    values (m.id, 'admin', 'review_submitted', v_submission);
  elsif p_action = 'withdraw' then
    update public.merchant_review_submissions set status = 'withdrawn', decided_at = now()
     where merchant_id = m.id and status = 'pending'
    returning id into v_submission;
    update public.merchants set review_status = 'draft' where id = m.id returning * into m;
    insert into public.merchant_notifications (merchant_id, audience, kind, submission_id)
    values (m.id, 'admin', 'review_withdrawn', v_submission);
  elsif p_action = 'publish' then
    v_old_slug := m.slug;
    v_slug := private.merchant_publication_slug(m);
    update public.merchants set listing_visibility = 'public', slug = v_slug where id = m.id returning * into m;
  else
    update public.merchants set listing_visibility = 'hidden' where id = m.id returning * into m;
  end if;

  return private.merchant_link_remember(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash, 'applied',
    jsonb_build_object('status', 'applied', 'action', p_action, 'slug', m.slug, 'previousSlug', v_old_slug,
                       'state', private.merchant_listing_state(m)));
end;
$$;

create or replace function public.merchant_review_queue(p_actor_type text, p_actor_id text)
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
  return jsonb_build_object(
    'intakeMode', (select intake_mode from private.merchant_review_settings where singleton),
    'capacity', (select pending_capacity from private.merchant_review_settings where singleton),
    'pilotCapacity', (select pilot_capacity from private.merchant_review_settings where singleton),
    'pilotUsed', (select count(*) from public.merchants where state_source = 'managed' and review_status in ('pending', 'approved')),
    'pending', (select count(*) from public.merchant_review_submissions where status = 'pending'),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'merchantId', s.merchant_id, 'slug', m.slug, 'createdAt', s.created_at,
               'snapshot', s.snapshot,
               'changed', private.merchant_review_hash(private.merchant_review_content(m)) <> s.snapshot_hash,
               'restriction', private.merchant_governance_restriction(m))
             order by s.created_at)
        from (select * from public.merchant_review_submissions where status = 'pending' order by created_at limit 100) s
        join public.merchants m on m.id = s.merchant_id), '[]'::jsonb));
end;
$$;

drop function if exists public.merchant_review_capacity_set(text, text, integer, integer);
create or replace function public.merchant_review_capacity_set(p_actor_type text, p_actor_id text, p_capacity int, p_pilot_capacity int default null, p_intake_mode text default null)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  s private.merchant_review_settings;
begin
  if p_actor_type is distinct from 'admin' or p_actor_id is distinct from 'legacy_admin' then
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'admin_only');
  end if;
  if p_capacity is null or p_capacity not between 1 and 1000 then
    perform private.merchant_write_error('VALIDATION_FAILED', 'capacity must be 1..1000');
  end if;
  if p_pilot_capacity is not null and p_pilot_capacity not between 1 and 100000 then
    perform private.merchant_write_error('VALIDATION_FAILED', 'pilot capacity must be 1..100000');
  end if;
  if p_intake_mode is not null and p_intake_mode not in ('open', 'limited', 'paused') then
    perform private.merchant_write_error('VALIDATION_FAILED', 'intake mode must be open, limited or paused');
  end if;
  -- Setting values is naturally idempotent; lowering or pausing never cancels waiting submissions.
  update private.merchant_review_settings
     set pending_capacity = p_capacity,
         pilot_capacity = coalesce(p_pilot_capacity, pilot_capacity),
         intake_mode = coalesce(p_intake_mode, intake_mode),
         updated_at = now()
   where singleton returning * into s;
  return jsonb_build_object('intakeMode', s.intake_mode, 'capacity', s.pending_capacity, 'pilotCapacity', s.pilot_capacity,
    'pilotUsed', (select count(*) from public.merchants where state_source = 'managed' and review_status in ('pending', 'approved')),
    'pending', (select count(*) from public.merchant_review_submissions where status = 'pending'));
end;
$$;

-- Public: is BiteSite taking new restaurants right now? No counts, no merchant rows.
create or replace function public.pilot_intake_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('accepting', st.reason = 'open', 'reason', st.reason)
  from (
    select case
             when s.intake_mode = 'paused' then 'paused'
             when s.intake_mode = 'limited'
                  and (select count(*) from public.merchants where state_source = 'managed' and review_status in ('pending', 'approved')) >= s.pilot_capacity then 'full'
             when (select count(*) from public.merchant_review_submissions where status = 'pending') >= s.pending_capacity then 'busy'
             else 'open'
           end as reason
      from private.merchant_review_settings s where s.singleton
  ) st;
$$;

revoke all on function public.pilot_intake_status() from public, anon, authenticated;
grant execute on function public.pilot_intake_status() to anon, authenticated, service_role;
comment on function public.pilot_intake_status() is
  'Whether new restaurants can submit for review now. reason: open | busy (review queue full) | full (pilot places taken) | paused. No counts.';

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.merchant_listing_apply(text,text,uuid,uuid,text)',
    'public.merchant_review_queue(text,text)',
    'public.merchant_review_capacity_set(text,text,integer,integer,text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
    if has_function_privilege('anon', fn, 'execute') or has_function_privilege('authenticated', fn, 'execute')
       or not has_function_privilege('service_role', fn, 'execute') then
      raise exception 'Pilot intake self-check: wrong EXECUTE grants on %', fn;
    end if;
  end loop;
  if not has_function_privilege('anon', 'public.pilot_intake_status()', 'execute') then
    raise exception 'Pilot intake self-check: anon must read the intake status';
  end if;
  if (select count(*) from private.merchant_review_settings) <> 1 then
    raise exception 'Pilot intake self-check: exactly one settings row';
  end if;
end $$;

commit;
