-- =====================================================================
-- Singapore, part 1 (#24, CH 2026-10-04): a currency per restaurant and Singapore areas.
-- =====================================================================
--   merchants.currency   'MYR' (default, shown "RM") or 'SGD' (shown "S$"). Public column.
--                        Chosen when the restaurant is created; the Owner can change it any time
--                        in the dashboard, without review (it only changes how prices are shown).
--   public.merchant_currency_set(actor, merchant, currency)   Owner or Admin; audited like other
--                        merchant edits (merchant_change_log via the D1a trigger).
--   public.areas         country 'SG', state 'Singapore': a starting list of common areas. Admin
--                        can add more in Admin › Areas (the full list comes from ChatGPT G20).
--                        Singapore's Chinatown is "Chinatown Singapore" (names are unique and
--                        Kuala Lumpur already has "Chinatown").
--
-- DEPLOY ORDER: this SQL FIRST, then the app (the app reads merchants.currency on public pages).
-- Rollback: supabase/rollback/20261004130000_singapore_currency.rollback.STAGING_ONLY.sql
-- =====================================================================
begin;

alter table public.merchants add column currency text not null default 'MYR';
alter table public.merchants add constraint merchants_currency_check check (currency in ('MYR', 'SGD'));
grant select (currency) on table public.merchants to anon, authenticated;

create or replace function public.merchant_currency_set(p_actor_type text, p_actor_id text, p_merchant_id uuid, p_currency text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  m public.merchants;
begin
  if p_currency is null or p_currency not in ('MYR', 'SGD') then perform private.merchant_write_error('VALIDATION_FAILED', 'currency'); end if;
  -- Read lock only: changing how prices are shown is allowed while a review is pending.
  m := private.lock_merchant_for_actor(p_actor_type, p_actor_id, p_merchant_id, false);
  if p_actor_type = 'owner' and (m.platform_restriction in ('suspended', 'archived') or m.platform_status in ('SUSPENDED', 'ARCHIVED')) then
    perform private.merchant_write_error('OPERATION_FORBIDDEN', 'restricted');
  end if;
  if m.currency = p_currency then
    return jsonb_build_object('status', 'noop', 'currency', m.currency);
  end if;
  perform set_config('app.actor_type', p_actor_type, true);
  perform set_config('app.actor_id', p_actor_id, true);
  perform set_config('app.request_id', gen_random_uuid()::text, true);
  perform set_config('app.operation', 'merchant_currency_set', true);
  update public.merchants set currency = p_currency where id = m.id;
  return jsonb_build_object('status', 'applied', 'currency', p_currency);
end;
$$;

revoke all on function public.merchant_currency_set(text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.merchant_currency_set(text, text, uuid, text) to service_role;

insert into public.areas (country, state, name, aliases) values
  ('SG', 'Singapore', 'Ang Mo Kio',          '{"AMK"}'),
  ('SG', 'Singapore', 'Bedok',               '{}'),
  ('SG', 'Singapore', 'Bishan',              '{}'),
  ('SG', 'Singapore', 'Bugis',               '{}'),
  ('SG', 'Singapore', 'Chinatown Singapore', '{"SG Chinatown"}'),
  ('SG', 'Singapore', 'Clarke Quay',         '{}'),
  ('SG', 'Singapore', 'Geylang',             '{}'),
  ('SG', 'Singapore', 'Holland Village',     '{"Holland V"}'),
  ('SG', 'Singapore', 'Jurong East',         '{}'),
  ('SG', 'Singapore', 'Katong',              '{"Joo Chiat"}'),
  ('SG', 'Singapore', 'Little India',        '{}'),
  ('SG', 'Singapore', 'Marina Bay',          '{}'),
  ('SG', 'Singapore', 'Novena',              '{}'),
  ('SG', 'Singapore', 'Orchard',             '{"Orchard Road"}'),
  ('SG', 'Singapore', 'Punggol',             '{}'),
  ('SG', 'Singapore', 'Serangoon',           '{}'),
  ('SG', 'Singapore', 'Tampines',            '{}'),
  ('SG', 'Singapore', 'Tanjong Pagar',       '{}'),
  ('SG', 'Singapore', 'Tiong Bahru',         '{}'),
  ('SG', 'Singapore', 'Toa Payoh',           '{}'),
  ('SG', 'Singapore', 'Woodlands',           '{}')
on conflict ((lower(name))) do nothing;

do $$
begin
  if not has_column_privilege('anon', 'public.merchants', 'currency', 'select') then
    raise exception 'Singapore self-check: anon cannot read merchants.currency';
  end if;
  if has_function_privilege('anon', 'public.merchant_currency_set(text,text,uuid,text)', 'execute')
     or has_function_privilege('authenticated', 'public.merchant_currency_set(text,text,uuid,text)', 'execute') then
    raise exception 'Singapore self-check: merchant_currency_set is open to browser roles';
  end if;
  if (select count(*) from public.areas where country = 'SG') < 21 then
    raise exception 'Singapore self-check: Singapore areas missing';
  end if;
end $$;

commit;
