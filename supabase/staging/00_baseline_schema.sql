-- =====================================================================
-- BiteSite — BASELINE SCHEMA (schema only) for a NEW, EMPTY STAGING project
-- =====================================================================
-- Reproduces the PRODUCTION schema as observed read-only on 2026-09-19
-- (catalog queries E-01…E-12), INCLUDING its insecure pre-lockdown state
-- (RLS off on 10 tables, full anon/authenticated grants, permissive settings
-- policy) so that the lockdown migration is tested against realistic input.
--
--  * STAGING ONLY. Never run on production (production already has all of this).
--  * Contains NO data, NO users, NO secrets, NO connection strings.
--  * Kept outside supabase/migrations/ on purpose so `supabase db push` can
--    never apply it to a linked production project by accident.
--  * Run order on staging:  00_baseline_schema.sql -> 10_synthetic_seed.sql
--                           -> ../migrations/20260919000100_security_lockdown.sql
-- =====================================================================

-- Guard: refuse to run if this looks like a database that already has BiteSite tables.
do $$
begin
  if to_regclass('public.merchants') is not null then
    raise exception 'public.merchants already exists - this baseline is for an EMPTY staging project only';
  end if;
end $$;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- ---------- tables ----------
create table public.merchants (
  id                uuid not null default gen_random_uuid(),
  slug              text not null,
  name              text not null,
  description       text,
  cuisine_type      text,
  address           text,
  phone             text,
  whatsapp          text,
  email             text,
  website           text,
  instagram         text,
  facebook          text,
  cover_image       text,
  logo_image        text,
  operating_hours   jsonb,
  dress_code        text,
  menu_pdf_url      text,
  video_url         text,
  video_type        text default 'none'::text,
  video_caption     text,
  reference_website text,
  custom_style      boolean default false,
  style             character varying(20) default 'fresh'::character varying,
  is_published      boolean default false,
  created_at        timestamptz default now(),
  layout            text default 'classic'::text,
  features          jsonb default '{"hero": true, "menu": true, "about": true, "events": false, "contact": true, "gallery": false, "reviews": false, "appointment": false, "seasonal_popup": false}'::jsonb,
  settings          jsonb default '{}'::jsonb,
  status            text default 'active'::text,
  tags              text[] default '{}'::text[],
  area              character varying(100),
  payment_methods   text[] default '{}'::text[],
  latitude          double precision,
  longitude         double precision,
  reviews           jsonb,
  tagline           text,
  constraint merchants_pkey primary key (id),
  constraint merchants_slug_key unique (slug)
);

create table public.articles (
  id               uuid not null default gen_random_uuid(),
  slug             text not null,
  title            text not null,
  excerpt          text,
  content          text not null,
  cover_image      text,
  category         text not null,
  tags             text[],
  merchant_slug    text,
  author           text default 'BiteSite Team'::text,
  published        boolean default false,
  view_count       integer default 0,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  background_style text default 'default'::text,
  constraint articles_pkey primary key (id),
  constraint articles_slug_key unique (slug),
  constraint articles_merchant_slug_fkey foreign key (merchant_slug) references public.merchants(slug) on delete set null
);

create table public.categories (
  id          uuid not null default gen_random_uuid(),
  merchant_id uuid,
  name        text not null,
  sort_order  integer default 0,
  created_at  timestamptz default now(),
  constraint categories_pkey primary key (id),
  constraint categories_merchant_id_fkey foreign key (merchant_id) references public.merchants(id) on delete cascade
);

create table public.events (
  id          uuid not null default gen_random_uuid(),
  merchant_id uuid not null,
  title       text not null,
  description text,
  date        date not null,
  time        text,
  location    text,
  image_url   text,
  created_at  timestamptz default now(),
  constraint events_pkey primary key (id),
  constraint events_merchant_id_fkey foreign key (merchant_id) references public.merchants(id) on delete cascade
);

create table public.login_attempts (
  id              uuid not null default gen_random_uuid(),
  ip              text not null,
  attempt_count   integer default 1,
  last_attempt_at timestamptz default now(),
  locked_until    timestamptz,
  created_at      timestamptz default now(),
  constraint login_attempts_pkey primary key (id),
  constraint login_attempts_ip_key unique (ip)
);

create table public.merchant_daily_views (
  id            uuid not null default gen_random_uuid(),
  slug          text,
  page_type     text not null,
  view_date     date not null,
  device_type   text,
  country       text,
  city          text,
  os            text,
  browser       text,
  referrer_type text,
  event_type    text default 'page_view'::text,
  count         integer default 0,
  unique_ips    integer default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  constraint merchant_daily_views_pkey primary key (id),
  constraint merchant_daily_views_slug_page_type_view_date_device_type_c_key
    unique (slug, page_type, view_date, device_type, country, city, os, browser, referrer_type, event_type)
);

create table public.merchant_monthly_views (
  id         serial not null,
  slug       text not null,
  year_month text not null,
  view_count integer default 0,
  constraint merchant_monthly_views_pkey primary key (id),
  constraint merchant_monthly_views_slug_year_month_key unique (slug, year_month)
);

create table public.merchant_stats (
  slug           text not null,
  view_count     integer default 0,
  last_viewed_at timestamptz default now(),
  constraint merchant_stats_pkey primary key (slug)
);

create table public.merchant_videos (
  id          uuid not null default gen_random_uuid(),
  merchant_id uuid,
  video_url   text not null,
  video_type  character varying(20) default 'self_hosted'::character varying,
  caption     text,
  sort_order  integer default 0,
  created_at  timestamptz default now(),
  constraint merchant_videos_pkey primary key (id),
  constraint merchant_videos_merchant_id_fkey foreign key (merchant_id) references public.merchants(id) on delete cascade
);

