[copilot-instructions.md](https://github.com/user-attachments/files/32336514/copilot-instructions.md)
# BiteSite — GitHub Copilot Repository Instructions

Before changing code:

1. Read `AGENTS.md`.
2. Read the relevant part of `docs/product/BITESITE_MASTER_PRODUCT_DEVELOPMENT_SPEC.md`.
3. Inspect the actual repository implementation before assuming architecture.
4. Use `docs/DECISION_LOG.md` for confirmed product decisions.

Rules:

- Repository reality is the engineering source of truth.
- The Master Spec is the product-intent source of truth.
- Do not silently change product decisions.
- Do not invent tables, routes, APIs, auth flows, or dependencies.
- Prefer the smallest maintainable change that fits existing patterns.
- Validate changes with relevant tests, type checks, and lint where available.
- Security-sensitive work must consider auth, RLS, storage access, ownership boundaries, uploads, and secret handling.
- Merchant Stories are submitted for BiteSite review/publishing in V1; merchants do not directly publish.
- Stories are ordinary promotional/editorial posts and do not mutate Menu System data.
- GrabFood V1 is an outbound URL only.
- When sources conflict, report the conflict instead of silently picking one.
