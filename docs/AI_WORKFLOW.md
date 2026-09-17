[AI_WORKFLOW.md](https://github.com/user-attachments/files/32336529/AI_WORKFLOW.md)
# BiteSite — AI Workflow

## 1. Purpose

This document defines how ChatGPT, Claude, Gemini, GitHub Copilot, and other AI agents should collaborate on BiteSite without drifting the product, inventing architecture, or repeatedly rewriting the same planning documents.

## 2. The core rule

**Do not use one document as a substitute for repository inspection.**

The AI must distinguish three different truths:

### Product truth
What BiteSite is intended to do.

Source:
`docs/product/BITESITE_MASTER_PRODUCT_DEVELOPMENT_SPEC.md`

### Engineering truth
What BiteSite actually does today.

Source:
Repository code, schema, RLS, configuration, tests, and observed behavior.

### Decision truth
Which product decisions have already been explicitly approved.

Source:
`docs/DECISION_LOG.md`

## 3. Work classification

Before acting, classify the task:

- Product discussion
- Repository audit
- Bug investigation
- Feature implementation
- Refactor
- Security review
- Performance review
- Documentation
- Testing
- Release/deployment

Do not start coding when the task is actually a product decision that has not been settled.

## 4. The standard workflow

```text
Understand request
      ↓
Find relevant documentation
      ↓
Check Decision Log
      ↓
Read relevant Master Spec section
      ↓
Inspect actual repository
      ↓
Identify conflicts / unknowns
      ↓
Plan the smallest safe change
      ↓
Implement
      ↓
Test / lint / type-check
      ↓
Review security + UX impact
      ↓
Report files changed + evidence
```

## 5. Rules for product ambiguity

If the request introduces a new product behavior that is not DECIDED:

1. Do not silently encode it in code.
2. Mark it as an Open Question or Recommendation.
3. Explain the consequences.
4. Ask CH for a decision when necessary.

If the user explicitly makes the decision, update the Master Spec and Decision Log through the normal document-update process before implementation.

## 6. Rules for repository audit

When auditing the repository, evidence must be concrete.

For each finding, record:

- Area
- Exact file/path/schema object/policy when available
- Current behavior
- Expected behavior
- Gap
- Risk
- Suggested next step
- Whether the issue is product, architecture, security, or implementation

Never say “the code probably uses…” when the repository can be inspected.

## 7. Rules for database/auth/RLS

Any task involving merchant data, Story submissions, ownership, claims, authentication, or admin functions must examine actual authorization boundaries.

In particular check:

- who owns each row;
- how merchant membership is resolved;
- whether `merchant_id` is part of authorization decisions;
- whether `submitted_by` is incorrectly treated as ownership;
- whether Admin/service-role actions bypass intended restrictions;
- cross-merchant reads/writes;
- anonymous/public reads;
- private data exposure.

### Specific Story audit scenario

For `admin_relayed` Story submissions, test the scenario:

```text
Admin creates submission for Merchant A
        ↓
submitted_by = Admin
merchant_id = Merchant A
        ↓
Merchant A logs in
        ↓
Merchant A must be able to see the submission that belongs to Merchant A
```

Do not rely on `submitted_by` alone for merchant access control.

## 8. Storage/media workflow

For every upload feature, identify:

- client-side validation;
- file size limits;
- MIME/type validation;
- compression/resizing location;
- whether upload passes through Vercel/serverless functions;
- direct-to-storage or signed upload options;
- public vs private buckets;
- sensitive documents;
- image variants/thumbnails;
- deletion/lifecycle behavior.

Do not expose business verification documents through public media paths.

## 9. Stories workflow rules

### Merchant submission

Possible channels:

- `self_service_form`
- `admin_relayed`

Both converge into one Story submission/review pipeline.

### Publishing

Merchant does not directly publish in V1.

BiteSite/CH/Admin reviews and publishes.

### Copy

Merchant provides facts/materials. AI may assist with editorial rewriting, but facts must come from Merchant/Admin-provided information and human approval remains required.

### Rights

Merchant must provide the required rights declaration. Admin-relayed submissions must record equivalent confirmation.

### Expired promotion

A Story with `end_at < now()` can display an “expired/ended” indicator, but the Story itself remains `PUBLISHED` and discoverable unless separately archived.

### Menu separation

A Story can mention a new menu item. This does not create/update/sync a Menu System item.

## 10. GrabFood workflow rules

V1:

```text
Merchant Page
    ↓
Order on GrabFood
    ↓
Merchant's GrabFood page
    ↓
User orders on Grab
```

BiteSite does not:

- process Grab orders;
- process Grab payments;
- manage Grab delivery;
- require a Grab API integration for V1.

## 11. Review and moderation

User reports are signals, not automatic truth.

A report should normally become:

```text
Report
  ↓
Reason
  ↓
Admin review
  ↓
Verify / request correction / change status / remove if appropriate
```

Do not automatically delete merchant records based on one report unless an explicitly designed rule requires it.

## 12. Testing workflow

At minimum:

- run existing test suite relevant to the change;
- add regression tests for important behavior;
- run type/lint checks when available;
- test mobile behavior for user-facing flows;
- test unauthorized access for security-sensitive flows;
- test cross-merchant isolation;
- test edge cases around closed/moved merchants, expired Stories, and upload failures when relevant.

## 13. Documentation workflow

When implementation changes architecture or behavior:

- update the relevant technical documentation;
- do not rewrite the entire Master Spec for an implementation detail;
- update Decision Log only when a product decision changes;
- preserve history when useful.

## 14. AI disagreement protocol

If ChatGPT, Claude, Gemini, Copilot, or another AI disagrees:

1. Do not average the opinions.
2. Identify the exact disagreement.
3. Determine whether it is a product decision, technical recommendation, or repository fact.
4. Use repository evidence for engineering questions.
5. Use CH's explicit decision for product choices.
6. Record unresolved disagreement as an Open Question.

## 15. Handoff protocol between AI sessions

When an AI session is near its context/usage limit:

1. Do not start a large new analysis.
2. Produce a concise handoff document.
3. Record source-of-truth files.
4. Record confirmed decisions.
5. Record open questions.
6. Record audit blockers.
7. Record what has already been checked.
8. Start the new session using the files, not the old conversation transcript.

## 16. Definition of done for coding tasks

A task is not “done” merely because code was written.

Done means:

- implementation matches the approved requirement;
- relevant tests pass or a limitation is documented;
- no obvious security regression was introduced;
- important edge cases were considered;
- changed files are known;
- database migrations, environment variables, or deployment actions are documented if required.
