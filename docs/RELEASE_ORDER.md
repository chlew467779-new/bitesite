# Merchant feature release order

This is the release map for the local stack at `e24c720` (2026-09-27), not an instruction to run migrations or evidence that the whole stack is live. Sources: each migration's header, `supabase/README.md`, and Decision Log SYNC-042–047. No hosted changes were performed by the cleanup tasks.

## Current environment evidence

Production `bitesite-db` (`zpfkmzdtcbfpypntnkem`) migration history was read on 2026-09-27. It contains D1a `20260926093811`, D2-A under hosted version `20260927094252` / name `merchant_field_cas`, and password onboarding `20260927094313` / name `merchant_password_onboarding`. D2-A was applied during password feature PR #64; its application deployment did **not** include the D2-B editor stack. B0, D2-C, M6b, M3a and link review were absent from that history. Password auth is a separate branch/package and its migration is not present in this cleanup baseline.

Do not replay `20260927030741` just because its filename version is absent: the hosted tool assigned a different timestamp. Match the migration name, the executed SQL and current function definitions. Recheck history independently in staging and production before release; this document's snapshot can become stale. If an already-applied function needs correction, prepare a reviewed forward migration, not a replay of table creation.

The history also lacks some earlier repository migrations (including D1b/D1c). Verify their prerequisites and public projection/RLS state separately; this six-step map does not approve or silently apply that older backlog.

## Common procedure

For these RPC-based features, **apply the required migration before deploying its dependent application code**. Deploying the code first would expose controls whose RPCs do not exist. The old application should remain compatible with the additive migration; test this on local/staging first. The older “deploy branch, then security migration” sentence at the bottom of `supabase/README.md` concerns the initial security-lockdown release, not this RPC feature sequence.

Before each step, record the project/environment, migration history, intended application SHA and SQL checksum; check prerequisites and test the exact SQL/application combination locally and on staging. Use the existing `supabase/staging/00_baseline_schema.sql` and `10_synthetic_seed.sql` only in disposable local/staging databases. Confirm server environment variables and `private` staying outside the Data API; do not expose service-role keys to clients.

Run the SQL assertions/behaviour tests below with `psql -v ON_ERROR_STOP=1`, and require a zero exit status. Behaviour suites create synthetic rows and finish with ROLLBACK; their headers explicitly restrict them to local/staging. Do not run these fixture-generating suites against production. For hosted release, apply only the reviewed, still-missing migration, verify function definitions/grants/RLS read-only, deploy the matching application and smoke-test the authorized feature with test accounts. `npm run verify` and a Preview build check code, not hosted schema execution.

## 1. D2-A — atomic field saves

- Migration: `supabase/migrations/20260927030741_merchant_field_cas.sql`. Requires the D1a state/audit foundation and membership/change-request tables. Adds field snapshot/save RPCs, locked Owner checks, audited field changes and seven-day request replay; Story submission and profile change requests use the same locked authorization. It is already recorded in the production snapshot above.
- Application: `app/api/_lib/merchant-field-patch.ts`, Merchant/Admin `restaurants/[merchantId]/fields` or `merchants/[merchantId]/fields` routes, Merchant Story and profile change-request routes. Before the D2-B cutover, the old whole-form editor remains separate.
- Pre-release SQL: `supabase/tests/d2a_field_cas_assertions.sql` and `supabase/tests/d2a_field_cas_behavior_tests.sql`; overlapping requests: `scripts/test-d2a-concurrency-local.mjs`; HTTP contract: `scripts/test-d2a-routes-local.mjs`. Check conflicts write nothing, separate fields merge, replay is scoped, Owner membership is rechecked, archived ordinary writes are refused, no-op snapshots are returned, and browser roles cannot execute write RPCs.
- Post-release: verify RPCs and grants exist, the private idempotency records are not browser-readable, and authorized saves/retries preserve audit/revision semantics. Keep audit history; scheduling `request_idempotency_purge_expired` is a separate operation.
- Rollback: `supabase/rollback/20260927030741_merchant_field_cas.rollback.STAGING_ONLY.sql`. Roll application back first. Removes RPCs and idempotency storage, keeps audit history; explicit switches protect execution and dropping replay rows. Prefer a forward fix.

