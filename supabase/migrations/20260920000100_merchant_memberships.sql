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

drop policy if exists merchants_owner_write on public.merchants;
create policy merchants_owner_write on public.merchants
  for update to authenticated
  using (exists (
    select 1 from public.merchant_memberships mm
    where mm.merchant_id = merchants.id
      and mm.user_id = auth.uid()
      and mm.status = 'active'
  ))
  with check (exists (
    select 1 from public.merchant_memberships mm
    where mm.merchant_id = merchants.id
      and mm.user_id = auth.uid()
      and mm.status = 'active'
  ));

grant update on public.merchants to authenticated;
commit;
