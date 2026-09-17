# BiteSite — Claude Project Instructions

This repository follows the shared AI rules in `AGENTS.md`.

Read these before substantial work:

- `@AGENTS.md`
- `@README.md`
- `@docs/AI_WORKFLOW.md`
- `@docs/DECISION_LOG.md`
- `@docs/product/BITESITE_MASTER_PRODUCT_DEVELOPMENT_SPEC.md`

## Claude-specific working rule

Use the repository as the engineering source of truth and the Master Spec as the product-intent source of truth.

Do not:

- rewrite the Master Spec just because you have a better idea;
- silently change a DECIDED product item;
- assume planned architecture exists in code;
- skip repository inspection before coding;
- mark a feature complete without testing it.

When a task is ambiguous, classify the ambiguity as:

- Decision needed
- Recommendation
- Open Question
- Repository finding

For large tasks, first provide a concise implementation plan, then inspect the relevant code, then implement, then validate.

When a task touches database/auth/storage, explicitly inspect the existing schema and RLS before changing application code.

When a task touches Story submissions, pay special attention to `merchant_id`/membership authorization, `admin_relayed`, rights declaration, review states, and the separation between Story content and the Menu System.
