-- =====================================================================
-- Merchant feedback: Owners send feedback to the BiteSite team; Admin reads, replies and resolves.
-- =====================================================================
-- The dashboard Feedback form sent nothing (destination undecided). This stores it privately and
-- shows it on a new Admin Feedback page (RECOMMENDATION SYNC-052; no email is sent).
--
--   public.merchant_feedback_submit(owner, merchant, request_id, topic, message)
--       Active Owner only (membership rechecked under lock). Allowed while suspended, pending or
--       archived: the suspension notice tells Owners to contact BiteSite through Feedback.
--       Idempotent per request id (7 days); at most 10 per restaurant per hour (RATE_LIMITED).
--   public.merchant_feedback_list(actor, merchant)      the restaurant's last 20 items (Owner/Admin)
--   public.merchant_feedback_queue(admin, status|null)  newest first, up to 200
--   public.merchant_feedback_update(admin, id, status, reply)  status new/read/resolved and an
--       optional reply the Owner sees (<= 1000 chars). Setting a value is naturally idempotent.
--
-- Local first; staging and production each need CH approval, after 20260927150000.
-- Rollback: supabase/rollback/20260927160000_merchant_feedback.rollback.STAGING_ONLY.sql
-- =====================================================================
begin;

create table public.merchant_feedback (
  id           uuid        primary key default gen_random_uuid(),
  merchant_id  uuid        not null references public.merchants(id) on delete cascade,
  submitted_by uuid        not null,
  topic        text        not null,
  message      text        not null,
  status       text        not null default 'new',
  reply        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint merchant_feedback_topic_check check (topic in ('suggestion', 'problem', 'listing')),
  constraint merchant_feedback_message_check check (char_length(btrim(message)) between 1 and 2000),
  constraint merchant_feedback_status_check check (status in ('new', 'read', 'resolved')),
  constraint merchant_feedback_reply_check check (reply is null or char_length(reply) <= 1000)
);
create index merchant_feedback_merchant_idx on public.merchant_feedback (merchant_id, created_at desc);
create index merchant_feedback_queue_idx on public.merchant_feedback (status, created_at desc);
alter table public.merchant_feedback enable row level security;
revoke all on table public.merchant_feedback from public, anon, authenticated, service_role;
grant select, insert, update on table public.merchant_feedback to service_role;
comment on table public.merchant_feedback is
  'Owner feedback to the BiteSite team (SYNC-052). Private: no anon/authenticated privileges, RLS on, no policies.';

create or replace function private.merchant_feedback_json(f public.merchant_feedback)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('id', f.id, 'topic', f.topic, 'message', f.message, 'status', f.status,
                            'reply', f.reply, 'createdAt', f.created_at, 'updatedAt', f.updated_at)
$$;