## 2. B0 — Admin field paths and D2-B editor prerequisite

- Migration: `supabase/migrations/20260927034414_merchant_field_cas_admin_fields.sql`, after D2-A. Extends the field registry/audit to Admin Name, Layout, Discovery tags and the atomic Location group; Owners cannot write these paths. No table/data conversion.
- Application: section-saving Merchant/Admin editors, including `app/admin/components/merchant-form.tsx`, `app/merchant/page.tsx`, section-save components and field endpoints. D2-B/M1-B retires whole-form Merchant/Admin writes and hard delete, uses section CAS, and guards switching/leaving with unsaved changes. This step must precede deploying those Admin paths.
- Pre-release SQL: rerun D2-A assertions/behaviour tests plus `supabase/tests/d2b_admin_fields_behavior_tests.sql`. Confirm allowed Admin paths and denied Owner paths, whole-array tag CAS, location atomicity, archived refusal and no-op snapshots. HTTP cutover: `scripts/test-d2b-cutover-local.mjs`; code: `scripts/test-write-cutover.mjs`, `test-section-save.mjs`, `test-admin-navigation.mjs`.
- Post-release: verify the registry includes B0 paths, ordinary writes remain service-only, and the matching editor saves a section, handles 409 conflicts and refuses retired whole-form writes. The legacy Merchant upload-url now supports Story only; profile photos use M6b below.
- Rollback: `supabase/rollback/20260927034414_merchant_field_cas_admin_fields.rollback.STAGING_ONLY.sql`. Application first; restores corrected D2-A function bodies, removes B0 layout helper, keeps stored data. Later migrations also replace shared functions: unwind dependents in reverse order first.

## 3. D2-C — governance and business status

- Migration: `supabase/migrations/20260927095000_merchant_governance.sql`, after B0. Adds Admin-only Publish/Hide/Suspend/Lift suspension/Archive/Restore and business status RPCs, with audit and request replay. Pending review freezes ordinary Owner/Admin edits. Managed rows have narrower governance than legacy rows.
- Application: `app/admin/components/merchant-status-panel.tsx`, `app/api/admin/merchants/[merchantId]/status/route.ts` (state read, governance and business-status writes). The list badges/filter are display-only. Business statuses are Open, Temporarily closed, Moved and Permanently closed; visibility/restriction is separate.
- Pre-release SQL: `supabase/tests/d2c_governance_behavior_tests.sql`, then rerun D2-A/B0 suites because shared lock/audit behaviour changes. Verify contact-gated publication, suspension preserving prior visibility, archive/read-only, restore to hidden, managed action restrictions, pending freeze, reasons and replay.
- Post-release: inspect grants and governance function definitions; smoke-test approved actions with a synthetic restaurant, verify public page/list/sitemap cache refresh and rejected Owner writes during suspension. Do not alter real restaurant state just to test.
- Rollback: `supabase/rollback/20260927095000_merchant_governance.rollback.STAGING_ONLY.sql`. Application first; removes governance RPCs but preserves states, audit and idempotency records. It does not undo the history of actions or automatically restore old publication values.

## 4. M6b — trusted logo/cover images

- Migration: `supabase/migrations/20260927100000_merchant_profile_media.sql`, after D2-C. Adds private upload tickets and media read/bind RPCs, checked under the same actor lock; one-time ticket binding, field CAS, audit and replay. Existing image URLs remain unchanged.
- Application: Merchant/Admin restaurant-specific `media/ticket` and `media` endpoints; `app/components/media/profile-image-field.tsx` and editor integrations. The server picks the object path and validates stored file bytes/size before binding; the old `/api/merchant/media/upload-url` remains Story-only.
- Pre-release SQL: `supabase/tests/m6b_profile_media_behavior_tests.sql`; storage prerequisite: `supabase/tests/media_storage_assertions.sql`. Verify `merchant-media` bucket configuration (JPEG/PNG/WebP, 5MB) and write access, private tickets, expiry/rate limit, one-time bind, wrong-restaurant rejection, conflict and replay. These SQL tests do not upload/check real stored object bytes; also run `scripts/test-merchant-media.mjs` and the local HTTP upload flow.
- Post-release: confirm private ticket RLS/grants and service-only RPCs, then authorized logo/cover upload/remove and malformed file rejection. Check Story uploads remain unaffected and browser-supplied arbitrary URLs cannot bind.
- Rollback: `supabase/rollback/20260927100000_merchant_profile_media.rollback.STAGING_ONLY.sql`. Application first; removes RPCs/ticket table, keeps image values and stored objects. Orphan object cleanup is not part of release/rollback.

