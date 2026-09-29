-- Public aggregate only: historical partner count, including merchants no longer visible.
-- SECURITY DEFINER is required because anon cannot read hidden merchant rows.
create or replace function public.partner_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.merchants
  where first_published_at is not null;
$$;

-- Functions receive EXECUTE by PUBLIC by default; allow only the two Data API roles.
revoke all on function public.partner_count() from public, anon, authenticated;
grant execute on function public.partner_count() to anon, authenticated;

comment on function public.partner_count() is
  'Number of restaurants ever published on BiteSite; returns no merchant rows.';
