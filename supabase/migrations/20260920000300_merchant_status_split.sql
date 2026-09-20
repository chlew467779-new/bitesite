-- Separate BiteSite listing lifecycle from the merchant's real-world business state.
begin;
alter table public.merchants
  add column if not exists platform_status text,
  add column if not exists business_status text;
update public.merchants
set platform_status = coalesce(platform_status, case when is_published then 'PUBLISHED' else 'DRAFT' end),
    business_status = coalesce(business_status, case when status = 'inactive' then 'TEMPORARILY_CLOSED' else 'OPEN' end);
alter table public.merchants
  alter column platform_status set default 'DRAFT',
  alter column platform_status set not null,
  alter column business_status set default 'OPEN',
  alter column business_status set not null;
alter table public.merchants drop constraint if exists merchants_platform_status_check;
alter table public.merchants add constraint merchants_platform_status_check check (platform_status in ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'SUSPENDED', 'ARCHIVED'));
alter table public.merchants drop constraint if exists merchants_business_status_check;
alter table public.merchants add constraint merchants_business_status_check check (business_status in ('OPEN', 'TEMPORARILY_CLOSED', 'MOVED', 'PERMANENTLY_CLOSED'));
create index if not exists idx_merchants_platform_status on public.merchants(platform_status);
create index if not exists idx_merchants_business_status on public.merchants(business_status);
commit;
