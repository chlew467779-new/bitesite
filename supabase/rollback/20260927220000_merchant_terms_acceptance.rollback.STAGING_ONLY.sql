-- STAGING ONLY. Removes pilot terms acceptance records after application rollback.
begin;
do $$ begin
  if 'NO' <> 'yes' then
    raise exception 'Rollback switch is off. Edit deliberately to allow this rollback.';
  end if;
end $$;
drop function if exists public.merchant_restaurant_create_v2(uuid, text, uuid, text);
drop table if exists private.merchant_terms_acceptances;
commit;
