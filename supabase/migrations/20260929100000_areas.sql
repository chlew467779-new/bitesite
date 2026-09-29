-- =====================================================================
-- Areas: a fixed list of areas (country -> state -> area), CH decision 2026-09-29 (issue #7).
--
--   public.areas                 the list; anyone may read active rows, only service_role writes
--   private.area_canonical(text) exact name or alias (case-insensitive) -> the list's spelling, or null
--   merchants.area               stays a text column holding an area name; a BEFORE trigger turns
--                                "sungai besi" / "PJ" into the listed spelling and refuses anything
--                                not on the list (VALIDATION_FAILED / area), so every writer
--                                (owner draft edit, basics request approval, admin form) is covered.
--   merchant_basics_requests     the same check runs when an owner sends a request, so a bad area
--                                is refused at once instead of at approval.
--
-- Names are unique across the whole list (case-insensitive), so an area name alone identifies
-- its state and country. Kuala Lumpur and Putrajaya count as states. Singapore will list its
-- areas with state = 'Singapore'.
-- Existing rows: names/aliases are mapped to the listed spelling; 'Sungai' (a test store in
-- Taman Sungai Besi) becomes 'Sungai Besi'; anything else is cleared and reported by NOTICE.
-- =====================================================================

create table public.areas (
  id         uuid        primary key default gen_random_uuid(),
  country    text        not null default 'MY',
  state      text        not null,
  name       text        not null,
  aliases    text[]      not null default '{}'::text[],
  is_active  boolean     not null default true,
  created_at timestamptz not null default now(),
  constraint areas_country_check check (country in ('MY', 'SG')),
  constraint areas_state_check check (char_length(btrim(state)) between 1 and 60 and state = btrim(state)),
  constraint areas_name_check check (char_length(btrim(name)) between 1 and 80 and name = btrim(name))
);
create unique index areas_name_key on public.areas (lower(name));

alter table public.areas enable row level security;
create policy areas_public_read on public.areas for select to anon, authenticated using (is_active);
revoke all on public.areas from anon, authenticated;
grant select on public.areas to anon, authenticated;

insert into public.areas (state, name, aliases) values
  ('Kuala Lumpur', 'Bangsar',              '{}'),
  ('Kuala Lumpur', 'Brickfields',          '{}'),
  ('Kuala Lumpur', 'Bukit Bintang',        '{}'),
  ('Kuala Lumpur', 'Bukit Jalil',          '{}'),
  ('Kuala Lumpur', 'Cheras',               '{}'),
  ('Kuala Lumpur', 'Chinatown',            '{"Petaling Street"}'),
  ('Kuala Lumpur', 'Desa ParkCity',        '{"Desa Park City"}'),
  ('Kuala Lumpur', 'Kepong',               '{}'),
  ('Kuala Lumpur', 'KLCC',                 '{}'),
  ('Kuala Lumpur', 'Kuchai Lama',          '{}'),
  ('Kuala Lumpur', 'Mont Kiara',           '{}'),
  ('Kuala Lumpur', 'Old Klang Road',       '{"OKR","Jalan Klang Lama"}'),
  ('Kuala Lumpur', 'Salak South',          '{}'),
  ('Kuala Lumpur', 'Segambut',             '{}'),
  ('Kuala Lumpur', 'Sentul',               '{}'),
  ('Kuala Lumpur', 'Setapak',              '{}'),
  ('Kuala Lumpur', 'Sri Petaling',         '{"Seri Petaling"}'),
  ('Kuala Lumpur', 'Sungai Besi',          '{"Sg Besi"}'),
  ('Kuala Lumpur', 'Taman Tun Dr Ismail',  '{"TTDI"}'),
  ('Kuala Lumpur', 'Wangsa Maju',          '{}'),
  ('Selangor',     'Ampang',               '{}'),
  ('Selangor',     'Ara Damansara',        '{}'),
  ('Selangor',     'Cyberjaya',            '{}'),
  ('Selangor',     'Damansara',            '{}'),
  ('Selangor',     'Kajang',               '{}'),
  ('Selangor',     'Klang',                '{}'),
  ('Selangor',     'Kota Damansara',       '{}'),
  ('Selangor',     'Petaling Jaya',        '{"PJ"}'),
  ('Selangor',     'Puchong',              '{}'),
  ('Selangor',     'Rawang',               '{}'),
  ('Selangor',     'Seri Kembangan',       '{"Sri Kembangan"}'),
  ('Selangor',     'Shah Alam',            '{}'),
  ('Selangor',     'Subang Jaya',          '{"SS15"}'),
  ('Selangor',     'Sunway',               '{"Bandar Sunway"}'),
  ('Selangor',     'USJ',                  '{"Subang Jaya USJ"}'),
  ('Putrajaya',    'Putrajaya',            '{}');

create or replace function private.area_canonical(p_area text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select a.name
    from public.areas a
   where a.is_active
     and (lower(a.name) = lower(btrim(p_area))
          or lower(btrim(p_area)) in (select lower(x) from unnest(a.aliases) x))
   order by lower(a.name) = lower(btrim(p_area)) desc, a.name
   limit 1
$$;
revoke all on function private.area_canonical(text) from public, anon, authenticated;

-- Existing rows first, before the guard exists (the audit trigger records them as 'system').
do $$
declare r record;
begin
  perform set_config('app.actor_type', 'system', true);
  for r in select id, slug, area from public.merchants where area is not null loop
    if private.area_canonical(r.area) is null and lower(btrim(r.area)) <> 'sungai' then
      raise notice 'area cleared for %: %', r.slug, r.area;
    end if;
  end loop;
  update public.merchants m
     set area = coalesce(private.area_canonical(m.area), case when lower(btrim(m.area)) = 'sungai' then 'Sungai Besi' end)
   where m.area is not null
     and m.area is distinct from coalesce(private.area_canonical(m.area), case when lower(btrim(m.area)) = 'sungai' then 'Sungai Besi' end);
end $$;

create or replace function private.merchants_area_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  canon text;
begin
  if new.area is null or btrim(new.area) = '' then
    new.area := null;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.area is not distinct from old.area then
    return new;
  end if;
  canon := private.area_canonical(new.area);
  if canon is null then
    perform private.merchant_write_error('VALIDATION_FAILED', 'area');
  end if;
  new.area := canon;
  return new;
end;
$$;
create trigger merchants_area_guard
  before insert or update of area on public.merchants
  for each row execute function private.merchants_area_guard();
revoke all on function private.merchants_area_guard() from public, anon, authenticated, service_role;

create or replace function private.basics_request_area_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw   text;
  canon text;
begin
  if not (new.changes ? 'location') then
    return new;
  end if;
  raw := nullif(btrim(coalesce(new.changes -> 'location' ->> 'area', '')), '');
  if raw is null then
    return new;
  end if;
  canon := private.area_canonical(raw);
  if canon is null then
    perform private.merchant_write_error('VALIDATION_FAILED', 'area');
  end if;
  new.changes := jsonb_set(new.changes, '{location,area}', to_jsonb(canon));
  return new;
end;
$$;
create trigger merchant_basics_requests_area_guard
  before insert on public.merchant_basics_requests
  for each row execute function private.basics_request_area_guard();
revoke all on function private.basics_request_area_guard() from public, anon, authenticated, service_role;
