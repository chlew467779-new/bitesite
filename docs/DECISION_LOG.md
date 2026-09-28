[DECISION_LOG.md](https://github.com/user-attachments/files/32336536/DECISION_LOG.md)
# BiteSite — Decision Log

**Purpose:** concise index of explicit product decisions. The full reasoning remains in the Master Spec.

**Current baseline:** Master Product, Architecture & Development Specification v3.3.

## Status vocabulary

- **DECIDED** — approved product direction.
- **RECOMMENDATION** — proposed approach, not final product truth.
- **OPEN** — CH decision still required.
- **PENDING** — deliberately waiting for repository/legal/platform audit.
- **OUT OF SCOPE** — intentionally not built in this release.

## Confirmed decisions

| ID | Area | Decision | Status |
|---|---|---|---|
| SYNC-001 | Merchant status | Split `platform_status` and `business_status`; `TRANSFERRED` is ownership history, not a merchant status. | DECIDED |
| SYNC-002 | Story expiry | Promotion expiry is a derived `is_expired` display condition; expiry does not automatically archive/hide the Story. | DECIDED |
| SYNC-003 | Story publishing | Merchant submits; CH/Admin reviews and publishes. | DECIDED |
| SYNC-004 | Story channels | `self_service_form` and `admin_relayed` converge into one Story workflow. | DECIDED |
| SYNC-005 | Story media | One cover image + up to three general images; upload media is automatically optimized. | DECIDED |
| SYNC-006 | Story copy | AI-assisted editorial rewriting is part of the intended V1 workflow; human approval remains required. | DECIDED |
| SYNC-007 | Accessibility | Merchant and Admin interfaces should provide clear contextual hints/help text. | DECIDED |
| SYNC-008 | Rights | Merchant rights declaration is required; admin-relayed submissions must record equivalent confirmation. | DECIDED |
| SYNC-009 | GrabFood | V1 is outbound URL only; no Grab order/payment API integration. | DECIDED |
| SYNC-011 | Assisted Content | RM20 is a service, not a fine; minimal service/payment status may be tracked manually. | DECIDED |
| SYNC-012 | Published Story edits | Material edits to published Stories require a new editorial review before public replacement. | DECIDED |
| SYNC-013 | 60-day cadence | The 60-day cadence concept is approved, but exact start/reset event remains unresolved. | OPEN |
| SYNC-014 | Pending queue | Maximum one pending Story per merchant is the initial recommendation, not a final product decision. | RECOMMENDATION |
| SYNC-015 | Merchant ↔ Stories | Historical Stories should not be destroyed merely because a merchant closes; exact automatic visibility behavior remains pending. | PENDING |
| SYNC-016 | Grab branding | V1 does not depend on Grab logo/brand color; verify branding separately before adding branded treatment. | RECOMMENDATION |
| SYNC-017 | Halal / pork-free | No dedicated Halal/pork-free field, badge, verification workflow, ranking/filter, or special product logic in current scope. Merchant self-onboarding may provide related information if they choose, under normal review rules. | DECIDED / OUT OF SCOPE |
| SYNC-018 | Assisted Content pricing | Malaysia: RM20. Singapore: S$10 when Singapore is enabled. These are market-specific prices; no live FX conversion logic in V1. | DECIDED |
| SYNC-019 | Story ↔ Menu | Stories are ordinary promotional/editorial posts. A Story may mention a new menu item, but Story publishing does not create, edit, sync, price, archive, or otherwise mutate Menu System data. | DECIDED |
| SYNC-020 | Layouts | `lib/layout-registry.mjs` is the single source of truth for layout keys and their metadata; Admin and Merchant surfaces read their layout options from it. | DECIDED |
| SYNC-021 | Layouts | Unknown, blank or not-public-ready stored layout values render Classic with a sanitised server-side warning; they never 404 a store page. | DECIDED |
| SYNC-022 | Layouts | Only registered, production-ready layouts may be persisted to a merchant row, for Admin and Merchant self-service alike. Unfinished layouts stay on internal surfaces. | DECIDED |
| SYNC-023 | Legacy style | The unused legacy `style`/`custom_style`/fresh-luxury-jp token system is not removed in this phase; new layout work must not reuse its namespace. | DECIDED |
| SYNC-024 | Menu | `show_prices = false` hides the regular price, discount price, strikethrough original and currency symbol on every public surface, including the Featured/Seasonal section. Name, description, image, featured and availability still render. | DECIDED |
| SYNC-025 | Menu | A `show_prices` value of null/undefined is treated as true, preserving the behaviour of every row written before the column was honoured. | DECIDED |
| SYNC-026 | Menu | Dishes with `category_id = null` remain unrendered on the public menu; Admin surfaces must state that consequence explicitly. Publishing them is a separate future decision. | DECIDED |
| SYNC-027 | Layouts | Per-layout styling for the shared sections (gallery, seasonal, reviews, appointment, events, share buttons, related merchants) lives in `lib/layout-theme.mjs`, separate from the registry. The registry still decides which layouts exist; every registered layout must supply a complete theme. Each layout file keeps its own structure and hero/menu/footer styling. | DECIDED |
| SYNC-028 | Layouts | The theme keeps one slot per style that existed before (38 per layout), with the five original layouts copied character for character and no per-layout branches left in components. Collapsing slots into shared semantic roles is deferred to the new-layout work (PR2B), because it would change existing colours. | DECIDED |
| SYNC-029 | Layouts | New layouts land registered with `productionReady: false` (internal surfaces only: public pages render Classic, Admin cannot save them) and are switched to production-ready in a separate small PR after visual sign-off. Chinese and Malay (PR2B) follow this. | RECOMMENDATION |
| SYNC-030 | Layouts | New layouts fill the 38 theme slots directly; the shared semantic-role layer from SYNC-028 is deferred again until after PR2D, when all ten layouts can be compared. Shared-section headings stay in English; layouts change visual style, not language. | RECOMMENDATION |
| SYNC-031 | Merchant | Merchants edit opening hours per day (Monday–Sunday) as Open with picked times (up to 3 ranges) or Closed; no free-text hours. The stored `operating_hours` shape is unchanged (day → "HH:MM - HH:MM" / "Closed"; no migration). Days the merchant does not change, including older free text, are saved back unchanged, and the API rejects new free text. | DECIDED |
| SYNC-032 | Merchant | The "Request a controlled change" block is hidden from the Merchant dashboard. Name, address, web address and business status stay managed by the BiteSite team. The change-request API and its table are kept for now. | DECIDED |
| SYNC-033 | Merchant | Merchant profile fields are validated per field by one shared module used by both the dashboard and the API. Empty optional fields are valid. Format rules apply to changed values, so an older stored value never blocks saving other fields. | DECIDED |
| SYNC-034 | Booking | A public booking request goes only to the restaurant's own valid WhatsApp number (`lib/merchant-booking-target.mjs`: 8–15 digits, country code first). There is no fallback to the restaurant phone or to any platform number, and without a valid number the booking section and its nav link are not rendered. The page says the booking is not confirmed until the restaurant replies; nothing the visitor typed is stored or tracked. A well-formed number is not proof that it belongs to the restaurant. Source: FoodStraits master spec 2026-09-26, DEC-21 / AUD-01 (P0). | DECIDED |
| SYNC-035 | Reviews | The legacy `merchants.reviews` carousel is not rendered on public pages, and the store page strips that field before handing data to the layouts. The stored data is not deleted by this change. Reviews come back only as an Admin-reviewed Google reviews link (later package), never as copied or invented review text. Source: FoodStraits master spec 2026-09-26, DEC-22 / AUD-14 (P0). | DECIDED |
| SYNC-036 | Merchant state | Merchants carry canonical `review_status` / `listing_visibility` / `platform_restriction` beside `business_status`, plus server-owned `revision` and `updated_at`. One database predicate (`private.merchant_is_public`) decides public visibility for merchants, categories, products, videos, GrabFood links and events. During the compatibility window every existing row, and every row the current Admin creates, is `state_source = 'legacy'` (old `is_published`/`platform_status` rule, except SUSPENDED/ARCHIVED are no longer public); `managed` rows get those two fields derived and refuse direct writes. Moving a row to managed is a separate, per-merchant, CH-approved operation: an ordinary UPDATE is refused (`STATE_SOURCE_CONVERSION_FORBIDDEN`), and only `private.convert_merchant_to_managed` — executable by the database owner alone, never by the application roles — converts one merchant with its complete approved state, expected revision, actor and reason, audited in `merchant_change_log`. The migration never approves, publishes or converts anything. Source: FoodStraits master spec 2026-09-26 §5, §7.3–7.4 (D1a). | DECIDED (compatibility approach accepted by CTO 2026-09-26); conversion boundary pending CTO re-review |
| SYNC-037 | Analytics | Merchant view counts are private: `merchant_stats` has no public read, and no public page or card shows a view count. Owner/Admin analytics remain. Source: FoodStraits master spec 2026-09-26, DEC-29 (D1a). | DECIDED |
| SYNC-038 | Public data | The public database roles read `merchants` column by column: only the list in `lib/public-merchant-projection.mjs` is granted. Legacy `reviews`, `settings`, `reference_website`, `custom_style`, `style`, `is_published`, `platform_status`, the canonical review/visibility/restriction state, `state_source`, `revision` and `first_published_at` are server-only, and columns added later stay private until a migration grants them. Public pages select that list and never filter on `is_published`; row level security decides which merchants appear. Analytics ingest accepts only merchants the public can see. `merchants.email` stays public because it is the restaurant's contact email shown on every layout, not the owner's sign-in email. Source: FoodStraits master spec 2026-09-26 §7.4, §11 (D1b). | DECIDED (contract and the `email` classification accepted by CTO 2026-09-26) |
| SYNC-039 | Public data | The public database roles read `articles` (Stories) column by column: only the list in `lib/public-article-projection.mjs` is granted. `published`, `editorial_status`, review notes/reviewer/times, the rights declaration, AI draft copy and `view_count` are server-only. A Story is public only when `published = true` and `editorial_status = 'published'` (`private.article_is_public`, the rule the sitemap already used), so a Story rejected or returned to draft stops being public even if its flag was left true. Story pages and cards no longer show a view count (DEC-29), and analytics ingest accepts only public Stories. Source: FoodStraits master spec 2026-09-26 §7.4, §11, DEC-29 (D1c). | DECIDED (CTO 2026-09-26; the migration only lists, never changes, Stories this hides) |
| SYNC-040 | Stories | A Story submission review decision keeps its linked article consistent with the public Story rule (`published` and `editorial_status = 'published'`). Sending it back to draft or rejecting it takes the Story down at once (`published = false`, `published_at` kept as history). Approval never publishes, and approving a Story that is already published leaves it published (only the review is recorded). Archiving a submission or returning it to pending review does not change the article. Every change of public visibility refreshes the home page, Story list, Story pages and sitemap; store pages do not render Stories. A failed revision record is logged and never blocks the takedown or the refresh. Rule in `lib/story-review-sync.mjs`. Source: FINAL_AUDIT/05 P1; ChatGPT answers 2026-09-27. | DECIDED (CTO 2026-09-27) |
| SYNC-041 | Merchant access | Every merchant API names the restaurant it acts on (`?merchantId=`), and one shared server helper (`app/api/merchant/_lib/merchant-access.ts`, decision in `lib/merchant-access-core.mjs`) verifies the Supabase user with getUser and checks that the restaurant is one of that user's active Owner memberships. No route picks the first membership. A missing, malformed or foreign restaurant is 404; an account with several restaurants and no ID gets 409 `MERCHANT_CONTEXT_REQUIRED`; an account with exactly one may omit the ID (compatibility). Suspended or archived restaurants stay readable by their Owner, but writes and uploads are refused (403). `GET /api/merchant/me` returns the account and all owned restaurant summaries, and a profile only for the selected (or only) restaurant; with none, the dashboard shows an explicit no-restaurant state. Story submissions stay keyed by `merchant_slug`, always taken from the verified restaurant. Story drafts in the browser are kept per restaurant. Source: FINAL_AUDIT/05 M1-A; master spec §4.3, §10. | DECIDED (CTO 2026-09-27) |
| SYNC-042 | Merchant saves | Merchant and Admin field saves use one field-level compare-and-set contract (`public.merchant_field_patch`, one database transaction): each change names a registered path and the value the editor last saw; a changed field returns 409 `FIELD_CONFLICT` and nothing from that request is written; changes to different fields merge. Registered paths: `profile.tagline/description/phone/whatsapp/email`, `hours.mon…sun` (existing `operating_hours` day strings), and for Admin only `features.hero/about/contact/gallery/events/appointment/seasonal_popup` (other feature keys kept unchanged). Links (`website`, `instagram`, `facebook`, `menu_pdf_url`) are not writable through this contract until the link review queue exists; `features.menu` and `features.reviews` are protected. A public restaurant keeps at least one valid contact: a save that touches phone/WhatsApp/email must leave one that passes the existing format rules (WhatsApp as parsed for the booking button); saves of other fields are not blocked by older contact data. Each request carries a `requestId`; the same request replays its result for 7 days and a reused id with other changes is refused. Owner access is rechecked under lock (restaurant row, then Owner membership); suspended restaurants refuse Owner writes; archived restaurants refuse Owner and Admin ordinary writes; a no-op confirms all requested snapshots without changing merchant revision or audit rows; a restaurant pending review (managed `review_status = pending`, or legacy `platform_status = PENDING_REVIEW`) is frozen for Owner and Admin ordinary edits. Admin is recorded as `legacy_admin` (shared session). Merchant Story submissions and change requests are inserted through RPCs with the same recheck. Old whole-form saves are unchanged until the D2-B cutover. Source: FINAL_AUDIT/05 D2-A; D2A_IMPLEMENTATION_DIRECTION_20260927; master spec §8. | DECIDED (CTO 2026-09-27; 7-day retention is an engineering default) |
| SYNC-043 | Merchant saves | Write cutover (D2-B/M1-B). Merchant and Admin editors save section by section through the field save contract only (Merchant: About, Contact, Opening hours; Admin also Name, Layout, Discovery tags, Location as one address+area+coordinates group, Page sections). Only changed fields are sent with the loaded value as expected; a conflict shows current value, sent edit and newer draft, and the user chooses Keep current or Use mine per field before saving again (no force). Typing during a save is kept; an unconfirmed save is retried only with the same request id. The old whole-form saves (`PUT /api/merchant/me`, Admin `merchants-crud` PUT) and Admin hard DELETE are retired (410 `LEGACY_WRITE_RETIRED`); Admin create makes only a hidden draft from name + optional web address. Read-only until their workflows exist: links and GrabFood (link review), logo/cover images (trusted media; upload tickets for them closed), web address (slug), payment methods, legacy tags, and publication/suspension/business status (governance). Switching restaurants or leaving an editor with unsaved changes asks Save / Discard / Cancel, and is refused while a save is in flight or unconfirmed. Source: D2B_M1B_DECISIONS_AND_IMPLEMENTATION_20260927. | DECIDED (CTO 2026-09-27) |
| SYNC-044 | Merchant governance | Narrow Admin governance (D2-C), replacing what the retired whole-form save used to do: one audited, idempotent Admin action per restaurant — Publish, Hide, Suspend, Lift suspension, Archive, Restore (`public.merchant_governance_apply`, one transaction, row lock) — and Admin-set business status (`public.merchant_business_status_set`: Open, Temporarily closed, Moved, Permanently closed; the public page already shows closed restaurants as unavailable with alternatives; reason required unless Open; refused while archived). Legacy rows (all current restaurants): Publish needs one valid contact method and is refused while suspended or archived (it is also the Admin decision for a legacy PENDING_REVIEW row); Hide only turns publication off; Suspend keeps the published flag so Lift suspension restores the earlier visibility (public if it was published, otherwise hidden); Owner writes stay refused while suspended and Admin can still correct content. Managed rows: only Suspend / Lift suspension (Admin-owned `platform_restriction`); their public visibility belongs to the Owner publication design (M2) and is not decided here. Archive makes the restaurant non-public and read-only for everyone (legacy: ARCHIVED and unpublished; managed: platform_restriction archived); only Restore is possible then, and Restore returns it hidden (publish again deliberately). Slug rename and hard delete remain later contracts. Every action except Publish needs a reason (max 500 characters) stored in `merchant_change_log` with operation `merchant_governance:<action>`; an action already in effect is a no-op without audit; the same `requestId` replays for 7 days. Public pages (store page, home, Our partners, sitemap) are refreshed after a change. Source: D2B_M1B_DECISIONS §治理操作的边界; CH request 2026-09-27. | RECOMMENDATION (implemented as the default; CH to confirm the rules above) |
| SYNC-045 | Merchant media | Logo and cover photo changes reopen (M6b) through a checked upload flow, for the Owner (dashboard) and Admin (editor): the server chooses the object path (`merchant-media/profile/<merchant>/<slot>/<uuid>`), the database records an upload ticket after the same authorization and state checks as a field save (valid 1 hour, at most 20 per restaurant per hour), the phone resizes the photo to WebP before upload (logo 512 px, cover 1600 px), and the server downloads the stored object and checks its size (5 MB) and real type (JPEG/PNG/WebP magic bytes) before `merchant_media_bind` sets `logo_image` / `cover_image` with compare-and-set on the value the editor showed, audit (`merchant_media_bind:<slot>`) and 7-day request-id replay. A ticket binds once; Remove sets the slot to empty. Client-supplied URLs are never accepted. No automatic moderation or orphan clean-up yet; existing image URLs are unchanged. Source: D2B_M1B_DECISIONS §B2 (M6b); CH request 2026-09-27. | RECOMMENDATION (implemented as the default; CH to confirm) |
| SYNC-046 | Merchant menu | Owners edit their own menu from the dashboard (M3a): add / rename / reorder / delete categories and add / edit / move / reorder / delete dishes, mark dishes sold out, show or hide prices, feature dishes. One RPC per change (`merchant_menu_apply`, service_role only) after the same Owner recheck and state rules as field saves (suspended/archived: no changes; pending review: frozen); every id must belong to the restaurant; dish edits are field-level compare-and-set; reorder lists must name exactly the current members; price and discount 0..100000 with 2 decimals, empty = no price, 0 = a real price, a discount needs a price and cannot exceed it; deleting a category with dishes needs confirmation; a public restaurant that had a dish in a category keeps at least one (sold-out dishes count, because they stay on the page); same requestId replays for 7 days. Dish photos stay Admin-only for now; Admin keeps its existing menu editor. Mobile-first UI (bottom sheet editor, numeric keypad for prices, one-tap sold-out). Source: FINAL_AUDIT/05 M3a; CH request 2026-09-27. | RECOMMENDATION (implemented as the default; CH to confirm) |
| SYNC-047 | Merchant links | Link review queue: Owners request changes to website, Instagram, Facebook, menu link (PDF) and GrabFood from the dashboard; nothing public changes until Admin approves on the new Link Reviews page (approve applies only if the link has not changed since the request; reject needs a note the Owner sees). One waiting request per link (a newer request replaces it; it can be withdrawn). Admin can also set links directly in the restaurant editor (compare-and-set; replaces a waiting request). URL rules in the database and the UI: https only, at most 500 characters, no user:password@, a real host name (no IP / localhost), Instagram links on instagram.com, Facebook on facebook.com / fb.com, GrabFood on grab.com. Owner requests use the same ownership and state checks as field saves; approved changes are audited (`merchant_link_review:<field>`, `merchant_link_admin_set:<field>`; GrabFood lives in `merchant_external_links`). Requested links open with rel=nofollow in the queue. Source: D2B_M1B_DECISIONS §B3; CH request 2026-09-27. | RECOMMENDATION (implemented as the default; CH to confirm) |

## Confirmed product principles

### Merchant identity

- Merchant is a long-lived business/location entity.
- Owner/member identity is separate from Merchant identity.
- Ownership transfer is an event/history concept, not a Merchant status.

### Stories

- Merchant cannot directly publish Stories in V1.
- Merchant provides facts/materials.
- BiteSite/CH/Admin reviews and publishes.
- Story content should maintain rights declarations.
- Promotional expiry does not automatically remove the Story.
- Stories do not mutate Menu System data.

### GrabFood

- BiteSite sends users to the merchant's GrabFood page.
- BiteSite does not become a food delivery/order platform.

### Assisted Content

- Malaysia: RM20.
- Singapore: S$10 when Singapore is enabled.
- The service is not a penalty or fine.

## Important open/pending questions

| ID | Question | Current status |
|---|---|---|
| OQ-60D | What starts/resets the 60-day Story cadence? | OPEN |
| OQ-StoryQueue | Should a merchant have a hard cap on pending submissions? | RECOMMENDATION: 1 |
| OQ-MerchantStories | What exactly happens to historical Stories when a merchant is permanently closed? | PENDING |
| OQ-TransferHistory | Exact database representation of ownership transfer history. | PENDING: repository/schema audit |
| OQ-StatusHistory | Exact representation of platform_status vs business_status changes in history. | PENDING: repository/schema audit |
| OQ-RLS | Exact authorization model for Merchant/Admin Story submissions, especially `admin_relayed`. | PENDING: repository/RLS audit |
| OQ-Upload | Exact media upload/compression path. | PENDING: repository/storage audit |
| OQ-RM20Ops | Exact operational receipt/reference tracking for Assisted Content payments. | RECOMMENDATION: simple admin-only tracking first |
| OQ-LegacyStyle | When and how to remove the unused legacy style system and the two dead duplicate section components. | PENDING: separate cleanup PR after a read-only reference audit |
| OQ-PreviewToken | Merchant draft preview via a short-lived signed token exchanged for an HttpOnly cookie. | PENDING: architecture agreed in principle, to be specified and reviewed in its own PR |
| OQ-SharedSectionA11y | Pre-existing accessibility gaps in shared sections, found while checking PR2B: the booking form's date, time and guests fields are not linked to their labels; the review date uses 50% opacity (below WCAG AA on any colour); Elegant overflows by 9px at 320px when there is no cover image. Fixing them changes the live layouts, so it is not part of PR2B. Update (P0, 2026-09-26): all six booking fields are now linked to their labels; the review date contrast no longer appears publicly because the carousel is not rendered (SYNC-035). | RESOLVED (2026-09-27): current public booking labels verified; legacy date/time/guests labels associated using unique IDs; review date opacity removed; Elegant dish name and discount price stack below sm to prevent 320px overflow. |
| OQ-AnalyticsNulls | Found while running `supabase/tests/analytics_aggregation_idempotence.sql` locally (D1a): the test calls `select` instead of `perform` inside a DO block, so it has never run; with that fixed it shows the hourly aggregate doubles counts, because the `merchant_daily_views` unique key uses NULLS DISTINCT and `/api/track` writes NULL key columns. Fix direction: `UNIQUE NULLS NOT DISTINCT` plus merging existing duplicate rows (a production data change). Not verified against production. Update (2026-09-26): migration `20260926121244` makes the key `UNIQUE NULLS NOT DISTINCT`, keeps the most recent row of each duplicated bucket and archives the older rows in `private.merchant_daily_views_nulls_dedupe_archive`; the test now uses `perform` and covers NULL keys. | PROPOSED: fix in its own PR; running it on staging/production needs CH approval per environment |
| OQ-Soft404 | `app/store/[merchant]/loading.tsx` makes Next.js stream a 200 response before `notFound()` runs, so unknown, hidden and suspended restaurants show the not-found page with HTTP 200 (a soft 404; also true on production today). The spec requires a real 404 for direct links. | RESOLVED 2026-09-27 (W1): `app/store/[merchant]/loading.tsx` removed; unknown and hidden restaurants now return HTTP 404 (checked locally), public ones 200 |
| OQ-MerchantFeedback | Where Merchant Feedback goes: a new table (needs a migration and RLS) or a receiving inbox. Until decided, the dashboard shows the form but sends and stores nothing. | RESOLVED (SYNC-052) |

## Explicitly out of scope for current planning

- Grab order/payment API integration.
- Merchant direct Story publishing in V1.
- Dedicated Halal verification product logic.
- Automatic Story → Menu mutation.
- Full billing platform for Assisted Content.
- Enterprise staff/permission hierarchy unless later justified.
- Microservices solely for future scale.
- Autonomous AI publishing without human approval.

## Change rule

### Merchant auth and self-registration — 2026-09-27

User approved ChatGPT implementation: email/password daily login, email-confirmed self-registration and creation of an own private draft with atomic Owner membership; Magic Link remains for transition/recovery. No invitation or claim of an existing restaurant is needed to create a new draft. Five consecutive bad-password attempts from the current login source trigger 15 minutes of cooldown; recovery remains available, no permanent account lock, no effect on public listings. Minimum 8 characters, long passphrases allowed; shared accounts represent one identity. Hosted Auth configuration remains an environment prerequisite, not a code assumption.

A new feature idea must not silently become a decision. Add it here only after CH explicitly approves it or after the Master Spec is formally revised and approved.

## SYNC-048 — Managed listing review, publication and two separate limits (DECIDED, CH 2026-09-27)

- Owner completes name, address, valid contact, preset cuisine and at least one menu dish, then submits. Pending content is frozen; withdrawing returns to an editable draft. Rejection requires a visible reason.
- Approval leaves the restaurant hidden. Only its Owner explicitly publishes/hides it. First publication generates a name-based slug, with a collision suffix; retain a referenced slug. Later slug changes and 301 history are a separate package.
- Owner may edit name, location and cuisine only while managed draft/rejected. After approval those fields remain Admin-only. Approved About/contact/menu edits take effect immediately; published restaurants show those edits immediately. External links continue through review. This does not change Story editorial review.
- Pending-review capacity defaults to 20 and is configurable independently. Each Owner has at most one pending restaurant. Approval, rejection and withdrawal release queue places.
- Pilot admission defaults to 50 restaurants, counted per restaurant. Only managed (self-registered) pending/approved restaurants count; legacy restaurants do not (CH, 2026-09-27: otherwise an existing catalogue of 50+ restaurants would block every new submission), nor do managed drafts/rejected restaurants. Approved public/hidden/suspended restaurants retain their place. Lowering a limit never removes existing restaurants or cancels submissions. The post-launch total capacity remains a later operational decision, not a permanent product limit of 20 or 50.
- Notifications are durable outbox records only; no real email is sent.
- Scope: local implementation and tests only. No push, PR, hosted migration, merge or deployment authorized. B0/#63 migration history reconciliation remains a separate release task.
## SYNC-049 — Web address rename with permanent redirects (RECOMMENDATION, Claude 2026-09-27)

- Only Admin renames a restaurant web address (slug), in the Admin editor. Compare-and-set on the address shown; idempotent; audited.
- Every former address is kept in `merchant_slug_history` and redirects permanently (Next.js `permanentRedirect`, HTTP 308 — treated like 301 by search engines) while the restaurant is public. The never-public M2-B draft address `restaurant-<id>` is not kept.
- An address another restaurant used before can never be taken (database guard on every write path), so old links never point to a different restaurant. Changing back to an own former address is allowed.
- Articles (FK ON UPDATE CASCADE), Story submissions, assisted content requests and content cycles follow the rename. Analytics rows keep the address that was visited at the time (known limit: per-restaurant analytics split across addresses).
- Owners cannot rename; they ask the BiteSite team. Scope: local only.

## SYNC-050 — Owner dish photos (RECOMMENDATION, Claude 2026-09-27)

- Owners set or remove a dish photo from the dish editor, through the same checked flow as logo/cover (server-chosen path, signed upload, server checks size and real image type, compare-and-set bind, request-id replay). A new dish gets a photo after it is saved.
- Photos are resized on the phone to at most 1200 px WebP. Up to 60 dish uploads per restaurant per hour; they do not use the 20 logo/cover uploads.
- Dish photo changes on a public restaurant show immediately (same as other menu edits); a restaurant waiting for review is frozen. Stored objects are not deleted when a photo is replaced (no orphan clean-up yet).

## SYNC-051 — Owner private preview (RECOMMENDATION, Claude 2026-09-27)

- The Owner opens `/merchant/preview?merchant=<id>` ("Preview page" on the dashboard, new tab) to see the restaurant page with the same layout visitors get, in any state: draft, waiting for review, approved but hidden, suspended.
- Only the restaurant's active Owner can load it; the data is the public projection (no legacy reviews), so the preview never shows more than the public page would. A banner states whether visitors can see the page.
- No analytics are recorded (data-bs-analytics suppression), the page is noindex, and the API response is not cached.
- Admin can preview any restaurant (`&as=admin`, Admin session), linked from each Restaurant Reviews item so reviewers see the real page before approving.

## SYNC-052 — Merchant feedback destination (DECIDED, CH 2026-09-27; switched on)

- Recommended destination: a private `merchant_feedback` table read on a new Admin Feedback page (filter new/read/resolved, reply). The Owner sees the reply and status on the dashboard. No email yet (SMTP is off).
- Owners can send feedback while suspended, archived or waiting for review (the suspension notice points them to Feedback). Idempotent per request id; 10 per restaurant per hour.
- CH approved this destination on 2026-09-27; the dashboard form is switched on (`FEEDBACK_SENDING_ENABLED = true`).

## SYNC-053 — Three editable drafts per account (implements FINAL_AUDIT M2-A, Claude 2026-09-27)

- `merchant_restaurant_create` refuses a fourth self-service restaurant while the account already owns three in draft or rejected (`DRAFT_LIMIT`, 409 with an explanation). Submitted (pending) and approved restaurants do not count; retries of earlier requests still return their draft.
- The Owner can discard a self-service restaurant that was never public and is in draft or changes requested (dashboard "Discard draft", confirmed). It is archived, not deleted (read-only, Admin can restore) and no longer counts toward the three.
- Still open from M2-A (Decision needed, CH): rights declaration and terms version at creation. There is no terms page yet; the wording is a legal decision.

## SYNC-055 — Review notification emails (DECIDED by Claude under CH delegation, 2026-09-27)

- Outbox rows (submitted, withdrawn → Admin; approved, rejected with the note → Owner) are emailed by `/api/admin/notifications/deliver`: POST with the Admin session ("send now") or GET from a scheduler with `Authorization: Bearer $CRON_SECRET`.
- Provider: Resend when `RESEND_API_KEY` and `NOTIFY_FROM` are set; Admin rows go to `ADMIN_NOTIFY_EMAIL`; Owner rows to the Owner account email (Auth lookup). Without a provider nothing is claimed or sent. `NOTIFY_PROVIDER=log` (never in production) prints instead, for local tests.
- Each row is claimed under a 5-minute lease with SKIP LOCKED (no double sends) and retried up to 5 times. Scheduling (e.g. a Vercel cron every 10 minutes) and the sender domain are release tasks for CH.

## SYNC-056 — Owners see their own visitor statistics (DECIDED by Claude under CH delegation, 2026-09-27)

- Dashboard "Visitors": page views, unique visitors, menu views, WhatsApp/call/directions and other taps for 7, 30 or 90 days, with a daily bar chart. Includes former web addresses; previews never count.
- Only aggregates reach the Owner (no IPs, no raw rows); `merchant_stats` stays private (DEC-29). Data comes from raw `page_views` (kept 90 days), so counts are live.

## SYNC-057 — Owners mark temporarily closed (DECIDED by Claude under CH delegation, 2026-09-27)

- Owners switch OPEN ↔ TEMPORARILY_CLOSED with an optional note (≤200) and reopening date (today..+1 year); MOVED/PERMANENTLY_CLOSED stay Admin-only. The public page says "<name> is temporarily closed" with the note and date instead of the generic unavailable text.

## SYNC-058 — Merchant pilot terms acceptance (RECOMMENDATION, ChatGPT 2026-09-28)

- Creating a self-service restaurant requires agreement to pilot Merchant Terms version `2026-09-pilot` and an explicit declaration of authority to represent the restaurant and rights to use supplied text and photos. The accepted version and declaration are recorded privately with the new draft.
- The terms page is a draft for CH review. CH must approve the wording before hosted release; changing the version or accepted terms later needs an explicit rollout decision.

## SYNC-059 — Owners request name/address/cuisine changes after approval (DECIDED by Claude under CH delegation, 2026-09-28)

- After approval (and always for legacy restaurants) name, location and cuisine stay Admin-only, but the Owner can now send one reviewed request for any of them instead of "contact BiteSite". Approval applies every requested detail at once through the field-save contract (compare-and-set against the values when the Owner asked); reject needs a note the Owner sees. A newer request replaces the waiting one; it can be withdrawn.
- Owners cannot move the map pin or change the web address this way; Admin updates the pin after an address change (the queue reminds them) and keeps the slug panel. Shown on the Admin "Change Requests" page (formerly Link Reviews), counted in its badge. SYNC-063 adds decision emails for basics requests; links still have none.
- The older `merchant_profile_change_requests` (manual "resolved" flag, no Owner UI since D2-B) is left in place; retire it in the release review.

## SYNC-060 — Story submissions reference the restaurant by id (implements FINAL_AUDIT 05 §Stories, Claude 2026-09-28)

- `story_submissions.merchant_id` (FK, ON DELETE SET NULL) next to `merchant_slug`; a database trigger keeps the pair consistent for every writer (Owner RPC, Admin relayed submissions, the slug-change cascade) and resolves old addresses through slug history. A relayed submission whose slug matches no restaurant stays unlinked (null) instead of being guessed. Existing rows are backfilled. The Owner Story list is scoped by id. Articles keep `merchant_slug` (FK ON UPDATE CASCADE) for now.

## SYNC-061 — Admin sees each restaurant's change history (DECIDED by Claude under CH delegation, 2026-09-28)

- Merchant Manager → Features & status → "Change history" reads `merchant_change_log` (the D1a audit trail), newest first, 30 per page: operation, who (Owner shown by account email, "BiteSite Admin", or "Unknown" for direct database changes), and old → new values where the trail keeps them (state columns and the field-save paths); slug, links and photos are listed by name only. Read-only, Admin only, no migration. Owners do not see this history.

## SYNC-062 — No restaurant claim flow (DECIDED by CH, 2026-09-28)

- BiteSite does not offer "claim an existing restaurant" (Master Spec §21 claim flow, P1 "Merchant Claim flow", OQ-002 are out of scope). CH: claims add risk of the wrong person getting a restaurant. The only merchant journey is: register → confirm email → sign in with email and password → create own restaurant draft → submit for review → approved → publish. A first implementation (fa0c115) was reverted the same day. Admin can still link an Owner to a restaurant in Merchant Manager.

## SYNC-063 — Email Owners about basics review decisions (DECIDED by Claude under CH delegation, 2026-09-28)

- An Admin approval or rejection of an Owner's name, address, or cuisine request queues one Owner email through the existing notification outbox. The email links to the merchant dashboard and includes the Admin note when supplied. Delivery uses the existing active Owner recipient lookup.
- The notification kind constraint contains only the four listing review kinds and `basics_approved` / `basics_rejected`; claim kinds remain retired. No real email is sent as part of local verification.

## SYNC-064 — Admin can move a restaurant to a new Owner account (DECIDED by CH, 2026-09-28)

- When a business changes hands, Admin links the new person's account by email in Merchant Manager; the restaurant moves to it and the previous Owner loses access (membership suspended, not deleted). One database transaction (`merchant_owner_assign`) suspends the old Owner before activating the new one and audits both steps; before this, linking a second account always failed on the one-active-Owner index. Admin confirms before linking and sees who lost access.

## SYNC-065 — Area and cuisine landing pages (implements Master Spec §27, Claude 2026-09-28)

- `/area/<slug>` and `/cuisine/<slug>` list the public restaurants of one area or cuisine (cuisine = the `cuisine` tags plus the legacy `cuisine_type`, case-insensitive). Slugs are lowercase-hyphenated labels; other spellings redirect permanently; unknown groups 404. Pages with fewer than two restaurants render but are `noindex` and stay out of the sitemap (no thin pages). Each page has ItemList and BreadcrumbList JSON-LD and links to the other areas and cuisines; every store page links to its area and cuisine pages. Page views are tracked as `discovery`. No migration (public projection only).

## SYNC-066 — Visitors can report a problem on restaurant and Story pages (implements Master Spec §30 and §10.5 report path, Claude 2026-09-28)

- Every public restaurant and Story page has a collapsed "Report a problem with this page" form: a reason (restaurant: closed/moved, hours, phone, address, menu/prices, duplicate, fake, other; Story: my photo/text used without permission, shows me or my personal details, misleading, offensive, other), optional details and optional email. No sign-in.
- Reports only reach the new Admin "Visitor Reports" inbox (badge counts new ones); **nothing changes automatically** — a report is a hint, not a fact. Admin checks, fixes the page with the existing tools (or hides a Story in Stories Editor when the risk is material), and marks it resolved or dismissed with a note, or reopens it.
- Abuse limits: honeypot field, per-IP request limit, and a per-reporter cap of 20 per 24 hours with duplicates (same reporter, page and reason within 24 hours) dropped. The reporter is an HMAC of the IP with a server secret (`REPORT_HASH_SECRET`, else `ADMIN_SESSION_SECRET`); raw IPs are never stored. The reporter's email is optional and only visible to Admin.