## 5. M3a — Owner menu editing

- Migration: `supabase/migrations/20260927110000_merchant_menu.sql`, after M6b. Adds service-only menu read/apply RPCs and validation helpers; per-restaurant category/dish CRUD/reorder, field CAS, state checks and replay. Public restaurants retain the required dish; dish photos remain a separate Admin path in this baseline.
- Application: `app/api/merchant/restaurants/[merchantId]/menu/route.ts`, `app/merchant/components/menu-manager.tsx` and dashboard integration. Admin retains its existing menu editor.
- Pre-release SQL: `supabase/tests/m3a_menu_behavior_tests.sql` plus `scripts/test-merchant-menu.mjs`. Check every supplied category/dish ID belongs to the selected restaurant; full-member reorder lists; null versus zero prices; discount limits; category delete confirmation; public menu minimum; state/access denial and replay.
- Post-release: inspect function grants, then synthetic Owner category/dish edits, a conflicting edit and wrong-restaurant denial; verify price visibility and sold-out rendering on the public layout.
- Rollback: `supabase/rollback/20260927110000_merchant_menu.rollback.STAGING_ONLY.sql`. Application first; removes menu RPCs/helpers, preserves categories and dishes. It does not reverse already-applied menu edits.

## 6. Link review

- Migration: `supabase/migrations/20260927120000_merchant_link_review.sql`, after M3a. Adds private link requests and service-only Owner submit/withdraw, Admin review/direct CAS set, read and queue RPCs. Public links stay unchanged until approval; URL rules and ownership/state checks apply in the database.
- Application: Merchant restaurant `links` and Admin merchant `links` endpoints, `app/api/admin/link-reviews/route.ts`, `app/admin/components/link-review-queue.tsx`, `merchant-links-panel.tsx`, and `app/merchant/components/link-requests.tsx`.
- Pre-release SQL: `supabase/tests/links_review_behavior_tests.sql` plus `scripts/test-merchant-links.mjs`. Check HTTPS/host restrictions, no credentials or localhost/IP hosts, field-specific domains, one pending request, replacement/withdraw, approval rejecting a changed current link, rejection note, direct-set CAS, state/access denial and replay.
- Post-release: verify private queue/table grants and service-only RPCs; synthetic Owner request must leave the public link unchanged, approved Admin review applies it, rejected requests show the note, and public caches refresh. Opening a requested link is not approval.
- Rollback: `supabase/rollback/20260927120000_merchant_link_review.rollback.STAGING_ONLY.sql`. Application first; removes RPCs/helpers/request table, losing request history (export if needed), while already-applied links remain.

## Rollback and release evidence

The listed rollback scripts are **staging-only** and intentionally disabled by switches. A document does not authorize their execution on production. Prefer forward fixes; take the appropriate backup and assess state/history loss before any separately authorized rollback. Roll back dependent application code first, then schema in reverse dependency order: link review → M3a → M6b → D2-C → B0 → D2-A. Inspect the actual rollback bodies, since later migrations can replace shared helpers retained by older rollback scripts.

For each released step retain: application SHA/deployment URL, exact executed SQL/checksum, hosted migration version/name, assertion/behaviour outputs from local/staging, hosted read-only grant/schema checks, authorized smoke-test results and known limits. A matching name, merged PR, local PASS or Preview READY alone does not prove production state.
