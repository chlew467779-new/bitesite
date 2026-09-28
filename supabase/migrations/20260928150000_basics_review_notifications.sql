-- Notify active Owners when an Admin approves or rejects a basics change request.
-- Local first; hosted migration requires separate approval.
begin;

alter table public.merchant_notifications
  drop constraint merchant_notifications_kind_check,
  add constraint merchant_notifications_kind_check check (kind in ('review_submitted', 'review_withdrawn', 'review_approved', 'review_rejected',
    'basics_approved', 'basics_rejected'));

create or replace function public.merchant_basics_review(
  p_actor_type text, p_actor_id text, p_request_id uuid, p_basics_request_id uuid, p_decision text, p_note text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_op constant text := 'merchant_basics_review';
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_hash text;
  v_prev jsonb;
  v_merchant uuid;
  v_current jsonb;
  v_patches jsonb;
  v_result jsonb;
  req public.merchant_basics_requests;
  m public.merchants;
begin
  if p_actor_type is distinct from 'admin' or p_actor_id is distinct from 'legacy_admin' then
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'admin_only');
  end if;
  if p_request_id is null or p_basics_request_id is null then perform private.merchant_write_error('VALIDATION_FAILED', 'ids are required'); end if;
  if p_decision is null or p_decision not in ('approve', 'reject') then perform private.merchant_write_error('VALIDATION_FAILED', 'unknown decision'); end if;
  if p_decision = 'reject' and v_note is null then perform private.merchant_write_error('VALIDATION_FAILED', 'note_required'); end if;
  if char_length(v_note) > 500 then perform private.merchant_write_error('VALIDATION_FAILED', 'note_too_long'); end if;

  select merchant_id into v_merchant from public.merchant_basics_requests where id = p_basics_request_id;
  if not found then perform private.merchant_write_error('RESOURCE_NOT_FOUND', 'basics_request'); end if;
  -- Lock order as everywhere: merchant row first, then the request.
  m := private.lock_merchant_for_actor(p_actor_type, p_actor_id, v_merchant, true);
  v_hash := encode(sha256(convert_to(jsonb_build_object('v', 1, 'op', v_op, 'id', p_basics_request_id, 'decision', p_decision, 'note', v_note)::text, 'UTF8')), 'hex');
  v_prev := private.merchant_link_replay(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash);
  if v_prev is not null then return v_prev; end if;

  select * into req from public.merchant_basics_requests where id = p_basics_request_id for update;
  if req.status <> 'pending' then perform private.merchant_write_error('VALIDATION_FAILED', 'not_pending'); end if;

  if p_decision = 'reject' then
    update public.merchant_basics_requests set status = 'rejected', decided_at = now(), review_note = v_note where id = req.id;
    insert into public.merchant_notifications (merchant_id, audience, kind, message)
      values (m.id, 'owner', 'basics_rejected', v_note);
    return private.merchant_link_remember(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash, 'applied',
      jsonb_build_object('status', 'applied', 'decision', 'reject'));
  end if;

  v_current := private.merchant_basics_snapshot(m);
  if exists (select 1 from jsonb_each(req.base) b where (v_current -> b.key) is distinct from b.value) then
    perform private.merchant_write_error('BASICS_CHANGED_SINCE_REQUEST');
  end if;
  select jsonb_agg(jsonb_build_object('path', c.key, 'expected', req.base -> c.key, 'value', c.value) order by c.key)
    into v_patches from jsonb_each(req.changes) c;
  -- The field-save contract validates every value again with today's rules and audits the write.
  v_result := public.merchant_field_patch(p_actor_type, p_actor_id, m.id, p_request_id, v_patches);
  if v_result ->> 'status' is distinct from 'applied' then
    perform private.merchant_write_error('BASICS_CHANGED_SINCE_REQUEST');
  end if;
  update public.merchant_basics_requests set status = 'approved', decided_at = now(), review_note = v_note where id = req.id;
  insert into public.merchant_notifications (merchant_id, audience, kind, message)
    values (m.id, 'owner', 'basics_approved', v_note);
  return private.merchant_link_remember(p_actor_type, p_actor_id, m.id, v_op, p_request_id, v_hash, 'applied',
    jsonb_build_object('status', 'applied', 'decision', 'approve', 'merchantId', m.id, 'slug', m.slug,
                       'changedPaths', v_result -> 'changedPaths'));
end;
$$;

revoke all on function public.merchant_basics_review(text,text,uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.merchant_basics_review(text,text,uuid,uuid,text,text) to service_role;

do $$ begin
  if has_function_privilege('anon', 'public.merchant_basics_review(text,text,uuid,uuid,text,text)', 'execute')
     or has_function_privilege('authenticated', 'public.merchant_basics_review(text,text,uuid,uuid,text,text)', 'execute')
     or not has_function_privilege('service_role', 'public.merchant_basics_review(text,text,uuid,uuid,text,text)', 'execute') then
    raise exception 'Basics notifications self-check: wrong EXECUTE grants';
  end if;
end $$;

commit;
