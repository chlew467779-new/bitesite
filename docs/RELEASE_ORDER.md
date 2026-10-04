# Merchant feature release order

This release map began at `e24c720` (2026-09-27). Sources: each migration's header, `supabase/README.md`, and the Decision Log. This document does not authorize hosted operations.

## Released 2026-09-28

- Application: `main` @ `44e380b` (PR #65, merging `integ/main-64` @ `e36ac93`).
- Production database: installed through `20260928150000`, covering §1–§21 except the reverted §18 restaurant claim flow. This release status is recorded from the Batch 6 handoff; no hosted SQL was run for this document update.

## Historical environment evidence (2026-09-27)

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

- Migration: `supabase/migrations/20260927094400_merchant_field_cas_admin_fields.sql`, after D2-A. Extends the field registry/audit to Admin Name, Layout, Discovery tags and the atomic Location group; Owners cannot write these paths. No table/data conversion. Renamed from `20260927034414` (Claude, 2026-09-27) so it sorts after production's hosted D2-A `20260927094252` and #64 `20260927094313`; a normal `supabase db push` accepts it.
- Application: section-saving Merchant/Admin editors, including `app/admin/components/merchant-form.tsx`, `app/merchant/page.tsx`, section-save components and field endpoints. D2-B/M1-B retires whole-form Merchant/Admin writes and hard delete, uses section CAS, and guards switching/leaving with unsaved changes. This step must precede deploying those Admin paths.
- Pre-release SQL: rerun D2-A assertions/behaviour tests plus `supabase/tests/d2b_admin_fields_behavior_tests.sql`. Confirm allowed Admin paths and denied Owner paths, whole-array tag CAS, location atomicity, archived refusal and no-op snapshots. HTTP cutover: `scripts/test-d2b-cutover-local.mjs`; code: `scripts/test-write-cutover.mjs`, `test-section-save.mjs`, `test-admin-navigation.mjs`.
- Post-release: verify the registry includes B0 paths, ordinary writes remain service-only, and the matching editor saves a section, handles 409 conflicts and refuses retired whole-form writes. The legacy Merchant upload-url now supports Story only; profile photos use M6b below.
- Rollback: `supabase/rollback/20260927094400_merchant_field_cas_admin_fields.rollback.STAGING_ONLY.sql`. Application first; restores corrected D2-A function bodies, removes B0 layout helper, keeps stored data. Later migrations also replace shared functions: unwind dependents in reverse order first.

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

The listed rollback scripts are **staging-only** and intentionally disabled by switches. A document does not authorize their execution on production. Prefer forward fixes; take the appropriate backup and assess state/history loss before any separately authorized rollback. Roll back dependent application code first, then schema in reverse dependency order: M2-B → link review → M3a → M6b → D2-C → B0 → D2-A. Inspect the actual rollback bodies, since later migrations can replace shared helpers retained by older rollback scripts.

For each released step retain: application SHA/deployment URL, exact executed SQL/checksum, hosted migration version/name, assertion/behaviour outputs from local/staging, hosted read-only grant/schema checks, authorized smoke-test results and known limits. A matching name, merged PR, local PASS or Preview READY alone does not prove production state.

## 7. M2-B — Listing review and Owner publication

- Migration: `20260927130000_merchant_listing_review.sql`, after B0, #64 password onboarding, governance, media, menu and `20260927120000` link review. It replaces the field registry with a scoped Owner-basics wrapper, creates private review/settings/outbox tables, and adds service-role-only RPCs.
- Apply the migration before deploying the listing dashboard and Restaurant Reviews page. Queue capacity defaults to 20, pilot admission to 50. Only managed (self-registered) pending/approved restaurants count toward the pilot limit; legacy restaurants do not. The capacity setter takes an optional fourth pilot-capacity argument.
- Local verification: `supabase/tests/m2b_listing_review_behavior_tests.sql`, `npm run verify`, and HTTP submit/approve/publish plus concurrent last-place submissions.
- Rollback FIRST, before link review: `supabase/rollback/20260927130000_merchant_listing_review.rollback.STAGING_ONLY.sql`. Default switch is NO. Restore application first; export submission/outbox history. Restaurant states/slugs and audit/idempotency history remain. Restores the exact B0 registry.
- Hosted D2-A/#64 versions reportedly differ from repository timestamps. Reconcile actual SQL/checksums and dependency order before choosing any renames or application plan. This local package does not authorize or perform hosted operations.

## 8. Web address rename and redirects

- Migration: `20260927140000_merchant_slug_history.sql`, after `20260927130000`. Adds `merchant_slug_history`, slug guard/follow triggers, Admin RPCs, and changes `articles_merchant_slug_fkey` to ON UPDATE CASCADE. Replaces `private.merchant_publication_slug`.
- Deploy the application after the migration: the store page reads `merchant_slug_history` for redirects; the Admin editor gains the Web address panel.
- Local verification: `supabase/tests/slug_history_behavior_tests.sql`, `npm run test:slug`, rename in the browser and old address redirect.
- Rollback FIRST (before M2-B): `supabase/rollback/20260927140000_merchant_slug_history.rollback.STAGING_ONLY.sql`. Old addresses stop redirecting; current slugs stay.

## 9. Dish photos

- Migration: `20260927150000_merchant_dish_media.sql`, after `20260927140000`. Extends `merchant_media_uploads` (slot `dish`, `product_id`), adds dish ticket/bind RPCs and replaces `merchant_media_ticket` (logo/cover limit counts logo/cover only).
- Deploy after the migration: Owner routes `/api/merchant/restaurants/[id]/menu/dish-photo` (+ `/ticket`) and the menu editor photo control.
- Local verification: `supabase/tests/dish_media_behavior_tests.sql`, `npm run test:dish-media`, HTTP smoke with a real upload (ticket, signed upload, bind, fake image refused, conflict, remove).
- Rollback FIRST (before slug history): `supabase/rollback/20260927150000_merchant_dish_media.rollback.STAGING_ONLY.sql`.

## 10. Merchant feedback

- Migration: `20260927160000_merchant_feedback.sql`, after `20260927150000`. New private table and four service-role RPCs; nothing existing changes.
- Application: Owner route `/api/merchant/restaurants/[id]/feedback`, Admin route `/api/admin/feedback`, Admin Feedback page. The dashboard form is switched off until CH approves SYNC-052.
- Local verification: `supabase/tests/feedback_behavior_tests.sql`, `npm run test:feedback`, HTTP smoke (send, replay, inbox, reply, Owner sees reply).
- Rollback FIRST (before dish photos): `supabase/rollback/20260927160000_merchant_feedback.rollback.STAGING_ONLY.sql`.

## 11. Three editable drafts per account

- Migration: `20260927170000_merchant_draft_limit.sql`, after `20260927160000` (and #64 `20260927090355`). Replaces `merchant_restaurant_create` with the same body plus the cap.
- Application: the create route returns `DRAFT_LIMIT` with a clear message; the listing route accepts `discard` (merchant_draft_discard) and the dashboard offers "Discard draft".
- Local verification: `supabase/tests/draft_limit_behavior_tests.sql`, `supabase/tests/merchant_password_onboarding.sql` (unchanged behaviour otherwise), `npm run test:review`.
- Rollback FIRST (before feedback): `supabase/rollback/20260927170000_merchant_draft_limit.rollback.STAGING_ONLY.sql`.

## 12. Notification emails

- Migration: `20260927190000_notification_delivery.sql`, after `20260927170000` (and the M2-B outbox `20260927130000`).
- Environment: `RESEND_API_KEY`, `NOTIFY_FROM` (verified sender domain), `ADMIN_NOTIFY_EMAIL`, `CRON_SECRET`; schedule GET `/api/admin/notifications/deliver`. Without them nothing is sent.
- Local verification: `supabase/tests/notification_delivery_behavior_tests.sql`, `npm run test:notifications`, local run with `NOTIFY_PROVIDER=log` (owner row sent, admin row "no recipient", wrong secret 401).
- Rollback FIRST: `supabase/rollback/20260927190000_notification_delivery.rollback.STAGING_ONLY.sql`.

## 13. Owner visitor statistics

- Migration: `20260927200000_merchant_owner_stats.sql`, after `20260927190000` (uses `merchant_slug_history` from `20260927140000`). Read-only function plus an index on `page_views (slug, created_at)`; build the index outside peak hours on a large table.
- Application: `/api/merchant/restaurants/[id]/stats` and the dashboard Visitors section.
- Local verification: `supabase/tests/owner_stats_behavior_tests.sql`, browser check at 390px.
- Rollback FIRST: `supabase/rollback/20260927200000_merchant_owner_stats.rollback.STAGING_ONLY.sql`.

## 14. Owner temporary closure

- Migration: `20260927210000_owner_temporary_closure.sql`, after `20260927200000`. New table + two RPCs; merchant projection unchanged.
- Application: `/api/merchant/restaurants/[id]/business-status`, dashboard panel in Opening hours, store page closed view.
- Rollback FIRST: `supabase/rollback/20260927210000_owner_temporary_closure.rollback.STAGING_ONLY.sql`.

## 15. Merchant terms acceptance

- Migration: `20260927220000_merchant_terms_acceptance.sql`, after `20260927210000`. Adds private acceptance records and service-only `merchant_restaurant_create_v2`; the existing create RPC remains for rollback compatibility.
- Application: `/terms` displays the pilot draft, and restaurant creation requires terms agreement plus a rights declaration. The create API sends version `2026-09-pilot` to v2 and returns `TERMS_OUTDATED` if the version changed.
- Local verification: `supabase/tests/terms_acceptance_behavior_tests.sql`, `npm run test:merchant-auth`, and `npm run verify`. CH must review the terms wording before any hosted release.
- Rollback FIRST: `supabase/rollback/20260927220000_merchant_terms_acceptance.rollback.STAGING_ONLY.sql`. Revert the application to the previous RPC first; rollback deletes acceptance records.

## 16. Owner basics change requests

- Migration: `20260928090000_merchant_basics_requests.sql`, after `20260927210000` (and after ChatGPT T11 `20260927220000` if released together). New private table + five RPCs; merchant projection unchanged.
- Application: `/api/merchant/restaurants/[id]/basics`, `/api/admin/basics-reviews`, dashboard request form under Listing basics, Admin Change Requests page, attention badge.
- Rollback FIRST: `supabase/rollback/20260928090000_merchant_basics_requests.rollback.STAGING_ONLY.sql`.

## 17. Story submissions by restaurant id

- Migration: `20260928100000_story_submission_merchant_id.sql`, after `20260928090000`. Adds a nullable column + trigger + two indexes and backfills; check `select count(*) from story_submissions where merchant_slug is not null and merchant_id is null` after applying (unlinked relayed submissions, expected 0 or explained).
- Application: `/api/merchant/story-submissions` GET filters by `merchant_id` — deploy after the migration.
- Rollback FIRST: `supabase/rollback/20260928100000_story_submission_merchant_id.rollback.STAGING_ONLY.sql`.

## 18. Restaurant claim flow — reverted before release (SYNC-062)

- The claim flow and its migration were removed before the 2026-09-28 release. No claim migration or application step belongs to the released sequence.

## 19. Owner notifications for basics review decisions

- Migration: `20260928150000_basics_review_notifications.sql`, after `20260928090000`. Extends the notification kind constraint with `basics_approved` and `basics_rejected`, and updates `merchant_basics_review` to enqueue one Owner notification per decision. The retired claim kinds are not included.
- Application: the existing notification delivery worker sends the decision email to active Owners using the dashboard link; no new provider configuration is needed. Apply the migration before relying on the new kinds.
- Local verification: `supabase/tests/basics_review_notifications_behavior_tests.sql`, `npm run test:notifications`, and `npm run verify`. The SQL test checks one approval and one rejection notification.
- Rollback FIRST: `supabase/rollback/20260928150000_basics_review_notifications.rollback.STAGING_ONLY.sql`. It deletes the two new kinds, restores the four review kinds, and restores the previous review function.

## 20. Admin Owner transfer fix

- Migration: `20260928120000_merchant_owner_assign.sql`, after `20260928100000` (independent of §19). One RPC, no table change.
- Application: `/api/admin/merchant-memberships` POST uses it; Merchant Manager confirm + result message. Deploy after the migration.
- Rollback FIRST: `supabase/rollback/20260928120000_merchant_owner_assign.rollback.STAGING_ONLY.sql`.

## 21. Visitor reports

- Migration: `20260928130000_public_reports.sql`, after `20260928120000`. New private table + three RPCs; no change to public data.
- Application: `/api/reports` (public), `/api/admin/reports`, "Report a problem" on store and Story pages, Admin "Visitor Reports" page and badge.
- Environment: optional `REPORT_HASH_SECRET` (falls back to `ADMIN_SESSION_SECRET`; without either, reporting answers 503).
- Rollback FIRST: `supabase/rollback/20260928130000_public_reports.rollback.STAGING_ONLY.sql`.

## Released additions, 2026-09-30 to 2026-10-04

This section records the repository sequence and the shared work queue's release reports as of 2026-10-04. It is not a fresh read of hosted migration history or a new authorization to run SQL. Before any further hosted change, compare the actual environment, migration history and SQL body. Keep the application paired with its required schema.

| Date | Feature and application release | Required SQL / release artifact | Recorded state and order |
|---|---|---|---|
| 09-30 | Pilot intake Open / Limited / Paused (#73) | `20260930120000_pilot_intake_mode.sql` | Merged; apply SQL before depending on intake mode. |
| 09-30 | Admin menu import from photos, Events hidden, Featured dishes (#74) | `20260930130000_menu_import.sql` | Merged; imported menu writes depend on the migration. |
| 10-03 | Owner menu photo requests and Admin Menu Photos (#78; SYNC-067) | `20261003130000_menu_photos_bucket.sql`; `Documents/Codex/2026-10-03/release/release-20261003-menu-photos.sql` | Merged; private bucket before upload controls. |
| 10-03 | Owner facilities and occasions (#80; SYNC-068) | `20261003140000_owner_amenities_occasion.sql`; `Documents/Codex/2026-10-03/release/release-20261003b-amenities.sql` | Merged; Owner registry permission before editor. |
| 10-03 | Owner page style and sections (#81; SYNC-069) | `20261003150000_owner_page_style.sql`; `Documents/Codex/2026-10-03/release/release-20261003c-page-style.sql` | Merged after amenities; Chinese/Malay availability remains a separate release gate. |
| 10-03 | Site Errors in Admin (#84; SYNC-070) | `20261003160000_site_errors.sql`; `Documents/Codex/2026-10-03/release/release-20261003d-site-errors.sql` | Merged; recording requires the table. |
| 10-04 | Privacy Policy (#88, #95; SYNC-071, SYNC-076) and finalized terms (#90) | `20261004100000_privacy_retention.sql`; `Documents/Codex/2026-10-04/release/release-20261004-privacy-retention.sql` | Application merged. Retention cleanup requires the migration; confirm hosted schedule separately. |
| 10-04 | Photo Cleanup (#93; SYNC-074) | None | Merged; Storage API cleanup has its own in-use checks. |
| 10-04 | Gmail notification delivery (#96; SYNC-077) | None beyond the prior notification outbox | Merged; sending requires the SMTP environment settings. The shared queue still lists those settings as CH work. |
| 10-04 | ShopeeFood / foodpanda links (#91; SYNC-072) | `20261004110000_delivery_links.sql`; `Documents/Codex/2026-10-04/release/release-20261004-delivery-links.sql` | Shared queue records CH ran SQL and app merged. |
| 10-04 | Job posts, Owner and Admin (#92, #101; SYNC-073) | `20261004120000_merchant_jobs.sql`; `Documents/Codex/2026-10-04/release/release-20261004-jobs.sql` | Shared queue records CH ran SQL and app merged; public pages are a separate G21 batch. |
| 10-04 | Singapore currency and initial areas (#94, #99, #100; SYNC-075) | `20261004130000_singapore_currency.sql`; `Documents/Codex/2026-10-04/release/release-20261004-singapore-currency.sql` | Shared queue records CH ran SQL and app merged. The 55-area expansion is separate and still awaits CH's H6d SQL and #97 merge. |

The shared queue also lists `release-20261004-layouts-chinese-malay.sql` (H6e, #98) as pending CH execution and a later application switch. Do not treat that layout release as complete. G18 and G21, and the batches stacked on them, remain local review work until independently merged.
