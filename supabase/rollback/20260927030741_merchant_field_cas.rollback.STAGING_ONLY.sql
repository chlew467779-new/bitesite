-- =====================================================================
-- ROLLBACK of 20260927030741_merchant_field_cas.sql (D2-A) — STAGING ONLY.
-- =====================================================================
-- Removes the field save / insert RPCs, the lock helper, the registry and the idempotency table,
-- and restores the D1a audit trigger. Keeps merchant_change_log and its request_id / operation
-- columns (additive; existing audit history is never dropped).
--
-- Roll the application back to pre-D2-A code FIRST: after this rollback the D2-A Story and
-- change-request routes and the field endpoints fail (their RPCs are gone). Prefer a forward
-- fix. On production this needs an approved emergency and a backup taken first.
--
-- Two deliberate switches: the rollback itself, and permission to drop stored idempotency rows.
-- =====================================================================
begin;

do $$
begin
  if 'NO' <> 'yes' then  -- change 'NO' to 'yes' to allow this rollback
    raise exception 'Rollback switch is off. Edit the script deliberately if you really mean it.';
  end if;
  if exists (select 1 from public.request_idempotency) and 'KEEP' <> 'drop' then  -- change 'KEEP' to 'drop' to discard stored results
    raise exception 'request_idempotency holds % rows; export them or set the second switch deliberately.', (select count(*) from public.request_idempotency);
  end if;
end $$;

drop function if exists public.merchant_field_patch(text, text, uuid, uuid, jsonb);
drop function if exists public.merchant_field_snapshot_read(text, text, uuid);
drop function if exists public.merchant_story_submission_create(uuid, uuid, jsonb);
drop function if exists public.merchant_profile_change_request_create(uuid, uuid, jsonb);
drop function if exists public.request_idempotency_purge_expired(int);
drop function if exists private.merchant_field_snapshot(public.merchants, text, text);
drop function if exists private.merchant_field_registry();
drop function if exists private.lock_merchant_for_actor(text, text, uuid, boolean);
drop function if exists private.merchant_write_error(text, text);
drop function if exists private.merchant_has_valid_contact(public.merchants);
drop function if exists private.is_valid_contact_phone(text);
drop function if exists private.is_valid_contact_whatsapp(text);
drop function if exists private.is_valid_contact_email(text);
drop table if exists public.request_idempotency;

-- D1a audit trigger function, verbatim from 20260926093811_merchant_state_foundation.sql
create or replace function private.merchants_after_write_audit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  state_keys constant text[] := array[
    'review_status', 'listing_visibility', 'platform_restriction', 'business_status',
    'state_source', 'is_published', 'platform_status', 'first_published_at'
  ];
  old_json jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
  new_json jsonb := to_jsonb(new);
  paths text[];
  actor text := coalesce(nullif(current_setting('app.actor_type', true), ''), 'unknown');
begin
  if actor not in ('owner', 'admin', 'system', 'unknown') then
    actor := 'unknown';
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(k order by k), '{}')
      into paths
      from jsonb_object_keys(new_json) k
     where k not in ('revision', 'updated_at')
       and new_json -> k is distinct from old_json -> k;
    if cardinality(paths) = 0 then
      return null;
    end if;
  else
    paths := '{}';
  end if;

  insert into public.merchant_change_log
    (merchant_id, actor_type, actor_id, action, changed_paths, before, after, revision, reason)
  values (
    new.id,
    actor,
    nullif(current_setting('app.actor_id', true), ''),
    lower(tg_op),
    paths,
    case when tg_op = 'UPDATE' then
      (select coalesce(jsonb_object_agg(k, old_json -> k), '{}') from unnest(state_keys) k)
    end,
    (select coalesce(jsonb_object_agg(k, new_json -> k), '{}') from unnest(state_keys) k),
    new.revision,
    left(nullif(current_setting('app.change_reason', true), ''), 1000)
  );
  return null;
end;
$$;

revoke all on function private.merchants_after_write_audit() from public, anon, authenticated, service_role;

comment on column public.merchant_change_log.changed_paths is null;

commit;
