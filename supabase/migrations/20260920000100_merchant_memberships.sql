-- Merchant sign-in is intentionally separate from the legacy admin HMAC flow.
begin;

create table if not exists public.merchant_memberships (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  unique (merchant_id, user_id)
);

alter table public.merchant_memberships enable row level security;
revoke all on public.merchant_memberships from anon, authenticated;
grant select on public.merchant_memberships to authenticated;
grant all on public.merchant_memberships to service_role;

drop policy if exists merchant_memberships_self on public.merchant_memberships;
create policy merchant_memberships_self on public.merchant_memberships
  for select to authenticated using (user_id = auth.uid());

-- Merchant profile mutations must go through the server-side API.
-- Do not allow authenticated users to update merchants directly.
drop policy if exists merchants_owner_write on public.merchants;
revoke update on public.merchants from authenticated;

commit;
