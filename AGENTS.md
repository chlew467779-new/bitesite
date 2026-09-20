# BiteSite — Shared AI Engineering Instructions

**Document role:** Repository-wide AI/agent working rules.

This file is intentionally short enough to remain useful. Product requirements belong in the Master Product Specification, not in this file.

## 1. Source-of-truth hierarchy

Use the following hierarchy:

1. **Repository reality** — actual code, database schema, RLS, tests, runtime configuration, deployment configuration, and observed behavior are the engineering source of truth.
2. **Master Product Specification** — product intent and agreed product decisions:
   `docs/product/BITESITE_MASTER_PRODUCT_DEVELOPMENT_SPEC.md`
3. **Decision Log** — concise index of confirmed product decisions:
   `docs/DECISION_LOG.md`
4. **AI Workflow** — how AI agents should reason and work:
   `docs/AI_WORKFLOW.md`
5. **README** — human-facing project orientation.

If sources conflict, do not silently choose one. Identify the conflict and report it. Repository facts determine what currently exists; the Master Spec determines what the product is intended to become.

## 2. Before changing code

Before implementation:

- Read the relevant part of `docs/product/BITESITE_MASTER_PRODUCT_DEVELOPMENT_SPEC.md`.
- Inspect the actual repository files involved.
- Inspect the actual database schema/RLS/config when the task touches those areas.
- Identify whether the request is a product decision, implementation task, bug fix, refactor, or documentation task.
- Check for existing patterns before introducing a new abstraction.
- Do not assume that planned architecture is already implemented.

## 3. Never invent current architecture

Do not claim that BiteSite uses a specific library, table, API, auth flow, bucket, environment variable, component, or deployment behavior until the repository has been inspected.

Planning documents can say what is intended. Only the repository can establish what is currently implemented.

## 4. Product-decision discipline

Do not silently create or change product decisions.

For an unresolved product question:

- mark it as **OPEN QUESTION** or **RECOMMENDATION**;
- explain the trade-off;
- ask for explicit approval when a code change would commit the product to one option.

Do not turn a suggestion into a requirement just because it sounds reasonable.

## 5. Security and privacy

Security is part of every implementation, not a later phase.

When relevant, inspect:

- authentication boundaries;
- Supabase RLS;
- server/client trust boundaries;
- service-role usage;
- public/private storage separation;
- upload validation;
- authorization by ownership/membership rather than submitted-by identity alone;
- sensitive data exposure;
- admin privileges;
- rate limiting and abuse controls;
- secrets and environment variables.

Never expose secrets in source code or documentation.

## 6. Merchant and Story principles

Current confirmed product principles include:

- Merchant identity is distinct from owner/membership identity.
- Merchant platform status and business status are separate concepts.
- Merchant does not directly publish BiteSite Stories in V1.
- Merchant submits material; BiteSite/CH/Admin reviews and publishes.
- Story expiry of a promotion does not automatically archive the Story.
- Story submission channels converge into one review pipeline.
- Stories are ordinary promotional/editorial posts and do not mutate the Menu System.
- GrabFood V1 is an outbound URL, not an order/payment integration.
- Malaysia Assisted Content Service price is RM20.
- Singapore Assisted Content Service price is S$10 when Singapore is enabled.
- Halal/pork-free dedicated product logic is currently out of scope.

For the complete decision set, read the Master Spec and Decision Log.

## 7. Implementation style

Prefer:

- the smallest change that correctly solves the task;
- existing project conventions;
- explicit types and validation;
- simple relational structures before complex abstractions;
- reversible changes;
- testable functions and components;
- clear naming;
- mobile-first behavior where relevant.

Avoid:

- unnecessary dependencies;
- premature microservices;
- speculative abstractions;
- hidden behavior;
- giant rewrites when a focused change is sufficient.

## 8. Testing

For every code change:

1. Run the most relevant existing tests.
2. Add or update tests for important new behavior or regressions.
3. Run lint/type checks when available.
4. For UI changes, check the relevant mobile and desktop behavior.
5. For auth/RLS/storage changes, explicitly test unauthorized access and cross-merchant isolation.

If tests cannot be run, say exactly why.

The standard local/PR verification command is:

```text
npm run verify
```

Production build verification is separate because Next.js may need network access to fetch configured Google Fonts:

```text
npm run build
```

The repository CI workflow runs verification for every pull request. Vercel Preview remains the production-build check because it has the configured Supabase/Vercel environment variables; GitHub Actions must not receive production secrets just to reproduce that build.

## 9. Change reporting

At the end of a coding task, report:

- what changed;
- files changed;
- tests/validation run;
- known limitations;
- any unresolved questions;
- any migration or deployment action required.

Do not claim something is implemented if it was only planned.

## 10. No automatic product drift

If a requested implementation conflicts with the Master Spec, stop and surface the conflict before silently changing the product.

If the repository makes a planned feature technically impossible or risky, explain the evidence and propose options rather than forcing the design.
