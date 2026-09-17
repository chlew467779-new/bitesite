[BITESITE_MASTER_PRODUCT_DEVELOPMENT_SPEC.md](https://github.com/user-attachments/files/32336548/BITESITE_MASTER_PRODUCT_DEVELOPMENT_SPEC.md)

# BiteSite — Master Product, Architecture & Development Specification v3.3

**Document status:** Master Sync Candidate v3.3 / Source-of-Truth Candidate — Claude v3.2 confirmation passed; Gemini independent review incorporated; CH decisions applied
**Sync scope:** CH + ChatGPT + Claude + Gemini; Kimi skipped for now
**Revision basis:** v3.2 Master Spec + Claude v3.2 confirmation + Gemini independent review + CH decisions on Singapore pricing, Halal scope, and Story/Menu separation
**Important:** This document intentionally distinguishes confirmed decisions, recommendations, open questions, pending repository findings, and items explicitly out of scope.  
**Prepared for:** CH + Claude cross-review + future development  
**Date:** 17 September 2026  
**Current market focus:** Malaysia first; architecture should remain compatible with future Singapore expansion  
**Implementation baseline:** Existing BiteSite planning documents indicate Next.js App Router + Tailwind CSS + Supabase + Vercel, but the current repository must remain the final engineering source of truth until a real repository audit is completed.

---

## 0. How this document must be used

This document is intentionally broader than a normal feature specification. Its purpose is to create one shared mental model before significant implementation continues.

It must NOT be treated as proof that any feature is already implemented. For every feature, Claude/CH must distinguish:

- **DECISION** — product direction already agreed.
- **REQUIREMENT** — behavior BiteSite should support.
- **RECOMMENDATION** — proposed implementation that still needs technical validation.
- **OPEN QUESTION** — intentionally unresolved.
- **PENDING** — waiting for repository inspection, legal review, platform verification, or a product decision.
- **OUT OF SCOPE** — deliberately not being built now.
- **ASSUMPTION** — a working assumption that must be replaced by repository facts when audited.

### Source-of-truth rule

The final implementation must be based on:

1. the actual repository,
2. actual Supabase schema and RLS,
3. actual Vercel/runtime configuration,
4. actual production behavior,
5. this document for product intent,
6. and explicit decisions made after review.

Never “implement from the document” while ignoring existing code.

### Reconciliation rule for this version

This v3.3 document is the post-confirmation reconciliation candidate, not an assumption that every earlier statement remains valid. Where earlier versions conflict, the latest explicit v3.3 reconciliation decisions are authoritative for the planning discussion. Any unresolved issue remains explicitly marked as **OPEN**, **PENDING**, or **RECOMMENDATION** and must not be silently converted into a coding requirement.

---

# 1. Executive Summary

BiteSite should become a **restaurant discovery and merchant value platform**, not merely a restaurant directory.

The long-term product loop is:

> **Restaurant data → Discovery → Content → User traffic → Merchant actions → Measurable merchant value → Paid services → Better content/data**

The public user experience should help a diner move from:

> **Discover → Understand → Trust → Act**

where “Act” can be:

- visit the merchant,
- open directions,
- call / WhatsApp,
- visit the merchant website,
- open GrabFood,
- or continue exploring related BiteSite content.

The merchant experience should help a merchant move from:

> **Claim / Create → Maintain information → Submit content → Receive exposure → See analytics → Choose paid services**

BiteSite Admin/Operations should control quality through:

> **Review → Verify → Edit → Publish → Monitor → Correct / Remove**

The v3.3 decisions added after the Gemini review are:

- **Halal / pork-free:** no dedicated Halal/pork-free product field, badge, verification workflow, or special ranking/filter is included in the current scope. Merchant self-onboarding may provide such information if they choose; it remains merchant-supplied information under the normal content review rules.
- **Singapore assisted content pricing:** when Singapore is enabled, the Assisted Content Service price is **S$10**. Malaysia remains **RM20**. Do not calculate one from the other using live FX.
- **Stories and Menu are intentionally decoupled:** a Story may mention a new menu item, but publishing/editing a Story does **not** create, modify, sync, or otherwise change the core Menu System. Stories are ordinary promotional/editorial posts.

The two newly confirmed product directions covered by this document are:

### A. Merchant Page → GrabFood outbound ordering link

A Merchant Page can contain an **Order on GrabFood** button/icon. Clicking it should send the user to the merchant’s own GrabFood store page. BiteSite does not process the order or payment.

Grab’s current Malaysia Merchant Portal documentation describes “Smart Link” as a way to direct social media followers to a merchant’s GrabFood store where they can place an order, which supports the general deep-link/outbound-link pattern BiteSite is considering. This does **not** mean BiteSite should integrate the Grab API in V1.

### B. Stories — Admin-controlled editorial system

Merchant does **not** directly publish Stories in V1.

Instead:

> Merchant provides facts/materials → BiteSite receives submission → AI may help structure/copy-edit → CH/Admin reviews → BiteSite publishes.

This is deliberate. It protects BiteSite’s content quality, reduces spam, makes the public feed more consistent, and allows BiteSite to control copyright/rights declarations, factual accuracy, misleading claims, image quality, and brand voice.

A Merchant that fails to provide content does **not** automatically owe a “fine”. Instead, free editorial promotion is a benefit tied to an active content relationship. After reminders/grace period, the merchant can become **Content Inactive** and lose active promotional distribution while keeping its normal Merchant Page/listing.

BiteSite can offer an **Assisted Content Service** where BiteSite turns merchant-provided facts/photos into a publishable Story. Current market pricing is **RM20 for Malaysia** and **S$10 for Singapore**; these are market-specific prices, not FX-converted equivalents.

---

# 2. Product North Star

## 2.1 User value

BiteSite should answer:

> “Where should I eat, and what do I need to know before I go?”

A good Merchant Page should make it easy to answer:

- Is the restaurant open now?
- Where is it?
- What kind of food is it?
- What are the key menu items?
- What does it cost?
- Can I call / WhatsApp?
- Can I get directions?
- Can I order online?
- Can I see recent BiteSite Stories?
- Can I trust the information?

## 2.2 Merchant value

BiteSite must eventually answer:

> “Why should a restaurant owner care about being on BiteSite?”

The answer cannot be only “we have a listing”. The platform should eventually demonstrate measurable traffic and useful actions, including profile views, menu views, direction clicks, WhatsApp/phone clicks, website clicks, Story exposure and outbound ordering clicks.

The current planning baseline already identifies the same strategic loop: Free listing → user discovery → measurable merchant exposure → merchant analytics → paid promotion. This remains a core principle.

## 2.3 BiteSite value

BiteSite needs a repeatable way to acquire:

- structured merchant data,
- fresh content,
- organic search traffic,
- social traffic,
- repeat users,
- merchant participation,
- and eventually merchant revenue.

Stories are therefore not “just a social feature”. They are a **traffic acquisition and merchant participation mechanism**.

---

# 3. Current Baseline and Existing Planning Context

The existing BiteSite planning brief describes a product with or around these capabilities/directions:

- restaurant listing,
- restaurant detail pages,
- search / filters,
- cuisine / area / tags,
- open / closed display,
- Merchant Manager,
- Merchant Editor Form,
- structured operating hours,
- payment methods,
- gallery / visual layouts,
- Stories / blog,
- Admin dashboard,
- analytics / tracking,
- Supabase,
- Vercel,
- Next.js App Router,
- Tailwind CSS,
- future Merchant self-onboarding,
- future Menu Manager,
- Preview mode,
- paid promotion / monetization,
- SEO / Google discoverability,
- Trust / Reviews,
- Abuse / Spam / Security.

These are **planning facts**, not repository-verified implementation facts.

The prior design brief also already establishes several important principles:

- Merchant is a long-lived changing entity, not a one-time form.
- Owner and Merchant identity should not be conflated.
- Changes should be traceable.
- User reports are not automatically truth.
- AI/OCR should not silently publish unverified high-risk data.
- Menu item images are optional.
- Images should be optimized.
- Database and media storage should be thought about separately.
- Operating hours should use merchant-local timezone.
- Preview should resemble the public page.
- Layout structure should remain consistent while section visibility/theme can be configurable.
- Location should influence ranking rather than prevent cross-border browsing.
- Original currencies should be preserved.
- Malaysia and Singapore should share a common platform model where practical.
- Security/RLS is foundational.
- Avoid premature enterprise engineering.

---

# 4. Product Principles — Non-Negotiable Unless Challenged by the Repository

## P-001 Correctness before feature count

A smaller trustworthy platform is preferable to a large platform with unreliable business data.

## P-002 Public page quality is part of the product

A restaurant page is not just a database record. It is a user-facing information product.

## P-003 Merchant is a mutable entity

Price, menu, hours, phone, URL, photos, status, ownership and content can change over time.

## P-004 Admin controls public trust

Merchant submissions should enter a review flow when they affect public editorial content, especially Stories.

## P-005 AI assists; humans approve high-risk publication

AI can draft, rewrite, classify, summarize, normalize and flag. AI should not silently invent facts or publish high-risk claims.

## P-006 Free does not mean unmanaged

A free merchant listing can exist without automatically receiving unlimited BiteSite editorial promotion.

## P-007 Paid promotion must remain distinguishable from organic relevance

BiteSite should not pretend that a paid placement is an organic recommendation if the product semantics say otherwise.

## P-008 Keep V1 simple

Prefer relational tables + status fields + timestamps + RLS + straightforward workflows over microservices/event-sourcing/enterprise workflow engines.

## P-009 Instrument important user actions

Important outbound actions should be measurable from the beginning, even if billing is not implemented.

## P-010 Preserve future flexibility without building everything now

The architecture should avoid blocking multi-location merchants, paid promotion, analytics, more delivery platforms, content moderation and future expansion — but should not implement those systems prematurely.

---

# 5. Priority Framework

## P0 — Critical / must get right now

- Public Merchant Page correctness.
- Merchant/admin ownership boundaries.
- Supabase RLS / authorization.
- Secure file uploads.
- Merchant lifecycle states.
- Operating hours correctness.
- GrabFood outbound link support.
- Story submission → review → publish workflow.
- Content rights declaration.
- Basic content moderation / rejection flow.
- Auditability of admin publication.
- Analytics events for key actions.
- SEO foundations.
- Error handling / broken links.
- Mobile usability.

## P0 Sync additions confirmed from Claude review

The following are now part of the working P0 product/architecture baseline:

- Split merchant `platform_status` from `business_status` instead of one mixed status enum.
- Story expiry must be a derived display condition from `end_at`; it must not silently archive or hide the Story.
- Story submission must support structured fields, while also allowing an admin-relayed channel for merchants who cannot comfortably use the form.
- `story_submission.channel` should distinguish `self_service_form` from `admin_relayed`, while both feed the same editorial pipeline.
- Story form should reserve help/hint text for every field.
- Story media should support one cover image plus up to three general images.
- Uploaded images should be compressed/optimized automatically.
- Emoji must survive the complete input → storage → rendering pipeline.
- AI copy assistance is a required editorial step for the intended V1 workflow, not merely an optional enhancement.
- Admin dashboard UX also requires contextual hints so non-technical helpers can operate routine tasks safely.
- Use a generic external-action/order-link model where practical so future foodpanda / ShopeeFood links do not require a new architectural branch.
- Limit concurrent pending Story submissions per merchant to a simple, explicit rule (initial recommendation: max 1 pending submission).
- Track RM20 assisted-content payment/service state explicitly even if collection remains manual in V1.
- Published Story edits should return to editorial review; do not silently mutate already-published public content.

These items are incorporated below and should not be reintroduced later as unresolved legacy design.

## P1 — Important / should follow shortly

- Merchant Claim flow.
- Merchant Preview.
- Merchant analytics dashboard.
- Menu lifecycle improvements.
- Story content cadence/reminders.
- RM20 assisted content workflow (without automated billing initially).
- User reports/corrections.
- Social distribution checklist/process.
- Better duplicate merchant detection.
- Image processing pipeline.
- Structured SEO landing pages.

## P2 — Useful after product validation

- foodpanda / ShopeeFood outbound links.
- Paid promotion packages.
- Merchant subscriptions.
- Advanced recommendation/ranking.
- Review system improvements.
- AI content assistance directly inside Merchant Dashboard.
- Menu OCR / image-to-menu import.
- richer merchant analytics.

## P3 — Future / do not distract from launch

- Full payment/billing infrastructure.
- Staff role hierarchy.
- Enterprise dispute resolution.
- Full autonomous AI merchant agent.
- Microservices.
- Complex workflow engine.
- Multi-country operational separation.
- Large-scale automated social posting infrastructure.

---

# 5.5 Sync Decision Register — v3.3

This is a compact checklist of the changes carried into this reconciliation. It is intentionally separate from implementation details.

| ID | Topic | v3.3 working position | Status |
|---|---|---|---|
| SYNC-001 | Merchant status | Split `platform_status` and `business_status`; `TRANSFERRED` is ownership history, not status. | **DECIDED** |
| SYNC-002 | Story expiry | `end_at` produces a derived `is_expired` display condition; expiry does not archive/hide Story. | **DECIDED** |
| SYNC-003 | Story publishing | Merchant submits; CH/Admin publishes. | **DECIDED** |
| SYNC-004 | Story channels | `self_service_form` and `admin_relayed` converge into one pipeline. | **DECIDED** |
| SYNC-005 | Story media | 1 cover image + up to 3 general images; automatic optimization. | **DECIDED** |
| SYNC-006 | Story copy | AI assistance is a required editorial step in the intended V1 workflow; human approval remains required. | **DECIDED** |
| SYNC-007 | Accessibility | Merchant and Admin UIs reserve clear contextual hints/help text. | **DECIDED** |
| SYNC-008 | Rights | Merchant rights declaration remains required; admin-relayed submissions must record the confirmation. | **DECIDED** |
| SYNC-009 | GrabFood | V1 is outbound URL only; no Grab order/payment API. | **DECIDED** |
| SYNC-010 | External links | Use a generic external-action model where practical so future delivery providers do not require a new architecture branch. | **RECOMMENDATION** |
| SYNC-011 | RM20 | RM20 is a service, not a fine; minimal service/payment status can be tracked manually. | **DECIDED** |
| SYNC-012 | Published Story edits | Material edits require a new editorial review before public replacement. | **DECIDED** |
| SYNC-013 | 60-day clock | 60-day cadence is agreed as the working concept; exact start/reset event remains open. | **OPEN** |
| SYNC-014 | Pending queue cap | Initial recommendation: maximum 1 pending Story submission per merchant. | **RECOMMENDATION** |
| SYNC-015 | Merchant lifecycle ↔ Stories | Historical Stories should not be destroyed merely because a merchant closes; exact automatic visibility rule remains open. | **PENDING** |
| SYNC-016 | Grab branding | V1 should not depend on Grab logo/brand color; verify branding requirements separately before using them. | **RECOMMENDATION** |
| SYNC-017 | Halal / pork-free scope | No dedicated Halal/pork-free field, badge, verification workflow, ranking/filter, or special product logic in current scope; merchant may self-enter related information if they choose, subject to normal content review. | **DECIDED / OUT OF SCOPE** |
| SYNC-018 | Assisted content pricing | Malaysia: RM20. Singapore: S$10 when Singapore is enabled. Market-specific fixed prices; no FX conversion logic in V1. | **DECIDED** |
| SYNC-019 | Story ↔ Menu coupling | A Story may promote a new menu item, but Story publishing does not create/update/sync Menu System data. Stories are ordinary promotional/editorial posts. | **DECIDED** |

# 6. Merchant Page — Functional Specification

## 6.1 Required sections

A Merchant Page may contain:

- Merchant name.
- Cover/hero image.
- Gallery.
- Description.
- Cuisine/category.
- Area/location.
- Address.
- Opening status.
- Opening hours.
- Contact number.
- WhatsApp where appropriate.
- Website.
- Social links.
- Menu.
- Map/directions.
- GrabFood order button.
- Related Stories.
- Reviews/trust indicators when available.
- Last updated / verification information when product design supports it.

## 6.2 Merchant layout consistency

Merchant should not have a free-form page builder.

The order and semantics of core sections should be controlled by BiteSite so that:

- UX remains consistent,
- SEO remains predictable,
- structured data remains valid,
- accessibility remains manageable,
- mobile layouts remain robust,
- future code stays maintainable.

Section visibility and controlled theme options may be configurable.

---

# 7. GrabFood Integration — V1 Specification

## 7.1 Product decision

**DECISION:** V1 uses an outbound merchant-provided GrabFood store URL, not direct order processing and not a custom checkout.

User flow:

```text
User discovers Merchant on BiteSite
        ↓
Merchant Page
        ↓
[ Order on GrabFood ]
        ↓
Merchant's GrabFood page
        ↓
User orders in Grab
```

BiteSite is not responsible for:

- cart,
- ordering,
- payment,
- delivery,
- refunds,
- Grab account authentication,
- Grab order status.

## 7.2 Merchant data

Recommended conceptual fields:

```text
grab_food_url
foodpanda_url           (future)
shopeefood_url          (future)
ordering_url_verified_at
ordering_url_status
ordering_url_last_checked_at
```

Do not hard-code a platform-specific column explosion if a simple “external ordering links” model can support future channels cleanly. However, a dedicated `grab_food_url` is acceptable and very readable for V1.

## 7.3 Merchant workflow

```text
Merchant Login
    ↓
Edit Merchant
    ↓
Paste GrabFood Store Link
    ↓
Validation
    ↓
Optional Admin Review
    ↓
Save
    ↓
Public Merchant Page
```

The system should not attempt to guess the restaurant's Grab page from its name.

## 7.3A Grab branding / button treatment

Working V1 recommendation from Claude review:

- do not make the first implementation dependent on official Grab logo/brand-color requirements;
- a clear text CTA such as “Order on GrabFood” is sufficient for V1;
- only adopt official logo/brand treatments after BiteSite has verified the applicable Grab brand guidance.

This is a presentation decision, not a blocker for the outbound URL architecture.

## 7.4 URL validation

At minimum validate:

- URL is syntactically valid.
- HTTPS.
- approved host/domain pattern where technically appropriate.
- link is not obviously malicious.
- link belongs to an allowed external ordering domain.

The exact host validation rules should be maintained in configuration, not buried in UI code.

## 7.5 Outbound event tracking

When a user clicks GrabFood, record an analytics event such as:

```text
merchant_order_click
platform = grabfood
merchant_id
page_id
session_id or anonymous event id where appropriate
timestamp
referrer/context where useful
```

Do not store unnecessary personal data.

Key merchant-level metric:

> **GrabFood Clicks**

This is a useful bridge from BiteSite “discovery” to merchant commercial intent.

## 7.6 Error handling

If GrabFood link is broken:

- do not send the user into a dead end,
- allow admin/merchant to report/update the link,
- optionally show “Ordering link currently unavailable” rather than a broken icon.

## 7.7 V1 non-goals

Do not build:

- Grab API integration,
- cart mirroring,
- checkout,
- payment handling,
- order-status sync,
- delivery tracking.

## 7.8 Future architecture

Use a generic external-action abstraction where practical:

```text
ExternalAction
- type: ORDER / CALL / WHATSAPP / DIRECTIONS / WEBSITE
- provider: GRABFOOD / FOODPANDA / SHOPEEFOOD / OTHER
- url
- is_active
- display_order
```

Do not overbuild this if a simple relational model is cleaner in the current repository.

---

# 8. Stories — Product Decision

## 8.1 V1 publishing model

**DECISION:** Merchant cannot directly publish a Story.

Only BiteSite Admin/authorized editorial users can publish public Stories.

Merchant can only:

> Submit Content

Reasoning:

- consistent editorial quality,
- reduced spam,
- reduced copied content,
- easier copyright/right-of-use controls,
- better factual checking,
- consistent visual style,
- better SEO/social brand consistency,
- controlled promotional frequency.

## 8.2 Story pipeline

Two merchant submission channels feed one editorial workflow:

```text
A. Self-service merchant form
        OR
B. Admin-relayed submission (WhatsApp/email/etc.)
        ↓
story_submission
        ↓
Content validation
        ↓
Rights / declaration confirmation
        ↓
AI-assisted copy editing (required V1 step)
        ↓
CH/Admin editorial review
        ↓
Approve / Need changes / Reject
        ↓
Create or update Story draft
        ↓
Publish
        ↓
BiteSite Story
        ↓
Manual social distribution in V1
```

The two submission channels must **not** create two separate moderation/publishing systems. They converge on the same `story_submission` data model and the same review queue.

## 8.3 Story status model

The Story itself should use a deliberately small public lifecycle:

```text
DRAFT
PUBLISHED
ARCHIVED
```

`EXPIRED` is **not** a Story status. If an offer/promotion has an `end_at` and the current time is after it, the system derives `is_expired = true` for display purposes only. The Story remains searchable and visible unless separately archived/hidden for an editorial reason.

### Working submission/review workflow recommendation

Claude challenged whether `SUBMITTED`, `IN_REVIEW`, and `NEEDS_CHANGES` need to be persisted as separate database states. For V1, the working recommendation is to keep this workflow deliberately small:

```text
DRAFT
PENDING_REVIEW
APPROVED
REJECTED
```

A request for changes is not a final rejection. When a submission is still eligible for revision, it returns/remains in `DRAFT` with `action_required` and/or `review_notes`, so the merchant/admin can correct it and resubmit. `REJECTED` is reserved for a final decision where the submission will not continue through the normal revision flow. `IN_REVIEW` can be a dashboard/queue view rather than a long-lived database enum.

**Status:** This simplified workflow is a working recommendation for Claude/repository validation, not a claim that the current repo already matches it.

Published content should not be silently edited. A material edit to an already-published Story should create/update a draft revision and require editorial approval before the public version changes.

Do not delete published content without a reason. Preserve enough history for audit and correction.

---

# 9. Story Submission — What Merchant Must Provide

A key product rule:

> **Merchant should submit facts and source material, not be required to write a polished article.**

This reduces copied promotional language and gives BiteSite editorial control.

### Submission channel

Every submission records how it entered BiteSite:

```text
channel = self_service_form | admin_relayed
```

The `admin_relayed` path is intentionally allowed for merchants who are not comfortable using a web form. If rights permission is collected through the relay channel, the admin should record the confirmation in the submission audit trail rather than bypassing the declaration entirely.

## 9.1 Required fields

### Merchant identity

- Merchant ID / selected merchant.
- Submitter account.

### Content purpose

Select one or more:

- New menu item (editorial promotion only; does not modify or create Menu System data).
- New product.
- Promotion.
- Event.
- Seasonal item.
- Store update.
- Opening / reopening.
- Local story / behind-the-scenes.
- Other.

### Facts

- What is being announced?
- Product/menu name.
- Price where applicable.
- Promotion period where applicable.
- Start date.
- End date.
- Availability days/times.
- Location/branch.
- Important restrictions.
- Relevant order method.
- CTA.

### Media

- 1–3 good-quality images as a recommended default.
- More only where justified.

## 9.2 Optional merchant text

Merchant may provide a rough description, but BiteSite should treat it as **source material**, not automatically publish-ready copy.

### Media

V1 should support:

- **1 cover image** — used as the Story hero/thumbnail/social share image;
- **up to 3 general images** — used inside the Story or gallery treatment;
- optional video is future scope.

Images should be automatically resized/compressed during upload so the merchant does not need to prepare optimized files manually.

## 9.3 Photo requirements

Recommended guidance:

- clear subject,
- sufficient resolution,
- no obvious blur,
- no severe compression,
- no stolen/watermarked third-party image,
- no misleading image relative to the product,
- no sensitive/private information in the frame.

If image quality is poor, status should become `NEEDS_CHANGES` rather than silently publishing a poor asset.

---

# 10. Story Content Rights / Copyright / Third-Party Content Controls

## 10.1 Product principle

A Merchant submission is **not automatically safe for BiteSite to republish**.

The Merchant should confirm that it owns the content or has the required permissions for BiteSite to use, edit and publish it.

MyIPO's official materials describe copyright as an exclusive legal right and indicate that use of copyrighted works should be authorized by the copyright owner; Malaysia's copyright framework also provides for assignment/licensing arrangements. This is why BiteSite should have an explicit rights declaration rather than relying on an informal assumption that “the merchant sent it, so we can publish it.”

## 10.2 Required submission declaration

Recommended checkbox text for product/legal review:

> “I confirm that I own this content or have obtained the necessary rights and permissions for BiteSite to use, edit, reproduce and publish it on BiteSite and BiteSite's official channels, subject to BiteSite's content terms.”

Second declaration:

> “I confirm that the information I have provided is accurate and not intentionally misleading.”

Third declaration:

> “Where people or third-party protected material are identifiable in the submitted content, I confirm that I have obtained any permissions/consents required for the intended use.”

These statements should be reviewed by Malaysian counsel before becoming final legal Terms/contract text.

## 10.3 Copy-and-paste risk

If CH sees:

- obvious copied text,
- content clearly attributable to another restaurant/page,
- third-party article text,
- another creator's caption,
- a watermark that suggests the asset belongs to somebody else,

the default action should be **Do Not Publish** until the Merchant provides evidence of rights or a replacement.

## 10.4 Important nuance

BiteSite should not try to build a complicated plagiarism detector in V1. Human editorial review + rights declaration + easy rejection/request-change workflow are enough initially.

Future options may include similarity checks, image reverse-search workflows, or automated flags if scale justifies them.

## 10.5 Removal workflow

Public Story should have an internal report path.

```text
Report
  ↓
Reason
  ↓
Content temporarily hidden if risk is material
  ↓
Admin review
  ↓
Restore / Edit / Remove
  ↓
Log reason and resolution
```

---

# 11. Personal Data / People in Photos

If Merchant submits photos containing identifiable customers, staff, event attendees or children, the content may introduce privacy / personal-data concerns.

Malaysia's Personal Data Protection materials indicate that identifiable photographs can fall within personal-data considerations. Therefore BiteSite should not design the Story system as if “restaurant-owned photo” automatically means “everyone in the photo is fair game”.

Product safeguards:

- discourage unnecessary identifiable customer photos,
- require the merchant to confirm appropriate permission/consent where applicable,
- reject clearly inappropriate/private/sensitive images,
- exercise extra caution with children,
- provide removal/reporting channels.

Do not collect more personal data than necessary for Story submission.

---

# 12. Story Content Quality Rules

## 12.1 Content should be factual first

Preferred:

> New grilled chicken rice set — RM9.90 — available from 1 October.

Risky:

> KL's #1 grilled chicken rice and the cheapest in Malaysia!

The second type contains claims that may require evidence and can become misleading advertising risk.

Malaysia's consumer-protection / trade-description framework contains provisions against false or misleading representations and advertising, so BiteSite should not blindly publish merchant claims merely because a merchant submitted them.

## 12.2 Claim levels

### Level A — direct facts

Generally easier to verify:

- price,
- date,
- address,
- item name,
- opening hour,
- stated promotion terms.

### Level B — descriptive opinion

Examples:

- rich,
- crispy,
- creamy,
- spicy.

These should remain clearly descriptive rather than masquerading as objective rankings.

### Level C — superiority / ranking / absolute claims

Examples:

- No. 1,
- best in KL,
- cheapest,
- most popular,
- guaranteed,
- 100% healthy.

These require evidence or editorial rewriting/removal.

### Level D — medical/safety/high-risk claims

Examples:

- cures illness,
- medical benefits,
- weight-loss claims,
- allergy/safety guarantees.

Do not publish casually; require a specific policy / legal review.

---

# 13. Story Format and Editorial Template

A standard BiteSite Story should typically contain:

1. **Headline** — what changed?
2. **Hook** — why a local user may care.
3. **Key facts** — item, price, date, branch.
4. **Context** — concise description.
5. **CTA** — view merchant / visit / order.
6. **Merchant attribution** — clear association with the merchant.
7. **BiteSite editorial note** where needed.

Do not force every Story to be long. A short, useful Story can be better than an artificial “article”.

---

# 14. Stories Distribution Strategy

## V1: manual distribution

BiteSite Stories can be adapted manually for:

- BiteSite Stories,
- BiteSite Facebook Page,
- BiteSite Instagram,
- BiteSite Xiaohongshu.

Do not make social API integrations a V1 dependency.

The internal workflow should instead create a **distribution checklist**:

```text
[ ] BiteSite Story published
[ ] Facebook version posted
[ ] Instagram version posted
[ ] Xiaohongshu version posted
[ ] Merchant Page linked
[ ] GrabFood link verified if relevant
```

## Why manual first?

- lower development complexity,
- easier to learn what content actually performs,
- less dependence on third-party APIs/platform approvals,
- easier editorial control.

Automation can be added only after volume justifies it.

---

# 15. Merchant Content Participation / 60-Day Rule

## 15.1 Product intent

BiteSite wants merchants to periodically contribute fresh content so the platform can continually promote local businesses.

However, the system should not create a punitive “fine” model where a merchant simply owes BiteSite RM20.

## 15.2 Recommended operating model

### Active

Merchant has submitted content within the required period.

Benefit:

- eligible for normal editorial promotion,
- Story review queue,
- social distribution where selected.

### Due

The content cycle is approaching its deadline.

Merchant receives a reminder.

### Overdue / Grace Period

Merchant has not submitted content.

Offer:

- submit content for free, OR
- ask BiteSite to create a Story from provided facts/materials for the applicable market price (Malaysia RM20 / Singapore S$10).

### Content Inactive

After the grace period, if merchant has neither provided content nor purchased assisted creation:

- keep Merchant Page live,
- keep existing public data,
- keep organic discovery eligibility subject to normal ranking,
- stop treating the merchant as eligible for ongoing free editorial promotion until the content cycle is reactivated.

This is a **benefit/eligibility rule**, not a penalty fee.

## 15.3 Recommended cadence

Initial product proposal:

- 1 eligible Story/content contribution every 60 days;
- reminder before due date;
- grace period after due date;
- then Content Inactive if the merchant has neither supplied content nor used the assisted-content service.

**Important pending decision:** define exactly what event starts/resets the 60-day clock. Candidate rules include:

1. Merchant joins BiteSite;
2. Last approved/published eligible Story;
3. Last merchant content submission;
4. Another explicit merchant-activity event.

Do not implement three different interpretations in different parts of the system. Pick exactly one rule in the final Functional Spec. Until then, treat the clock-start rule as OPEN and do not hard-code multiple behaviors.

## 15.4 Why this is better than forcing payment

Some merchants will simply ignore the program.

BiteSite should not waste staff time repeatedly chasing merchants.

The product should gracefully handle:

> Merchant contributes → promoted.

> Merchant pays the applicable market price (Malaysia RM20 / Singapore S$10) → BiteSite helps create → promoted.

> Merchant does nothing → normal page remains, editorial promotion pauses.

---

# 16. Assisted Content Service

## 16.1 V1 philosophy

The Assisted Content Service is a **content service, not a punishment**.

### Current V1 market pricing

| Market | Assisted Content Service price |
|---|---:|
| Malaysia | RM20 |
| Singapore | S$10 |

These are market-specific fixed prices. V1 does not require live currency conversion or a shared FX pricing engine. If pricing changes later, update the market pricing configuration rather than deriving one market price from the other.

Merchant provides source material.

BiteSite turns it into a publishable Story.

## 16.2 Minimum service promise

Potential scope:

- clean up supplied text,
- create headline,
- write short Story copy,
- basic formatting,
- select / crop suitable submitted image,
- publish to BiteSite Story,
- optionally include the Story in the normal social distribution process.

Do not promise unlimited revisions or professional photography at the assisted-content price.

### Operational tracking requirement

Even if money collection is manual, BiteSite should record a minimal service/payment state so CH does not have to remember who has paid:

```text
REQUESTED
PENDING_PAYMENT
PAYMENT_CONFIRMED
IN_PROGRESS
READY_FOR_REVIEW
PUBLISHED
CANCELLED
```

The exact payment method remains out of scope for a full billing integration.

## 16.3 Billing status in V1

Do not build full payment infrastructure unless there is a business need.

V1 can use:

```text
REQUESTED
PENDING_PAYMENT
PAYMENT_CONFIRMED
IN_PROGRESS
READY_FOR_REVIEW
PUBLISHED
CANCELLED
```

but the exact payment method can be manual/admin-operated during the early product phase.

---

# 17. Merchant Content Dashboard

Merchant should eventually see:

- next content due date,
- current content status,
- previous submissions,
- approved/published Stories,
- rejected/needs-changes Stories,
- reason for rejection/change request,
- Assisted content option (Malaysia RM20 / Singapore S$10).

Potential UI:

```text
Content Status: ACTIVE
Next Content Due: 20 Nov 2026

[ Submit New Content ]
[ Ask BiteSite to Create ]

Recent Content
- New grilled chicken rice — Published
- Weekend promotion — Needs Changes
```

Do not expose internal moderation notes unnecessarily.

---

# 18. Admin Story Dashboard

Admin needs a queue view:

```text
PENDING REVIEW
ACTION REQUIRED
APPROVED / READY TO PUBLISH
SCHEDULED
PUBLISHED
REPORTED
HIDDEN / ARCHIVED
```

These labels are operational queue views. They should not automatically become a giant database status enum.

Useful filters:

- Merchant.
- Date.
- Status.
- Content type.
- Priority.
- Rights declaration missing.
- Image quality issue.
- Factual issue.
- Promotion/advertising claim.

Admin actions:

- Open submission.
- View original material.
- Edit copy.
- Replace image.
- Request changes.
- Approve.
- Schedule.
- Publish.
- Hide.
- Archive.
- Record reason.

---

# 19. Audit Trail

Important Story events should be traceable.

Recommended conceptual fields:

```text
content_id
merchant_id
submitted_by
submitted_at
last_edited_at
edited_by
approved_by
approved_at
published_by
published_at
status
rejection_reason
rights_declaration_version
source_media_ids
```

Do not create a giant event-sourcing system. A practical history table or content revision records should be enough.

---

# 20. Merchant Lifecycle — Split Platform and Business Status

**Important reconciliation:** the previous v2 document accidentally reintroduced an older single-enum model. That design is rejected.

BiteSite must distinguish:

### Platform status

```text
platform_status:
DRAFT
PENDING_REVIEW
PUBLISHED
SUSPENDED
ARCHIVED
```

This describes how BiteSite is handling the listing.

### Business status

```text
business_status:
OPEN
TEMPORARILY_CLOSED
MOVED
PERMANENTLY_CLOSED
```

This describes the real-world operating state of the merchant/business.

### Ownership transfer

`TRANSFERRED` must **not** be a merchant status. A transfer is an ownership-history event connecting the same merchant/business identity to different authorized owners/members over time.

Conceptually:

```text
Merchant X
  ↓
ownership history
Owner A → Owner B
```

This separation protects:

- SEO history,
- stable URLs,
- analytics history,
- claim/ownership logic,
- business lifecycle semantics,
- moderation and suspension semantics.

Closed merchants should not automatically become 404 pages if useful historical/search value remains. A closed page can clearly state its status and offer alternatives/nearby merchants.

---

# 21. Merchant Ownership and Claim

## Principle

**Owner is not the Merchant.**

A physical/business identity should survive ownership changes when appropriate.

Conceptual relationship:

```text
Account
  ↕
Merchant Membership / Ownership
  ↕
Merchant
  ↕
Location
```

V1 does not need employee roles.

It should, however, avoid a database design that assumes:

> one user account = one restaurant forever.

Future target:

> one authenticated account → one or multiple authorized merchants/branches.

## Claim flow

```text
Existing Merchant Page
    ↓
Claim this business
    ↓
Login
    ↓
Verification
    ↓
Admin review where necessary
    ↓
Merchant membership created
```

Possible verification evidence:

- business email,
- domain/email ownership,
- phone confirmation,
- business registration proof,
- proof of operational control,
- other practical evidence.

The exact verification method remains pending repository/user-behavior review.

---

# 22. Merchant Authentication

Current planning preference: low-friction passwordless authentication, such as email magic link/OTP, with possible future phone/WhatsApp verification.

This remains a recommendation, not a final technical decision until the actual repository is audited.

Must consider:

- Supabase Auth support,
- account recovery,
- duplicate accounts,
- abuse prevention,
- ownership disputes,
- multiple merchant locations,
- admin separation,
- future paid promotion/billing ownership.

---

# 23. Menu System

Menu should support lifecycle, not be a static blob.

Potential menu-item states:

```text
ACTIVE
SOLD_OUT
HIDDEN
ARCHIVED
```

Do not delete history unnecessarily.

Possible data dimensions:

- name,
- price,
- description,
- category,
- image,
- ingredients,
- spice level,
- size,
- variants,
- add-ons.

Core fields should remain relational and queryable; flexible low-frequency fields may use JSONB only where justified.

### Story/Menu separation

A Story may mention or promote a new menu item, but Story content is **not** a source of truth for the Menu System. Publishing a Story must not automatically create, edit, price, archive, or otherwise mutate any menu item. If CH/Admin also wants the menu updated, that is a separate Menu workflow and must be performed explicitly.

---

# 24. Future Menu Photo/PDF → AI Import

Potential workflow:

```text
Upload PDF / image
    ↓
Detect / extract
    ↓
Vision / OCR
    ↓
AI normalization
    ↓
Draft menu
    ↓
Warnings / confidence
    ↓
Merchant review
    ↓
Merchant confirms
    ↓
Publish
```

AI must not silently treat OCR output as final menu data.

This is P2/P3 unless merchant onboarding pain proves it is worth doing sooner.

---

# 25. Media / Image Architecture

The platform should expect future scale.

A planning stress case is:

> 3,000 merchants × 200 menu items = 600,000 menu items.

Not every item will necessarily have an image, but the architecture should not assume all media is tiny.

Principles:

- Menu image optional.
- Validate file type.
- Validate size.
- Resize/compress.
- Store optimized variants.
- Lazy load.
- CDN/cache where useful.
- Keep private verification documents out of public media paths.
- Do not load original images everywhere.

Potential image variants:

- thumbnail,
- card,
- detail,
- social/export.

Do not lock the architecture to an assumption that Supabase Storage will always be the only media system.

---

# 26. Operating Hours

Hours are a trust-critical feature.

Must be able to model:

- different daily times,
- multiple opening slots,
- lunch breaks,
- overnight hours,
- special dates,
- temporary closures,
- public holidays where needed,
- merchant timezone.

Recommended conceptual model:

```text
Regular weekly schedule
+
Special-date overrides
+
Temporary closures
+
Merchant timezone
```

Public status is then calculated from the merchant's local timezone.

Tests should cover midnight, multi-slot, overnight and special-date cases.

---

# 27. SEO / Google Discoverability

SEO is a product function, not a marketing afterthought.

Minimum architecture should consider:

- crawlable merchant pages,
- clean canonical URLs,
- stable slugs,
- sitemap,
- robots rules,
- metadata,
- Open Graph/social metadata,
- JSON-LD / structured data,
- breadcrumbs,
- internal links,
- area landing pages,
- cuisine landing pages,
- relevant discovery pages,
- correct 404/redirect behavior.

## Stories and SEO

Stories can create additional indexable content, but only if they are genuinely useful and not thin autogenerated spam.

Story pages should:

- have stable URLs,
- identify the merchant,
- link back to the Merchant Page,
- use canonical metadata,
- contain meaningful content,
- avoid mass duplications.

## Merchant lifecycle and SEO

If a merchant closes:

- do not automatically delete a useful historical page,
- mark clearly as closed,
- preserve meaningful information where appropriate,
- show related/nearby alternatives,
- consider redirects only where semantically correct.

The exact SEO implementation must be validated against the real repository.

---

# 28. Stories as a Traffic Engine

Stories should not become a generic Facebook clone.

BiteSite should position Stories as **Local Discovery Content**.

Example content categories:

- new menu,
- hidden local food,
- new restaurant,
- local cafe discovery,
- seasonal item,
- weekend promotion,
- merchant story,
- local food guide,
- community discovery.

## Suggested content mix

This is a working editorial target, not an absolute rule:

- ~70% discovery/value content,
- ~20% merchant promotions,
- ~10% community/user-oriented content.

The intent is to stop Stories becoming a stream of identical advertisements.

---

# 29. Trust System

Reviews are valuable but should not be allowed to overwhelm the core data-trust problem.

Near-term trust indicators should include where available:

- verified merchant,
- verified address,
- verified hours,
- menu confirmed,
- last verification date,
- update source.

Future review capabilities:

- rating,
- review,
- merchant response,
- report review,
- moderation,
- duplicate/fake review detection.

Do not build an enterprise-scale moderation platform before there is enough user-generated content to justify it.

---

# 30. User Reports / Corrections

Users should eventually be able to report:

- closed merchant,
- incorrect address,
- wrong phone,
- wrong hours,
- incorrect menu,
- duplicate listing,
- suspicious/fake listing,
- content issue.

Workflow:

```text
User Report
  ↓
Reason + optional evidence
  ↓
Admin queue
  ↓
Verification
  ↓
Correct / request merchant update / change status
```

Never treat one report as automatic truth.

---

# 31. Abuse / Spam / Security

Self-onboarding and content submission create risk.

Threats:

- fake merchant,
- duplicate merchant,
- competitor claim,
- malicious links,
- copied content,
- spam images,
- oversized uploads,
- scripted submissions,
- fake reports,
- account takeover,
- public/private data leakage.

Expected flow:

```text
Authentication
 ↓
Authorization
 ↓
Input validation
 ↓
Duplicate / abuse checks
 ↓
Draft / pending review
 ↓
Admin QA
 ↓
Publish
```

Engineering checks:

- Supabase RLS,
- server-side validation,
- file validation,
- allowed MIME types,
- upload size limits,
- secure URL handling,
- permission boundaries,
- admin-only actions,
- service-role isolation,
- rate limiting or anti-abuse controls as appropriate,
- audit log for sensitive changes.

---

# 32. Security Principle for Merchant Content

Merchant content submission should never be able to directly change or inject:

- arbitrary HTML,
- script tags,
- unsafe embed code,
- internal admin data,
- arbitrary database identifiers,
- privileged URLs,
- server-side secrets.

Rich text should be sanitized or generated from structured fields.

This is another reason the “Merchant submits facts” model is safer than “Merchant edits a free-form CMS page”.

---

# 32.5 Story ↔ Merchant Lifecycle Interaction

A Story is associated with a Merchant identity, not merely a current “open” state. Merchant closure should therefore not silently destroy Story history.

### Current working rule

- `business_status = PERMANENTLY_CLOSED` does **not** automatically delete or archive all historical Stories.
- The public Merchant Page should clearly communicate that the merchant is closed.
- Existing Stories may remain discoverable if they remain factually useful, but new promotional distribution should normally stop.
- A future editorial/SEO rule may archive specific Stories where continued display would actively mislead users.

**Pending:** final rule for automatically changing Story visibility when Merchant status changes. The repository audit should confirm whether existing relations and queries can support the desired behavior cleanly.

---

# 33. Analytics

Minimum event taxonomy should include:

### Merchant page events

- merchant_view
- menu_view
- gallery_open
- directions_click
- phone_click
- whatsapp_click
- website_click
- story_open
- grabfood_click

### Story submission / editorial events

Consider tracking:

- story_submission_created
- story_submission_channel_used
- story_review_started
- story_needs_changes
- story_approved
- story_rejected
- story_published
- story_reported
- story_revision_created

For merchants, a simple operational metric is also useful:

- pending_submission_count

Initial recommendation: enforce a simple cap such as **one pending Story submission per merchant** to prevent one merchant from flooding the editorial queue.

### Story events

- story_view
- story_open
- story_share where measurable
- merchant_from_story_click
- story_order_click

### Merchant lifecycle events

- merchant_claim_started
- merchant_claim_submitted
- merchant_content_submitted
- merchant_content_published

Important principle:

> **Track actions that demonstrate merchant value.**

This is the foundation for future Merchant Analytics and paid offerings.

---

# 34. Merchant Analytics — Future Value Proposition

Potential dashboard:

```text
Last 30 days

Profile Views       1,285
Menu Views            742
Directions Clicks      98
WhatsApp Clicks        31
Website Clicks         52
GrabFood Clicks        214
Story Views            742
```

Do not claim that clicks equal sales.

Correct wording:

> “214 users clicked your GrabFood link from BiteSite.”

Not:

> “BiteSite generated 214 GrabFood orders.”

Unless verified order data is actually available.

---

# 35. Monetization Direction

Current strategic direction:

> Free listing + paid value-added services / promotion.

Potential future products:

- Assisted Story creation (Malaysia RM20 / Singapore S$10),
- paid editorial/content packages,
- featured placement,
- enhanced visibility,
- merchant analytics tiers,
- future subscription packages,
- premium profile features.

Do not build full payment/billing architecture before the pricing model is validated.

However, the underlying database should be able to record:

- plan/service,
- status,
- start/end date,
- entitlement,
- merchant ID,
- service delivery status.

---

# 36. Paid Promotion and Organic Discovery Separation

If BiteSite eventually sells promotion, it must not accidentally destroy user trust.

The system should distinguish:

```text
ORGANIC_RELEVANCE
POPULARITY
LOCAL_RELEVANCE
OPEN_NOW
PAID_PROMOTION
```

UI must make the commercial relationship understandable where necessary.

Do not quietly manipulate organic ranking simply because a merchant paid.

---

# 37. Malaysia → Singapore Expansion

The architecture should support:

- country,
- region/state,
- city,
- area,
- postcode,
- latitude,
- longitude,
- timezone,
- currency.

Original merchant currency remains authoritative.

Examples:

- MYR
- SGD

Location should influence ranking/personalization, not lock a user into only one country.

The platform should remain one shared system where possible.

---

# 38. Nearby Discovery

Potential location hierarchy:

1. Browser geolocation with explicit user permission.
2. User-selected city/area.
3. Coarse fallback if legitimately available.
4. Generic discovery.

Location is for relevance, not access control.

Do not download every merchant record to the browser and calculate distances client-side at scale. Distance/ranking should be handled server/database-side where practical.

---

# 39. Performance Requirements

BiteSite should feel fast on mobile.

Engineering checklist:

- server/client boundary review,
- caching/ISR where appropriate,
- optimized images,
- lazy loading,
- efficient database queries,
- avoid N+1,
- pagination/top-N queries,
- efficient geo queries,
- small client bundles,
- correct loading/error/empty states.

A visually beautiful Merchant Page that takes too long to load is a product failure.

---

# 40. Recommended High-Level Data Model

This is conceptual only until repository audit.

Potential core entities:

```text
profiles / auth users
merchant
merchant_location
merchant_membership
merchant_claim
merchant_status_history
merchant_hours
merchant_special_hours
menu
menu_category
menu_item
menu_item_variant
media_asset
story
story_submission
story_revision
story_media
content_rights_declaration
content_report
user_report
external_action_link
analytics_event
```

Possible future entities:

```text
promotion
promotion_entitlement
merchant_service
merchant_service_order
review
review_report
```

Avoid implementing all of these blindly. Normalize based on actual requirements.

---

# 41. Recommended Status Design

Use the same split defined in §20. Do not introduce a second, competing status model.

### Platform status

```text
DRAFT / PENDING_REVIEW / PUBLISHED / SUSPENDED / ARCHIVED
```

### Business status

```text
OPEN / TEMPORARILY_CLOSED / MOVED / PERMANENTLY_CLOSED
```

### Ownership

Ownership transfer belongs in membership/ownership history, not in either status enum.

**Schema decision pending repository audit:** `merchant_status_history` must ultimately distinguish whether a historical change affected `platform_status` or `business_status`. The exact ownership-transfer representation (for example, append-only membership history versus a dedicated transfer/history entity) must also be decided during the repository/schema audit. Do not assume `merchant_membership` is already the canonical history table until the audit confirms it.

Do not create dozens of statuses unless each one has distinct business behavior.

---

# 42. Preview Mode

Merchant Preview should show the public-facing page without exposing:

- internal notes,
- verification documents,
- private IDs,
- internal analytics,
- private moderation data.

Preview should be close to actual user view.

Potential validation warnings:

- missing hero image,
- incomplete hours,
- missing price,
- missing contact,
- broken external link,
- duplicate content.

These are helpful but should not become a giant validation framework prematurely.

---

# 43. Content Source and Provenance

## 43.1 Story submission channel provenance

For Story submissions, provenance should capture at minimum:

```text
channel = self_service_form | admin_relayed
submitted_by
submitted_at
rights_confirmed_at
last_reviewed_by
last_reviewed_at
```

This should remain lightweight. A full event-sourcing platform is not required.


BiteSite content can originate from:

- merchant,
- BiteSite admin,
- user report,
- AI assistance,
- external geocoding/directory data,
- imported menu.

At minimum, important editable fields should preserve:

- last updated,
- updated by,
- verification state/source,
- current effective state.

Do not build a full blockchain-like provenance system.

---

# 44. Error Handling and Empty States

Every major user/admin path needs:

- loading state,
- empty state,
- error state,
- retry path,
- human-readable message.

Examples:

Grab link:
> “Ordering link is currently unavailable. Please try again later.”

Story:
> “This Story is no longer available. View the merchant page instead.”

Merchant:
> “This business is marked as permanently closed.”

Do not expose raw database errors to users.

---

# 45. QA / Acceptance Criteria

## 45.1 GrabFood

- Merchant can save valid GrabFood URL.
- Invalid URL is rejected.
- Public button opens correct external page.
- Click event is recorded.
- No payment/order data is stored by BiteSite.
- Broken/dead link can be replaced.
- Mobile behavior is good.

## 45.2A Story submission UX

Acceptance criteria should include:

- self-service merchants can submit through a structured form;
- admin-relayed submissions enter the same review queue;
- one cover image is supported;
- up to three general images are supported;
- upload automatically optimizes images;
- emoji entered by merchant survives end-to-end;
- AI copy assistance is available as part of the editorial flow;
- rights declaration is captured or explicitly recorded for admin-relayed submissions;
- published edits require review before the new public version is visible;
- promotion expiry shows a visible expired/end badge without hiding the Story.

## 45.2 Stories

- Merchant cannot directly publish.
- Merchant can submit content.
- Rights declaration is required.
- Poor-quality image can be rejected/requested again.
- Admin can edit.
- Admin can reject.
- Admin can approve.
- Admin can publish.
- Published Story links to merchant.
- Story can be hidden without destroying the audit trail.
- Reported Story enters review flow.

## 45.3 60-day content cycle

- Due date is calculated correctly.
- Reminder can be triggered.
- Merchant can submit free content.
- Merchant can request assisted content.
- Merchant can become Content Inactive.
- Content Inactive does not delete Merchant Page.
- Re-entering active state is possible after new content/service.

## 45.4 Security

- Merchant cannot edit another merchant.
- Merchant cannot publish Story.
- Merchant cannot access private admin notes.
- Upload limits work.
- RLS blocks unauthorized writes.
- Admin actions require correct authorization.

---

# 46. Testing Strategy

## Unit tests

- hours calculation,
- status transitions,
- URL validation,
- rights-declaration validation,
- content cadence calculation,
- analytics event creation.

## Integration tests

- merchant login → edit,
- merchant submit Story,
- admin review → publish,
- GrabFood click → event,
- claim flow,
- user report → admin queue.

## E2E tests

At least critical flows:

1. Public user → Merchant Page → GrabFood.
2. Merchant → submit Story.
3. Admin → approve/publish Story.
4. Merchant without content → reminder/inactive behavior.
5. Unauthorized merchant → blocked from another merchant.

## Regression tests

After any schema/RLS change, re-run critical Merchant + Story + public-page tests.

---

# 47. Admin Operations Requirements

Admin dashboard should eventually expose:

- merchant queue,
- claim queue,
- content queue,
- reported content,
- reported merchant data,
- broken external links,
- inactive content merchants,
- analytics overview,
- audit history.

Do not make the first admin panel massive. Build the workflows that are actually operationally painful.

---

# 48. Content Moderation Decision Tree

```text
New submission
   ↓
Is rights declaration present?
   ├─ No → Reject / request completion
   └─ Yes
       ↓
Are image(s) usable?
   ├─ No → Needs changes
   └─ Yes
       ↓
Is the information factual/clear?
   ├─ No → Needs changes / verify
   └─ Yes
       ↓
Does it contain risky superiority/medical/misleading claims?
   ├─ Yes → Verify / rewrite / reject
   └─ No
       ↓
Publish
```

This is intentionally human-readable rather than an automated moderation engine.

---

# 48.5 Accessibility, Hint and Assisted-Use System

## Product decision

BiteSite should assume that a meaningful part of the merchant base may be unfamiliar with modern web forms or business software. The product therefore needs to make routine tasks understandable without training sessions.

## Merchant form requirements

Every merchant-facing field that could be misunderstood should reserve a contextual `help_text` / hint region. Examples:

- what the field means,
- what should be entered,
- a short example,
- what not to enter,
- why BiteSite needs the information.

The first version does not need a large design-system project; it does need a consistent form pattern that allows hints to exist without visually overcrowding the UI.

## Recommended interaction pattern

Prefer:

- large tap targets,
- simple words,
- short labels,
- icons where they genuinely clarify meaning,
- step-by-step forms for long workflows,
- examples near difficult fields,
- clear success/error messages.

Avoid assuming that every merchant understands terms such as “canonical URL”, “structured data”, “moderation status”, “slug”, or “metadata”.

## Admin dashboard hint system

The Admin dashboard should also explain what each section is for. This is not only documentation; the UI should make common actions safe enough for a trusted helper to perform recurring tasks without requiring the helper to understand the underlying architecture.

## Acceptance expectation

A non-technical trusted helper should be able to perform a normal Story review/publish task by following the UI hints without needing repository-level knowledge.

---

# 49. Merchant Guidance Page

BiteSite should maintain a simple “How to submit a Story” page.

Explain:

### Please provide

- your own/authorized photos,
- real prices,
- actual dates,
- actual promotions,
- branch/location,
- simple facts.

### Please do not provide

- downloaded third-party photos,
- copied captions/articles,
- watermarked images you do not own,
- fake reviews,
- false “No.1/best/cheapest” claims without substantiation,
- medical claims,
- customer photos without necessary permissions.

### Recommended photo

- clear,
- well lit,
- relevant,
- original or authorized.

This page should reduce support load and improve submission quality.

---

# 50. Content Rights UI — Suggested Merchant Copy

This is product copy for review, **not final legal text**:

> ### Content Rights Confirmation
> Before submitting, please make sure you have the right to use the photos, videos and text you provide.
>
> BiteSite may edit, format and publish approved submissions on BiteSite and BiteSite's official promotional channels.
>
> By submitting this content, you confirm that you have the necessary rights/permissions and that the information provided is accurate.

Final legal language should be reviewed by appropriate Malaysian counsel.

---

# 51. Important Legal / Platform Risk Areas

This section identifies areas for legal/product review; it is not legal advice.

### Copyright

Merchant-supplied images/text may be copyrighted by somebody else. Obtain an explicit rights declaration; maintain a report/takedown flow; do not intentionally republish obvious third-party content.

### Personal data / identifiable persons

Photos showing identifiable people can introduce personal-data/privacy considerations. Obtain appropriate permission/consent where applicable and minimize unnecessary personal data.

### Advertising / misleading statements

Do not blindly publish merchant claims such as “cheapest in Malaysia”, “No.1”, “100% healthy”, etc. Use factual source fields and editorial controls.

### Platform terms

Do not assume BiteSite can automate Facebook/Instagram/Xiaohongshu posting simply because a human can post manually. Third-party APIs, permissions, app review and account types may change. V1 should therefore use a manual publishing process unless and until current platform capabilities are verified.

---

# 52. What Should NOT Be Built Yet

Unless new business evidence changes the decision, postpone:

- direct Grab ordering integration,
- payment checkout inside BiteSite,
- complex staff/role hierarchy,
- full billing engine,
- autonomous AI publishing,
- full plagiarism engine,
- enterprise dispute system,
- full social publishing automation,
- complex recommendation AI,
- microservices.

The current goal is **simple, reliable, measurable and extensible**.

---

# 53. Recommended Implementation Roadmap

## Phase 0 — Repository Audit / Truth Establishment

Before coding new features:

1. inspect repository,
2. inspect Supabase schema,
3. inspect RLS,
4. inspect existing merchant form,
5. inspect existing Story/blog implementation,
6. inspect analytics,
7. inspect image upload pipeline,
8. inspect SEO implementation,
9. inspect tests,
10. produce gap list against this document.

**Deliverable:** Repo Audit Report.

## Phase 1 — Merchant Page Core + GrabFood

Implement/verify:

- external ordering link field,
- merchant UI,
- admin UI,
- validation,
- outbound click analytics,
- error/fallback behavior.

## Phase 2 — Story Submission + Admin Editorial Workflow

Implement:

- merchant submission form,
- rights declarations,
- media upload validation,
- content status machine,
- admin review queue,
- edit/reject/request-change/publish,
- Story revisions/audit trail,
- Merchant-facing status.

## Phase 3 — Content Cadence + Assisted Content Service

Implement:

- 60-day cycle,
- due/overdue/inactive states,
- reminders,
- assisted-service request state,
- manual payment confirmation if needed,
- service tracking.

## Phase 4 — Analytics / Merchant Value

Expand:

- profile views,
- menu views,
- Story views,
- GrabFood clicks,
- directions,
- WhatsApp,
- phone,
- website.

## Phase 5 — SEO / Growth

Implement/verify:

- indexable Story pages,
- landing pages,
- structured data,
- internal links,
- sitemap,
- metadata,
- canonical rules.

## Phase 6 — Trust / Reports / Claim

Improve:

- verification,
- claim,
- user reports,
- merchant corrections,
- trust indicators.

## Phase 7 — Monetization Expansion

Only after usage proves value:

- paid content packages,
- premium visibility,
- analytics packages,
- additional ordering providers.

---

# 54. Open Questions / Pending Decisions

The Halal / pork-free labeling system is intentionally **not an open question for this release**. It is out of current scope; merchant self-onboarding may supply such information if desired, but BiteSite is not building dedicated Halal verification/product logic in this version.

## OQ-001 — Exact Merchant authentication method

Email magic link, email/password, or future phone/WhatsApp.

**Status:** Pending repository/user UX review.

## OQ-002 — Exact Merchant claim verification

Need to balance security and Malaysian small-business friction.

**Status:** Pending.

## OQ-003 — Final external-link model

Dedicated `grab_food_url` vs generic `external_action_links` table.

**Recommendation:** use a generic external-action/order-link model if the current repository can support it cleanly; the public UI may still present a simple GrabFood button in V1.

## OQ-004 — Exact Story deadline/grace period

60 days is the working proposal, not a legally binding service level.

**Still open:** exact clock-start/reset event, reminder timing, and grace duration.

**Status:** Product confirmation pending.

## OQ-004A — Maximum concurrent Story submissions per merchant

Working recommendation: one pending submission at a time.

**Status:** Recommended; confirm during Functional Spec.

## OQ-005 — Exact Assisted Content Service scope

Pricing is already decided:

- Malaysia: RM20
- Singapore: S$10

Still pending: exact deliverables, revision limits, turnaround expectations, and what is included/excluded from the service.

**Status:** Scope pending; pricing decided.

## OQ-006 — Social posting workflow

Manual first. API automation only after platform capability/terms are verified.

**Status:** Decision for V1 = manual.

## OQ-007 — Final content licence wording

Need legal review.

## OQ-008 — Customer/people photo consent workflow

Need product/legal review on the minimum declaration needed.

## OQ-009 — Automated image-quality scoring

Not needed for V1; manual/admin review may be sufficient.

## OQ-010 — Future ordering providers

foodpanda / ShopeeFood / merchant-owned ordering link.

**Status:** Future.

---

# 55. Repository Audit Checklist for Claude

Claude should not just agree with this document. It should challenge it based on code.

### A. Merchant model

- Is there already an owner concept?
- Is Merchant separated from user account?
- Are lifecycle states supported?
- Can one account eventually manage multiple merchants?

### B. Auth/RLS

- Is Supabase Auth in use?
- Are merchant/admin permissions separated?
- Can a merchant access another merchant's data?
- For `admin_relayed` Story submissions, is merchant access based on merchant ownership/membership rather than only `submitted_by`?
- Are sensitive storage paths protected?
- Is there a clear operational field/record for manual Assisted Content payment confirmation or receipt/reference tracking?

### C. Merchant form

- How large is the current form?
- Can the form be extended without becoming a monolith?
- Which fields belong to structured tables?

### D. Stories/blog

- Is an existing Story/blog model already present?
- Can it be extended with moderation states?
- Is author/editor provenance available?
- Does current content support draft/publish?

### E. Media

- Where are images stored?
- Are uploads compressed/resized?
- Does the current upload path avoid Vercel/serverless payload-size failure for real phone photos?
- Is compression client-side, direct-to-storage, or server-side, and is the chosen path appropriate?
- Are file types restricted?
- Can private and public assets be isolated?

### F. SEO

- Are merchant pages indexable?
- Are canonical URLs correct?
- Is JSON-LD correct?
- Are sitemap and robots configured?
- Are Story pages indexable and internally linked?

### G. Analytics

- What is already tracked?
- Where are events stored?
- Can outbound link clicks be recorded cleanly?

### H. Database

- Is the current schema overusing JSONB?
- Are statuses modeled clearly?
- Are soft-delete/archive patterns sensible?

### I. Testing

- Which critical flows already have tests?
- What regression gaps exist?

### J. Performance

- Are pages making unnecessary queries?
- Are images optimized?
- Is server-side filtering/ranking used for nearby search?

---

# 56. Claude Cross-Review Instructions

When CH gives this document to Claude, Claude should return:

## 1. Confirmed

Which decisions are solid and should become formal requirements.

## 2. Challenges

Which ideas create unnecessary complexity, cost or risk.

## 3. Repository Conflicts

Where the current code contradicts or cannot easily support these requirements.

## 4. Missing Requirements

What BiteSite still needs that this document forgot.

## 5. Data Model Review

Recommend minimal schema changes.

## 6. RLS/Security Review

Identify high-risk gaps.

## 7. Stories Workflow Review

Challenge:

- merchant submission,
- admin-only publishing,
- rights declaration,
- content cadence,
- RM20 service,
- inactive state.

## 8. Grab Review

Confirm whether external outbound link architecture is clean and extensible.

## 9. SEO Review

Identify current blockers.

## 10. Final priority order

Return:

- P0 now,
- P1 next,
- P2 later,
- P3 future.

Do not write feature code in the audit response unless explicitly requested.

---

# 57. Comparison / Synchronization Method for CH + Claude

## 57.1 Multi-model review rule

This document is intended to be read by **CH, ChatGPT, Claude, Gemini and Kimi**. They do not have equal authority on every topic.

Use this evidence hierarchy:

1. **Repository / production facts** — highest authority for current implementation.
2. **Explicit CH product decisions** — highest authority for current product intent unless CH changes them.
3. **Official platform/legal documentation** — authority for platform capabilities/terms and legal background.
4. **Assistant recommendations** — useful proposals, never silently converted into decisions.
5. **Speculative future ideas** — remain Open Questions until adopted.

For disagreements, never merge incompatible designs into ambiguous wording. Record the disagreement, evidence, and final decision explicitly.


When both assistants produce specifications, do not blindly merge text.

Create a comparison table with:

| ID | Topic | CH Proposal | Claude Proposal | Evidence | Decision |
|---|---|---|---|---|---|
| GRAB-001 | GrabFood link | External URL | ... | Repo/platform docs | ... |
| STORY-001 | Publishing | Admin only | ... | Product reasoning | ... |
| STORY-002 | Rights | Declaration required | ... | Legal/platform review | ... |
| STORY-003 | Content cycle | 60 days | ... | Business reasoning | ... |
| MON-001 | RM20 service | Assisted content | ... | Business validation | ... |
| SEO-001 | Story indexability | Yes | ... | SEO audit | ... |
| SEC-001 | RLS | Required | ... | Repo audit | ... |

Only after resolving disagreements should the final master spec be updated.

---

# 58. Definition of Done for this Planning Stage

This planning document is considered “ready for implementation” only when:

- product decisions are clearly separated from assumptions,
- repository audit is complete,
- major security/RLS risks are known,
- Story workflow is explicit,
- Grab link workflow is explicit,
- legal-risk points are identified,
- analytics events are defined,
- merchant content rules are explicit,
- P0/P1/P2/P3 priorities are agreed,
- open questions are intentionally listed,
- Claude and CH have reconciled major architectural disagreements.

---

# 59. Change Log

## v3.3 — 17 Sep 2026

Incorporated Gemini independent review findings and CH's explicit decisions:

- Malaysia Assisted Content Service price remains RM20.
- Singapore Assisted Content Service price is S$10 when Singapore is enabled; pricing is market-specific and not derived through FX conversion.
- Halal / pork-free dedicated labeling, verification, ranking/filtering, and special product logic are intentionally out of current scope. Merchant self-onboarding may supply related information if they choose, under normal content review.
- Stories are ordinary promotional/editorial posts. A Story may mention a new menu item, but Story publishing does not create, edit, sync, or mutate Menu System data.
- Added explicit repository-audit checks for `admin_relayed` RLS access, manual assisted-content payment/reference tracking, and image upload/compression architecture.
- Kept Gemini's other findings as audit clarifications rather than turning them into premature product decisions.

## v3.1 — 17 Sep 2026

Second reconciliation pass after reading Claude's sync response again.

- Converted the Story review workflow into a deliberately smaller working recommendation: `DRAFT / PENDING_REVIEW / APPROVED / REJECTED`, with “needs changes” represented through action-required/review notes rather than another long-lived enum.
- Added the v3.1 Sync Decision Register so CH, ChatGPT, Claude, Gemini and Kimi can distinguish decisions from recommendations and open questions quickly.
- Clarified that the 60-day cadence is a product concept while the exact clock-start/reset rule remains OPEN until CH confirms it.
- Clarified that Admin queue labels are operational views, not permission to create an oversized status enum.
- Corrected Appendix B to refer to v3.1 rather than v2.

## v3.0 — 17 Sep 2026

Reconciled with **Claude's Sync Response to BiteSite Master Spec v2.0**.

Added / corrected:

- split `platform_status` and `business_status`; removed `TRANSFERRED` from merchant status;
- split Story public lifecycle from Story submission/review workflow;
- promotion expiry is derived from `end_at` and does not archive/hide content;
- two Story submission channels: `self_service_form` and `admin_relayed`;
- structured Story form support for cover image + up to three general images;
- automatic image compression/optimization requirement;
- end-to-end emoji support test requirement;
- AI copy assistance made a required V1 editorial step;
- accessibility/hint system for merchant and admin UIs;
- max-one-pending-submission working recommendation;
- RM20 service/payment operational tracking;
- published Story edit → draft/review requirement;
- generic external ordering/action link direction;
- preliminary V1 Grab branding recommendation: text CTA first, verify official branding before logo/color use;
- Story ↔ Merchant lifecycle interaction requirements;
- explicit open question for the 60-day cycle clock start/reset event.

## v2.0 — 17 Sep 2026

Major expansion from the earlier future-requirements brief.

Added:

- GrabFood outbound ordering architecture.
- Generic future external ordering direction.
- Story admin-only publishing decision.
- Merchant content submission model.
- Content quality rules.
- Copyright / rights declaration flow.
- Personal-data/photo considerations.
- Misleading advertising claim controls.
- 60-day content participation model.
- Content Inactive status concept.
- RM20 assisted content service.
- Story moderation workflow.
- Story audit trail.
- Manual social distribution in V1.
- Analytics for GrabFood clicks and Story actions.
- Detailed acceptance criteria.
- Implementation roadmap.
- Claude cross-review protocol.
- Synchronization method between CH and Claude.

Existing planning areas retained and consolidated:

- Merchant lifecycle.
- Authentication / claim.
- Menu lifecycle.
- Media scalability.
- Operating hours.
- Preview.
- Malaysia + Singapore.
- Location discovery.
- SEO.
- Monetization.
- Trust / reports.
- Abuse / spam / security.
- Performance.

---

# 60. Final Product Philosophy

BiteSite should not try to win by having the most complicated technology.

It should win by making this journey extremely clean:

```text
SEARCH / SOCIAL / GOOGLE
        ↓
   BiteSite Story
        ↓
   Merchant Page
        ↓
 ┌──────┼────────┐
 ↓      ↓        ↓
Menu   Trust   Actions
              ↓
      GrabFood / Maps /
      WhatsApp / Website
              ↓
        Merchant Value
              ↓
      Merchant Analytics
              ↓
     Paid Services later
              ↓
      More Content/Data
              ↺
```

The most important product lesson is:

> **Do not build a “restaurant website database”. Build a trusted local discovery loop.**

The most important engineering lesson is:

> **Do not over-engineer for imaginary scale. Build simple boundaries now that prevent expensive rewrites later.**

The most important operational lesson is:

> **Merchant supplies facts and authorized assets. BiteSite controls public editorial quality.**

The most important commercial lesson is:

> **Merchants should pay for measurable value, not merely for the privilege of existing on the platform.**

The most important trust lesson is:

> **BiteSite should never publish what it cannot reasonably stand behind.**

---

# 61. v3.3 CH Decision Reconciliation

The following decisions were explicitly confirmed by CH after the Gemini review and are authoritative for v3.3:

- [ ] Malaysia Assisted Content Service = RM20.
- [ ] Singapore Assisted Content Service = S$10 when Singapore is enabled.
- [ ] No live FX conversion is required for V1 service pricing.
- [ ] Dedicated Halal / pork-free product logic is out of current scope; merchant self-onboarding decides whether to supply such information.
- [ ] A Story is ordinary promotional/editorial content.
- [ ] A Story mentioning a new menu item does not create/update/sync the Menu System.
- [ ] Menu updates, if needed, remain a separate explicit Menu workflow.

# 62. Reconciliation Checklist Before Claude Final Confirmation

Claude should confirm that the following confirmed reconciliation changes are now reflected consistently throughout the document:

- [ ] Merchant lifecycle no longer uses a mixed platform/business status enum.
- [ ] Story workflow keeps public Story lifecycle separate from editorial submission workflow.
- [ ] V1 editorial workflow is kept intentionally small; “needs changes” is not required to become a permanent database status.
- [ ] `TRANSFERRED` is not a merchant status; ownership history handles transfer.
- [ ] Story expiry does not equal Story archival.
- [ ] Story submission channel is recorded and both channels converge into one editorial workflow.
- [ ] Story form includes cover image and up to three general images.
- [ ] Image compression/optimization is automatic.
- [ ] Emoji support is explicitly tested end-to-end.
- [ ] AI copy assistance is treated as a required V1 editorial step.
- [ ] Merchant and Admin UIs reserve space for contextual hints.
- [ ] Published Story edits require a new review cycle.
- [ ] A simple pending-submission cap is considered.
- [ ] RM20 service state can be tracked without a full billing platform.
- [ ] Grab V1 remains outbound URL only.
- [ ] Generic external-action model remains a future-proofing direction.
- [ ] Grab official branding is not a technical dependency for V1.
- [ ] 60-day content cycle clock remains explicitly unresolved until CH decides.
- [ ] Story ↔ Merchant lifecycle interaction is explicitly defined or marked pending.

If any old v2/v3.1/v3.2 wording contradicts the above, the latest v3.3 decision wording wins.

---

# Appendix A — External References Used for This Spec

1. GrabMerchant Malaysia — GrabMerchant Portal / Smart Link information:  
   https://merchant.grab.com/en-my/grabacademy/getting-started-with-grabacademy/overview-of-grabmerchant-portal

2. MyIPO — Copyright Act / Copyright resources:  
   https://www.myipo.gov.my/copyright-act/

3. MyIPO — Copyright FAQ:  
   https://www.myipo.gov.my/faq/

4. MyIPO — Copyright licence/assignment notification form (CR-11):  
   https://www.myipo.gov.my/wp-content/uploads/2025/02/myipo-form-cr11-2024-en.pdf

5. Malaysia Personal Data Protection Department — Data Subject Rights:  
   https://www.pdp.gov.my/ppdpv1/en/data-subject-rights/

6. Malaysia Personal Data Protection Code of Practice reference regarding identifiable photographs:  
   https://www.pdp.gov.my/ppdpv1/wp-content/uploads/2024/08/170816-ABM-Code-Of-Practice-CLOcv04-FINAL_CLEAN.pdf

7. Malaysia Trade Descriptions Act material on false/misleading advertising statements:  
   https://www.kpdn.gov.my/images/2024/awam/akta/kpdn/Act%20730.pdf

These sources provide product/legal background only. They are not a substitute for a Malaysian lawyer's review of BiteSite's final Terms, content licence, privacy notice, or merchant agreement.

# Appendix B — Internal Planning Source

This v3.3 document consolidates and extends the prior internal BiteSite future-requirements brief, especially its principles around Merchant lifecycle, Menu lifecycle, authentication/claim, media, hours, preview, Malaysia/Singapore expansion, location discovery, SEO, monetization, trust/reports, security, performance and repository audit.

The prior internal brief should remain available as a historical design input, but this v3.3 should be treated as the stronger working master specification candidate after CH/Claude/Gemini reconciliation.

# Appendix C — “Do Not Assume” List

Do not assume that:

- Grab API access is available or needed.
- Social-media posting APIs are available or desirable.
- Merchant-supplied text is original.
- Merchant-supplied images are licensed.
- Merchant claims are accurate.
- Current repository architecture already supports these requirements.
- A closed merchant should be deleted.
- A user report is automatically true.
- AI can safely publish without review.
- analytics clicks equal completed orders.
- future Singapore requirements should be built as a separate platform.

# Appendix D — Immediate Next Action

**The next action is a final cross-check of v3.3 against CH decisions, followed by repository audit against the confirmed master spec — not blind feature implementation.**

The audit should end with:

1. current-state architecture,
2. schema/RLS assessment,
3. existing Story system assessment,
4. Merchant Page assessment,
5. SEO assessment,
6. analytics assessment,
7. exact P0 implementation gaps,
8. minimal migration plan,
9. testing gaps,
10. a final list of decisions that CH + Claude must resolve before coding.
