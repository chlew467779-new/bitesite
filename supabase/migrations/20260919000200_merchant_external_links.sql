-- BiteSite M1: merchant-owned external action links.
-- V1 only exposes the GrabFood outbound link. No ordering or payment occurs on BiteSite.

begin;

create table if not exists public.merchant_external_links (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  link_type text not null check (link_type in ('grabfood')),
  url text not null check (url ~* '^https://'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, link_type)
);

alter table public.merchant_external_links enable row level security;
revoke all on public.merchant_external_links from anon, authenticated;
grant select on public.merchant_external_links to anon, authenticated;
grant all on public.merchant_external_links to service_role;

create policy merchant_external_links_public_read
  on public.merchant_external_links
  for select to anon, authenticated
  using (
    is_active = true
    and link_type = 'grabfood'
    and exists (
      select 1 from public.merchants
      where merchants.id = merchant_external_links.merchant_id
        and merchants.is_published = true
    )
  );

commit;
