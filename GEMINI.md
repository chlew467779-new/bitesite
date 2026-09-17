# BiteSite — Gemini Project Instructions

Follow the shared repository rules in `AGENTS.md`.

Read:

- `@AGENTS.md`
- `@README.md`
- `@docs/AI_WORKFLOW.md`
- `@docs/DECISION_LOG.md`
- `@docs/product/BITESITE_MASTER_PRODUCT_DEVELOPMENT_SPEC.md`

## Core rules

- Repository code/schema/config/tests are the engineering source of truth.
- The Master Spec is the product-intent source of truth.
- Do not invent current architecture from planning documents.
- Do not silently change confirmed product decisions.
- Clearly separate Decision, Requirement, Recommendation, Open Question, Pending, and Audit Finding.
- Before modifying auth, RLS, storage, merchant ownership, or media uploads, inspect the actual implementation.
- Stories are promotional/editorial content and do not automatically mutate the Menu System.
- GrabFood V1 is an outbound-link feature, not an order/payment integration.

For audit work, prefer concrete evidence: exact files, schema objects, RLS policies, API routes, tests, and runtime configuration.
