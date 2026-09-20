-- Merchant-controlled profile fields are updated directly. Identity and
-- lifecycle changes remain editorial decisions that an Admin reviews manually.
begin;

create table if not exists public.merchant_profile_change_requests (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  changes jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'resolved', 'rejected')),
  admin_notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text
);

create index if not exists idx_merchant_profile_change_requests_status_created
  on public.merchant_profile_change_requests(status, created_at desc);
create index if not exists idx_merchant_profile_change_requests_merchant_created
  on public.merchant_profile_change_requests(merchant_id, created_at desc);
create unique index if not exists idx_merchant_profile_change_requests_one_pending
  on public.merchant_profile_change_requests(merchant_id)
  where status = 'pending';

alter table public.merchant_profile_change_requests enable row level security;
revoke all on public.merchant_profile_change_requests from anon, authenticated;
grant all on public.merchant_profile_change_requests to service_role;

commit;
