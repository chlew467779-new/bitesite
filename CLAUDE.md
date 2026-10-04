# BiteSite — Claude Project Instructions

## Every session starts here (automatic — CH does not need to ask)

1. Read `C:\Users\User\Documents\Codex\AI_EFFICIENCY_RULES.md` (work rules + self-improvement log; mind the 5 newest log entries).
2. Read `C:\Users\User\Documents\Codex\HANDOFF_LATEST.md`, then `C:\Users\User\Documents\Codex\BITESITE_WORK_QUEUE.md`, and continue the queue without waiting for CH.
3. Before stopping (or at ~20% quota): add 1–3 lessons to the log in `AI_EFFICIENCY_RULES.md` and update `HANDOFF_LATEST.md`.

These files live outside the repository (shared with ChatGPT and CH). If they are missing, say so and continue with the rules below.

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
