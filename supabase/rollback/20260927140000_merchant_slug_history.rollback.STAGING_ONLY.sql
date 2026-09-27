-- ROLLBACK of 20260927140000_merchant_slug_history.sql - STAGING ONLY.
-- Roll back the application first (store page redirect, Admin slug route/panel).
-- Current slugs stay as they are; old addresses stop redirecting (their history is dropped;
-- export public.merchant_slug_history first if needed). Articles keep their merchant_slug.
begin;
do $$ begin
  if 'NO' <> 'yes' then
    raise exception 'Rollback switch is off. Edit deliberately to allow this rollback.';
  end if;
end $$;
drop function if exists public.merchant_slug_read(text,text,uuid);
drop function if exists public.merchant_slug_change(text,text,uuid,uuid,text,text);
drop function if exists private.merchant_slug_valid(text);
drop trigger if exists merchants_slug_follow on public.merchants;
drop trigger if exists merchants_slug_guard on public.merchants;
drop function if exists private.merchants_slug_follow();
drop function if exists private.merchants_slug_guard();
drop table if exists public.merchant_slug_history;
alter table public.articles drop constraint articles_merchant_slug_fkey;
alter table public.articles add constraint articles_merchant_slug_fkey
  foreign key (merchant_slug) references public.merchants(slug) on delete set null;
-- Restore the M2-B (20260927130000) publication slug without the history check.
create or replace function private.merchant_publication_slug(m public.merchants)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  base text;
  candidate text;
  n int := 1;
begin
  if m.first_published_at is not null or m.slug <> 'restaurant-' || m.id::text or private.merchant_slug_referenced(m.slug) then
    return m.slug;
  end if;
  base := private.merchant_slug_base(m.name, m.id);
  candidate := base;
  while exists (select 1 from public.merchants where slug = candidate and id <> m.id) loop
    n := n + 1;
    if n > 50 then return base || '-' || left(m.id::text, 8); end if;
    candidate := base || '-' || n;
  end loop;
  return candidate;
end;
$$;
revoke all on function private.merchant_publication_slug(public.merchants) from public, anon, authenticated;
grant execute on function private.merchant_publication_slug(public.merchants) to service_role;
commit;
