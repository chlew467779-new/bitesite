begin;

-- Keep the public directory query (published merchants ordered by newest)
-- index-backed as the directory grows.
create index if not exists idx_merchants_published_created_at
  on public.merchants (is_published, created_at desc);

-- The homepage builds its product search index from available products
-- grouped by merchant.
create index if not exists idx_products_available_merchant
  on public.products (is_available, merchant_id);

commit;
