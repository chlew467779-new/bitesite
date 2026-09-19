# supabase/

Only the SECURITY LOCKDOWN work lives here for now (branch `fix/security-lockdown`).

| Path | What | Where it may run |
|---|---|---|
| `staging/00_baseline_schema.sql` | Schema-only copy of production **as it was before the lockdown** (insecure on purpose). No data. | **Staging only**, empty project |
| `staging/10_synthetic_seed.sql` | Fake `zz-sec-test-*` rows | **Staging only** (refuses if real merchants exist) |
| `migrations/20260919000100_security_lockdown.sql` | The lockdown. One transaction, self-checking. | Staging first; production only after CTO review + CH approval |
| `tests/lockdown_assertions.sql` | Read-only catalog checks | Staging **and** production (after the migration) |
| `tests/lockdown_behavior_tests.sql` | Switches to anon/authenticated/service_role and tries to read/write; rolled back at the end | **Staging only** |
| `rollback/…STAGING_ONLY.sql` | Re-opens anonymous write access (guarded by a "NO → yes" switch) | Staging; production only as an approved emergency |

Staging order: baseline → seed → (optional: run behaviour tests, expect them to FAIL = proves the tests bite) → migration → assertions → behaviour tests → `scripts/test-anon-lockdown.mjs` → `scripts/test-admin-flow.mjs`.

Production deployment order (do not swap): set `SUPABASE_SERVICE_ROLE_KEY` on the server → deploy this branch → verify site + admin → run the migration → run `lockdown_assertions.sql`.