create table public.page_views (
  id            uuid not null default gen_random_uuid(),
  slug          text,
  path          text not null,
  page_type     text,
  event_type    text not null default 'page_view'::text,
  event_detail  text,
  ip            text,
  country       text,
  city          text,
  device_type   text,
  os            text,
  browser       text,
  user_agent    text,
  referrer      text,
  referrer_type text,
  metadata      jsonb default '{}'::jsonb,
  created_at    timestamptz default now(),
  constraint page_views_pkey primary key (id)
);

create table public.products (
  id             uuid not null default gen_random_uuid(),
  merchant_id    uuid,
  category_id    uuid,
  name           text not null,
  description    text,
  price          numeric(10,2),
  image_url      text,
  is_featured    boolean default false,
  sort_order     integer default 0,
  created_at     timestamptz default now(),
  is_available   boolean default true,
  discount_price numeric(10,2),
  show_prices    boolean default true,
  constraint products_pkey primary key (id),
  constraint products_category_id_fkey foreign key (category_id) references public.categories(id) on delete cascade,
  constraint products_merchant_id_fkey foreign key (merchant_id) references public.merchants(id) on delete cascade
);

create table public.settings (
  id          serial not null,
  key         text not null,
  value       text not null,
  description text,
  updated_at  timestamptz default now(),
  constraint settings_pkey primary key (id),
  constraint settings_key_key unique (key)
);

-- ---------- indexes (non-constraint) ----------
create index idx_articles_category        on public.articles using btree (category);
create index idx_articles_created_at      on public.articles using btree (created_at desc);
create index idx_articles_published       on public.articles using btree (published);
create index idx_daily_views_date         on public.merchant_daily_views using btree (view_date);
create index idx_daily_views_event        on public.merchant_daily_views using btree (event_type);
create index idx_daily_views_page_type    on public.merchant_daily_views using btree (page_type);
create index idx_daily_views_slug         on public.merchant_daily_views using btree (slug);
create index idx_events_merchant          on public.events using btree (merchant_id);
create index idx_login_attempts_ip        on public.login_attempts using btree (ip);
create index idx_login_attempts_locked    on public.login_attempts using btree (locked_until);
create index idx_merchants_lat_lng        on public.merchants using btree (latitude, longitude);
create index idx_page_views_country_city  on public.page_views using btree (country, city);
create index idx_page_views_created_at    on public.page_views using btree (created_at);
create index idx_page_views_device        on public.page_views using btree (device_type);
create index idx_page_views_event_type    on public.page_views using btree (event_type);
create index idx_page_views_page_type     on public.page_views using btree (page_type);
create index idx_page_views_path          on public.page_views using btree (path);
create index idx_page_views_referrer      on public.page_views using btree (referrer_type);
create index idx_page_views_slug          on public.page_views using btree (slug);

-- ---------- functions (as in production: SECURITY INVOKER, no fixed search_path) ----------
create or replace function public.increment_view_count(merchant_slug text)
returns void language plpgsql as $function$
declare
  current_month text;
begin
  current_month := to_char(now(), 'YYYY-MM');

  insert into merchant_stats (slug, view_count, last_viewed_at)
  values (merchant_slug, 1, now())
  on conflict (slug) do update
    set view_count = merchant_stats.view_count + 1,
        last_viewed_at = now();

  insert into merchant_monthly_views (slug, year_month, view_count)
  values (merchant_slug, current_month, 1)
  on conflict (slug, year_month) do update
    set view_count = merchant_monthly_views.view_count + 1;
end;
$function$;

create or replace function public.increment_article_view(article_slug text)
returns void language plpgsql as $function$
begin
  update articles set view_count = view_count + 1 where slug = article_slug;
end;
$function$;

create or replace function public.aggregate_daily_views()
returns void language plpgsql as $function$
begin
  insert into merchant_daily_views (
    slug, page_type, view_date, device_type, country, city, os, browser,
    referrer_type, event_type, count, unique_ips
  )
  select
    slug, page_type, date(created_at) as view_date, device_type, country, city, os, browser,
    referrer_type, event_type, count(*) as count, count(distinct ip) as unique_ips
  from page_views
  where created_at >= current_date - interval '2 days'
  group by slug, page_type, date(created_at), device_type, country, city, os, browser, referrer_type, event_type
  on conflict (slug, page_type, view_date, device_type, country, city, os, browser, referrer_type, event_type)
  do update set count = excluded.count, unique_ips = excluded.unique_ips, updated_at = now();
end;
$function$;

-- ---------- RLS + policies exactly as observed in production ----------
alter table public.events   enable row level security;
alter table public.settings enable row level security;

create policy "Allow public read"         on public.events   for select to public using (true);
create policy "Allow all read settings"   on public.settings for select to public using (true);
create policy "Allow all update settings" on public.settings for all    to public using (true) with check (true);
-- (the other 10 tables have RLS DISABLED in production — reproduced here on purpose)

-- ---------- grants exactly as observed in production (anon/authenticated: everything) ----------
grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

-- ---------- pg_cron job (production has: aggregate-views-hourly, hourly, active) ----------
-- pg_cron must be enabled first (Supabase dashboard: Integrations -> Cron), otherwise this block is skipped with a notice.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('aggregate-views-hourly', '0 * * * *', 'SELECT aggregate_daily_views()');
  else
    raise notice 'pg_cron is not enabled: skipped scheduling aggregate-views-hourly (enable it, then re-run this block)';
  end if;
end $$;
