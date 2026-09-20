-- POST-DEPLOY ONLY.
-- Run manually after the Merchant Tag Management code is live and verified.
-- This permanently clears the retired free-form discovery fields. It is not a
-- migration because running it before the new API is deployed would allow old
-- clients to repopulate the data.

begin;

update public.merchants
set
  cuisine_type = null,
  tags = '{}'::text[]
where cuisine_type is not null
   or tags is distinct from '{}'::text[];

commit;
