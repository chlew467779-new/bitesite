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
