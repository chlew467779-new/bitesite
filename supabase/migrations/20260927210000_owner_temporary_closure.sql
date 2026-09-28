-- =====================================================================
-- Owners mark their restaurant temporarily closed (holiday, renovation) and open again.
-- =====================================================================
-- business_status was Admin-only (D2-C merchant_business_status_set). Owners now switch between
-- OPEN and TEMPORARILY_CLOSED themselves, with an optional note (<= 200 chars) and expected reopening
-- date (today .. +365 days). MOVED and PERMANENTLY_CLOSED stay with Admin: an Owner cannot leave or
-- enter them here.
--
--   public.merchant_closure_notices   one row per restaurant while temporarily closed; public read
--       for restaurants that are public (same predicate as dishes and categories). Keeps the D1b
--       merchant projection unchanged.
--   public.merchant_owner_business_status(owner, merchant, request_id, status, note, reopen_on)
--       lock_merchant_for_actor (write: suspended/archived/pending refused), idempotent per request id,
--       audited by the D1a trigger as merchant_owner_business_status. Opening removes the notice.
--
-- Local first; staging and production each need CH approval, after 20260927200000.
-- Rollback: supabase/rollback/20260927210000_owner_temporary_closure.rollback.STAGING_ONLY.sql
-- =====================================================================
begin;

create table public.merchant_closure_notices (
  merchant_id uuid        primary key references public.merchants(id) on delete cascade,
  note        text,
  reopen_on   date,
  updated_at  timestamptz not null default now(),
  constraint merchant_closure_notices_note_check check (note is null or char_length(note) between 1 and 200)
);
alter table public.merchant_closure_notices enable row level security;
revoke all on table public.merchant_closure_notices from public, anon, authenticated, service_role;
grant select on table public.merchant_closure_notices to anon, authenticated;
grant select, insert, update, delete on table public.merchant_closure_notices to service_role;
create policy merchant_closure_notices_public_read on public.merchant_closure_notices
  for select to anon, authenticated
  using (private.merchant_id_is_public(merchant_id));
comment on table public.merchant_closure_notices is
  'Owner note and expected reopening date while a restaurant is temporarily closed. Public read only for public restaurants.';

create or replace function public.merchant_owner_business_status(
  p_actor_type  text,
  p_actor_id    text,
  p_merchant_id uuid,
  p_request_id  uuid,
  p_status      text,
  p_note        text,
  p_reopen_on   date
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_op constant text := 'merchant_owner_business_status';
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  v_hash text;
  v_prev jsonb;
  m public.merchants;
begin
  if p_actor_type is distinct from 'owner' then perform private.merchant_write_error('OPERATION_FORBIDDEN', 'owner_only'); end if;
  if p_request_id is null then perform private.merchant_write_error('VALIDATION_FAILED', 'request id is required'); end if;
  if p_status is null or p_status not in ('OPEN', 'TEMPORARILY_CLOSED') then perform private.merchant_write_error('VALIDATION_FAILED', 'owner_status'); end if;
  if char_length(v_note) > 200 then perform private.merchant_write_error('VALIDATION_FAILED', 'note_too_long'); end if;
  if p_reopen_on is not null and (p_reopen_on < v_today or p_reopen_on > v_today + 365) then
    perform private.merchant_write_error('VALIDATION_FAILED', 'reopen_date');
  end if;
  if p_status = 'OPEN' then v_note := null; end if;
  v_hash := encode(sha256(convert_to(jsonb_build_object('v', 1, 'op', v_op, 'merchant', p_merchant_id, 'status', p_status,
    'note', v_note, 'reopen', case when p_status = 'OPEN' then null else p_reopen_on end)::text, 'UTF8')), 'hex');

  m := private.lock_merchant_for_actor(p_actor_type, p_actor_id, p_merchant_id, true);
  v_prev := private.merchant_link_replay(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash);
  if v_prev is not null then return v_prev; end if;
  if m.business_status not in ('OPEN', 'TEMPORARILY_CLOSED') then
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'admin_business_status');
  end if;

  perform set_config('app.actor_type', p_actor_type, true);
  perform set_config('app.actor_id', p_actor_id, true);
  perform set_config('app.request_id', p_request_id::text, true);
  perform set_config('app.operation', v_op || ':' || p_status, true);
  if m.business_status <> p_status then
    update public.merchants set business_status = p_status where id = m.id returning * into m;
  end if;
  if p_status = 'OPEN' then
    delete from public.merchant_closure_notices where merchant_id = m.id;
  else
    insert into public.merchant_closure_notices (merchant_id, note, reopen_on, updated_at)
    values (m.id, v_note, p_reopen_on, now())
    on conflict (merchant_id) do update set note = excluded.note, reopen_on = excluded.reopen_on, updated_at = now();
  end if;
  return private.merchant_link_remember(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash, 'applied',
    jsonb_build_object('status', 'applied', 'businessStatus', m.business_status, 'note', v_note,
                       'reopenOn', case when p_status = 'OPEN' then null else p_reopen_on end, 'slug', m.slug));
end;
$$;

-- Owner read of the current status and notice.
create or replace function public.merchant_owner_business_status_read(p_actor_type text, p_actor_id text, p_merchant_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  m public.merchants;
  n public.merchant_closure_notices;
begin
  if p_actor_type is distinct from 'owner' or p_actor_id is null
     or p_actor_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    perform private.merchant_write_error('RESOURCE_NOT_FOUND');
  end if;
  select mer.* into m from public.merchants mer
    join public.merchant_memberships mm on mm.merchant_id = mer.id
   where mer.id = p_merchant_id and mm.user_id = p_actor_id::uuid and mm.role = 'owner' and mm.status = 'active';
  if not found then perform private.merchant_write_error('RESOURCE_NOT_FOUND'); end if;
  select * into n from public.merchant_closure_notices where merchant_id = m.id;
  return jsonb_build_object('businessStatus', m.business_status, 'note', n.note, 'reopenOn', n.reopen_on,
                            'ownerCanChange', m.business_status in ('OPEN', 'TEMPORARILY_CLOSED'));
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.merchant_owner_business_status(text,text,uuid,uuid,text,text,date)',
    'public.merchant_owner_business_status_read(text,text,uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
    if has_function_privilege('anon', fn, 'execute') or has_function_privilege('authenticated', fn, 'execute')
       or not has_function_privilege('service_role', fn, 'execute') then
      raise exception 'Owner closure self-check: wrong EXECUTE grants on %', fn;
    end if;
  end loop;
  if has_table_privilege('anon', 'public.merchant_closure_notices', 'insert') then
    raise exception 'Owner closure self-check: browser roles must not write notices';
  end if;
end $$;

commit;
