-- Audit trail for merchant ownership/member changes.
begin;

create table if not exists public.merchant_membership_audit (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid references public.merchant_memberships(id) on delete set null,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  action text not null check (action in ('linked', 'activated', 'suspended')),
  previous_user_id uuid references auth.users(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  actor text not null default 'admin',
  created_at timestamptz not null default now()
);

alter table public.merchant_membership_audit enable row level security;
revoke all on public.merchant_membership_audit from anon, authenticated;
grant all on public.merchant_membership_audit to service_role;

commit;