create or replace function public.merchant_feedback_submit(
  p_actor_type  text,
  p_actor_id    text,
  p_merchant_id uuid,
  p_request_id  uuid,
  p_topic       text,
  p_message     text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_op constant text := 'merchant_feedback';
  v_message text := btrim(coalesce(p_message, ''));
  v_hash text;
  v_prev jsonb;
  f public.merchant_feedback;
  m public.merchants;
begin
  if p_actor_type is distinct from 'owner' then perform private.merchant_write_error('OPERATION_FORBIDDEN', 'owner_only'); end if;
  if p_request_id is null then perform private.merchant_write_error('VALIDATION_FAILED', 'request id is required'); end if;
  if p_topic is null or p_topic not in ('suggestion', 'problem', 'listing') then perform private.merchant_write_error('VALIDATION_FAILED', 'unknown topic'); end if;
  if char_length(v_message) not between 1 and 2000 then perform private.merchant_write_error('VALIDATION_FAILED', 'message_length'); end if;
  v_hash := encode(sha256(convert_to(jsonb_build_object('v', 1, 'op', v_op, 'merchant', p_merchant_id, 'topic', p_topic, 'message', v_message)::text, 'UTF8')), 'hex');
  -- Membership under lock, but not a "write": suspended/archived/pending Owners can still reach us.
  m := private.lock_merchant_for_actor(p_actor_type, p_actor_id, p_merchant_id, false);
  v_prev := private.merchant_link_replay(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash);
  if v_prev is not null then return v_prev; end if;
  if (select count(*) from public.merchant_feedback where merchant_id = m.id and created_at > now() - interval '1 hour') >= 10 then
    perform private.merchant_write_error('RATE_LIMITED');
  end if;
  insert into public.merchant_feedback (merchant_id, submitted_by, topic, message)
  values (m.id, p_actor_id::uuid, p_topic, v_message)
  returning * into f;
  return private.merchant_link_remember(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash, 'applied',
    jsonb_build_object('status', 'applied', 'feedback', private.merchant_feedback_json(f)));
end;
$$;

create or replace function public.merchant_feedback_list(p_actor_type text, p_actor_id text, p_merchant_id uuid)
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
  return coalesce((select jsonb_agg(private.merchant_feedback_json(f) order by f.created_at desc)
                     from (select * from public.merchant_feedback where merchant_id = m.id order by created_at desc limit 20) f), '[]'::jsonb);
end;
$$;

create or replace function public.merchant_feedback_queue(p_actor_type text, p_actor_id text, p_status text)
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
  if p_status is not null and p_status not in ('new', 'read', 'resolved') then
    perform private.merchant_write_error('VALIDATION_FAILED', 'unknown status');
  end if;
  return jsonb_build_object(
    'counts', (select jsonb_build_object(
                 'new', count(*) filter (where status = 'new'),
                 'read', count(*) filter (where status = 'read'),
                 'resolved', count(*) filter (where status = 'resolved')) from public.merchant_feedback),
    'items', coalesce((
      select jsonb_agg(private.merchant_feedback_json(f) || jsonb_build_object('merchantId', f.merchant_id, 'merchantName', m.name, 'slug', m.slug)
                       order by f.created_at desc)
        from (select * from public.merchant_feedback where p_status is null or status = p_status order by created_at desc limit 200) f
        join public.merchants m on m.id = f.merchant_id), '[]'::jsonb));
end;
$$;

create or replace function public.merchant_feedback_update(p_actor_type text, p_actor_id text, p_feedback_id uuid, p_status text, p_reply text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_reply text := nullif(btrim(coalesce(p_reply, '')), '');
  f public.merchant_feedback;
begin
  if p_actor_type is distinct from 'admin' or p_actor_id is distinct from 'legacy_admin' then
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'admin_only');
  end if;
  if p_status is null or p_status not in ('new', 'read', 'resolved') then perform private.merchant_write_error('VALIDATION_FAILED', 'unknown status'); end if;
  if char_length(v_reply) > 1000 then perform private.merchant_write_error('VALIDATION_FAILED', 'reply_too_long'); end if;
  update public.merchant_feedback set status = p_status, reply = v_reply, updated_at = now()
   where id = p_feedback_id
  returning * into f;
  if not found then perform private.merchant_write_error('RESOURCE_NOT_FOUND', 'feedback'); end if;
  return jsonb_build_object('status', 'applied', 'feedback', private.merchant_feedback_json(f));
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'private.merchant_feedback_json(public.merchant_feedback)',
    'public.merchant_feedback_submit(text,text,uuid,uuid,text,text)',
    'public.merchant_feedback_list(text,text,uuid)',
    'public.merchant_feedback_queue(text,text,text)',
    'public.merchant_feedback_update(text,text,uuid,text,text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
    if has_function_privilege('anon', fn, 'execute') or has_function_privilege('authenticated', fn, 'execute')
       or not has_function_privilege('service_role', fn, 'execute') then
      raise exception 'Feedback self-check: wrong EXECUTE grants on %', fn;
    end if;
  end loop;
  if has_table_privilege('anon', 'public.merchant_feedback', 'select') or has_table_privilege('authenticated', 'public.merchant_feedback', 'select') then
    raise exception 'Feedback self-check: merchant_feedback must be private';
  end if;
end $$;

commit;
