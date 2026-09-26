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
| OQ-SharedSectionA11y | Pre-existing accessibility gaps in shared sections, found while checking PR2B: the booking form's date, time and guests fields are not linked to their labels; the review date uses 50% opacity (below WCAG AA on any colour); Elegant overflows by 9px at 320px when there is no cover image. Fixing them changes the live layouts, so it is not part of PR2B. Update (P0, 2026-09-26): all six booking fields are now linked to their labels; the review date contrast no longer appears publicly because the carousel is not rendered (SYNC-035). | PENDING: Elegant 320px overflow only |
| OQ-AnalyticsNulls | Found while running `supabase/tests/analytics_aggregation_idempotence.sql` locally (D1a): the test calls `select` instead of `perform` inside a DO block, so it has never run; with that fixed it shows the hourly aggregate doubles counts, because the `merchant_daily_views` unique key uses NULLS DISTINCT and `/api/track` writes NULL key columns. Fix direction: `UNIQUE NULLS NOT DISTINCT` plus merging existing duplicate rows (a production data change). Not verified against production. | PENDING: separate small package + CH approval for the data merge |
| OQ-Soft404 | `app/store/[merchant]/loading.tsx` makes Next.js stream a 200 response before `notFound()` runs, so unknown, hidden and suspended restaurants show the not-found page with HTTP 200 (a soft 404; also true on production today). The spec requires a real 404 for direct links. | PENDING: W1/M5 |
| OQ-MerchantFeedback | Where Merchant Feedback goes: a new table (needs a migration and RLS) or a receiving inbox. Until decided, the dashboard shows the form but sends and stores nothing. | CH_REQUIRED |

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

A new feature idea must not silently become a decision. Add it here only after CH explicitly approves it or after the Master Spec is formally revised and approved.
