# supabase/

Only the SECURITY LOCKDOWN work lives here for now (branch `fix/security-lockdown`).

| Path | What | Where it may run |
|---|---|---|
| `staging/00_baseline_schema.sql` | Schema-only copy of production **as it was before the lockdown** (insecure on purpose). No data. | **Staging only**, empty project |
| `staging/10_synthetic_seed.sql` | Fake `zz-sec-test-*` rows | **Staging only** (refuses if real merchants exist) |
| `migrations/20260919000100_security_lockdown.sql` | The lockdown. One transaction, self-checking. | Staging first; production only after CTO review + CH approval |
| `tests/lockdown_assertions.sql` | Read-only catalog checks | Staging **and** production (after the migration) |
| `tests/lockdown_behavior_tests.sql` | Switches to anon/authenticated/service_role and tries to read/write; rolled back at the end | **Staging only** |
| `tests/analytics_aggregation_idempotence.sql` | Confirms rerunning the hourly analytics aggregate does not double-count buckets | **Staging only** |
| `rollback/…STAGING_ONLY.sql` | Re-opens anonymous write access (guarded by a "NO → yes" switch) | Staging; production only as an approved emergency |
| `migrations/20260926093811_merchant_state_foundation.sql` | D1a: canonical merchant state, shared public predicate, audit log, one active owner, private view counts. One transaction, self-checking; existing rows stay `legacy`. Converting a merchant to `managed` is possible only through `private.convert_merchant_to_managed(merchant_id, expected_revision, review_status, listing_visibility, platform_restriction, business_status, actor_id, reason)`, run as the database owner, one merchant per call, after CH approves that merchant’s mapping | Local → staging → production, each after review/approval |
| `tests/d1a_state_assertions.sql` | Read-only catalog checks for D1a | Local, staging **and** production (after the migration) |
| `tests/d1a_state_behavior_tests.sql` | Role-switching tests for D1a (synthetic `zz-d1a-*` rows, rolled back) | Local / staging only |
| `rollback/20260926093811_…STAGING_ONLY.sql` | Undoes D1a; re-opens AUD-04 and public view counts; refuses while managed merchants exist | Staging; production only as an approved emergency |
| `migrations/20260926101050_merchant_public_projection.sql` | D1b: anon/authenticated may read only the public `merchants` columns; child-table policies use `private.merchant_id_is_public(merchant_id)`. **Deploy the D1b application code first**: after this migration any public `select("*")` or `is_published` filter on merchants fails | Local → staging → production, each after review/approval |
| `tests/d1b_projection_assertions.sql` | Read-only catalog checks for D1b (exact column list, predicate function, child policies) | Local, staging **and** production (after the migration) |
| `tests/d1b_projection_behavior_tests.sql` | Role-switching tests for D1b (synthetic `zz-d1b-*` rows, rolled back) | Local / staging only |
| `rollback/20260926101050_…STAGING_ONLY.sql` | Undoes D1b; every merchants column becomes publicly readable again. The D1b code keeps working | Staging; production only as an approved emergency |

**Local database (Docker)**: create a throw-away Supabase project outside the repo (`supabase init` in a temp folder), put `create extension pg_cron;`, `staging/00_baseline_schema.sql`, `staging/10_synthetic_seed.sql` and then every file in `migrations/` into its `supabase/migrations/` in that order, run `supabase start`, and pipe each `tests/*.sql` into `docker exec -i supabase_db_<project> psql -U postgres -d postgres -v ON_ERROR_STOP=1`. Nothing in that flow touches staging or production.

Schema `private` must stay out of the Data API. After applying D1a to a hosted project, check it over HTTP with that project’s publishable (anon) key: a request with header `Accept-Profile: private` must return `PGRST106` ("Invalid schema").

Staging order: baseline → seed → (optional: run behaviour tests, expect them to FAIL = proves the tests bite) → migration → assertions → behaviour tests → `scripts/test-anon-lockdown.mjs` → `scripts/test-admin-flow.mjs`.

Production deployment order (do not swap): set `SUPABASE_SERVICE_ROLE_KEY` on the server → deploy this branch → verify site + admin → run the migration → run `lockdown_assertions.sql`.
