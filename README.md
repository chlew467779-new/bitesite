# BiteSite

BiteSite is a restaurant discovery and merchant value platform, initially focused on Malaysia and designed to remain compatible with future Singapore expansion.

The long-term product loop is:

**Restaurant data → Discovery → Content → User traffic → Merchant actions → Measurable merchant value → Paid services → Better content/data**

## Current planning status

The current product planning baseline is:

**BiteSite Master Product, Architecture & Development Specification v3.3**

File:

`docs/product/BITESITE_MASTER_PRODUCT_DEVELOPMENT_SPEC.md`

v3.3 is the current **Master Sync Candidate**. It is a product/planning source, not proof that the repository already implements every listed feature.

## Important current decisions

- Merchant platform status and business status are separate concepts.
- `TRANSFERRED` is ownership history, not a merchant status.
- GrabFood V1 uses an outbound merchant URL only; BiteSite does not process Grab orders or payments.
- Merchant Stories are submitted to BiteSite; Merchant does not directly publish in V1.
- BiteSite/CH/Admin reviews and publishes Stories.
- A promotion can expire without the Story being archived; the UI can show an expired badge while the Story remains discoverable.
- Story submission supports both self-service and admin-relayed channels that converge into one review pipeline.
- Story publishing does not create or modify Menu System data.
- Malaysia Assisted Content Service: RM20.
- Singapore Assisted Content Service: S$10 when Singapore is enabled.
- Dedicated Halal/pork-free product logic is currently out of scope; merchants may provide such information themselves under normal review rules.

See `docs/DECISION_LOG.md` for the concise decision register.

## AI collaboration files

- `AGENTS.md` — shared rules for AI agents.
- `CLAUDE.md` — Claude-specific project context.
- `GEMINI.md` — Gemini-specific project context.
- `.github/copilot-instructions.md` — GitHub Copilot repository instructions.
- `docs/AI_WORKFLOW.md` — common AI workflow for analysis, coding, review, audit, and handoff.
- `docs/DECISION_LOG.md` — confirmed product decisions and their status.

## Before coding

AI agents must inspect the actual repository before claiming anything is implemented. In particular, inspect the real:

- application code;
- Supabase schema and RLS;
- storage configuration;
- authentication;
- Vercel/runtime configuration;
- tests;
- current Story/blog implementation;
- analytics/tracking implementation.

The repository is the engineering source of truth. The Master Spec is the product-intent source of truth.

## Planned technical baseline

Earlier planning documents describe a likely baseline of Next.js App Router, Tailwind CSS, Supabase, and Vercel. This is a planning assumption until the repository audit confirms the actual stack and configuration.

## Development philosophy

BiteSite should be:

- correct before clever;
- maintainable before over-engineered;
- secure by default;
- mobile-friendly;
- fast enough for real restaurant discovery;
- designed so future expansion is possible without building enterprise complexity prematurely.

Do not turn every future possibility into current code.
