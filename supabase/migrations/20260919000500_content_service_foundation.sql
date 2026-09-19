-- Phase 3 foundation: simple 60-day content cadence and manual assisted-content tracking.

begin;

create table if not exists public.merchant_content_cycles (
  id uuid primary key default gen_random_uuid(),
  merchant_slug text not null,
  cycle_start_at timestamptz not null default now(),
  due_at timestamptz not null,
  status text not null default 'active'
    check (status in ('active', 'due', 'overdue', 'completed', 'inactive')),
  last_submission_id uuid references public.story_submissions(id) on delete set null,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_merchant_content_cycles_due
  on public.merchant_content_cycles(status, due_at);
create index if not exists idx_merchant_content_cycles_merchant
  on public.merchant_content_cycles(merchant_slug, created_at desc);

create table if not exists public.assisted_content_requests (
  id uuid primary key default gen_random_uuid(),
  merchant_slug text not null,
  cycle_id uuid references public.merchant_content_cycles(id) on delete set null,
  market text not null default 'MY' check (market in ('MY', 'SG')),
  currency text not null default 'MYR' check (currency in ('MYR', 'SGD')),
  price_amount numeric(10, 2) not null default 20.00 check (price_amount > 0),
  status text not null default 'requested'
    check (status in ('requested', 'paid', 'in_progress', 'completed', 'cancelled')),
  notes text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_assisted_content_requests_status
  on public.assisted_content_requests(status, requested_at desc);
create index if not exists idx_assisted_content_requests_merchant
  on public.assisted_content_requests(merchant_slug, created_at desc);

alter table public.merchant_content_cycles enable row level security;
alter table public.assisted_content_requests enable row level security;
revoke all on public.merchant_content_cycles from anon, authenticated;
revoke all on public.assisted_content_requests from anon, authenticated;
grant all on public.merchant_content_cycles to service_role;
grant all on public.assisted_content_requests to service_role;

commit;
