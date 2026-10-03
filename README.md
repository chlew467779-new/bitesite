# BiteSite

Restaurant discovery, restaurant Owner self-service, and reviewed Stories, initially for Malaysia. This README is an engineering orientation, not proof of the current hosted database or deployment state.

## Start here

Inspect the checked-out branch, `git status`, and actual code before working. Read [AGENTS.md](AGENTS.md), [AI workflow](docs/AI_WORKFLOW.md), and the relevant [Decision Log](docs/DECISION_LOG.md) entries. The [Master Spec](docs/product/BITESITE_MASTER_PRODUCT_DEVELOPMENT_SPEC.md) describes product intent; repository code, migrations, tests, and observed behavior establish what is implemented.

## Architecture and source map

Next.js App Router, React, TypeScript and Tailwind CSS; Supabase Auth, Postgres and Storage; Vercel deployment. Versions and verification commands are in [package.json](package.json) and the lockfile.

| Area | Where to inspect |
|---|---|
| Public discovery, restaurant pages, Stories and metadata | `app/`, `app/store/`, `app/stories/`, `app/layouts/`, `components/` |
| Admin and Owner dashboards | `app/admin/`, `app/merchant/` |
| HTTP endpoints and server helpers | `app/api/`, `app/api/_lib/`, `app/api/merchant/_lib/` |
| Public Supabase client and public-column projections | `lib/supabase.ts`, `lib/public-merchant-projection.mjs`, `lib/article-public-projection.mjs` |
| Server-only privileged client | `lib/supabase-admin.ts`; never import it into client code |
| Tables, RLS, grants, RPCs and storage definitions | `supabase/migrations/`; inspect the latest applicable replacement of each function |
| Merchant field contract | `lib/merchant-field-patch-core.mjs`; SQL `private.merchant_field_registry()` and `public.merchant_field_patch()` in the migrations |
| Database checks and recovery scripts | `supabase/tests/`, `supabase/rollback/`; index in [Supabase README](supabase/README.md) |
| Pure/source/route tests and CI | `scripts/`, [CI workflow](.github/workflows/ci.yml) |

Owner access requires an authenticated user and active membership for the selected restaurant. Preserve server authorization, database rechecks, field-level compare-and-set/idempotency, and section Save/Discard/Cancel. Do not restore retired whole-form writes. Stories require review before publication. Public readers must use the granted projections and respect RLS.

Storage buckets: `merchant-media` for public restaurant photos, `story-media` for public Story photos, and **private `menu-photos`** for submitted menu photos. Private photos use authorized server access and signed URLs. Inspect media helpers, migrations and tests before changing upload or cleanup behavior; browser clients must never receive a service-role secret.

`supabase/staging/00_baseline_schema.sql` is a historical, intentionally insecure pre-lockdown fixture, not the current schema to deploy. The synthetic seed and staging-only rollbacks are test/recovery tools. The Supabase index and release history may contain old or abbreviated entries: verify actual files and target state.

Production site errors are automatically recorded for Admin → Site → Site Errors by `instrumentation.ts` and `app/api/_lib/site-errors.ts` (SYNC-070), once its database migration is installed.

## Local development

Use an approved local Supabase stack and local-only credentials, supplied through the agreed environment setup. Do not copy production secrets or commit environment files. Core variable **names** include `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SESSION_SECRET` and `NEXT_PUBLIC_SITE_URL`; feature-specific requirements live in their code/docs.

For an independent checkout, install locked dependencies with `npm ci`, then use `npm run dev`. Existing Windows worktrees may share `node_modules` through junctions; confirm targets before installing dependencies or removing a worktree.

The provisioned Windows local stack uses the **5532x** port range, with the Data/Auth API at `http://127.0.0.1:55321`. This checkout does not track `supabase/config.toml`; confirm other ports in the maintained local-stack configuration rather than guessing.

For the existing Windows test stack, the maintained helper starts Next.js with local Supabase settings and an ephemeral local Admin test login:

```powershell
$env:WT = 'C:\Users\User\Desktop\BiteSite\bitesite-gov'
$env:PORT_DEV = '3414'
node C:\Users\User\Documents\Codex\2026-09-28\tools\dev-local.cjs
```

Use it only when local testing is authorized and that stack is available. It is external to this repository, not a portable bootstrap command. Do not start/reset/restart Docker or Supabase to repair another person's environment without authorization. Stop only the server and browser session you started.

```powershell
npm run verify
```

Verification must pass before submitting a change. Real local/staging HTTP and SQL tests are separate because they need authorized environments and can create test data; inspect their headers before running them. Production `npm run build` is a separate check and may need Google Fonts/network access. A local pass or successful Preview does not prove hosted migrations, RPCs, grants or runtime settings are installed.

## Release and recovery

Work on a scoped branch/worktree, never directly on `main`. Read [release order](docs/RELEASE_ORDER.md), each migration header, its tests, and its rollback before proposing a release. Do not use a historical migration snapshot as current production evidence; match migration names, executed SQL and current function definitions, including any hosted timestamp differences.

Release packets include application SHA/PR, migration or release SQL, dependency order, applicable rollback, SQL assertions/behavior tests, full `npm run verify` evidence and known limits. Prepared Windows release SQL lives under `C:\Users\User\Documents\Codex\2026-10-03\release\`; CH executes the reviewed target-specific commands. File existence is not evidence of execution.

Determine SQL/application order from the actual compatibility contract:

- Required new RPCs, fields or notification kinds normally need SQL first. Follow the reviewed feature's explicit order.
- Restricting existing public grants/projections can require compatible application code first; D1b/D1c headers document that case.
- Either order is acceptable only when the feature explicitly tolerates a missing database capability, such as the menu-photos feature being unavailable until its private bucket exists.
- Shared function/registry replacements have strict dependencies: `release-20261003b-amenities.sql` must run before `release-20261003c-page-style.sql`. Do not replay b after c.

Stop on an error and retain the output. Rollbacks are guarded and generally local/staging-only; inspect application dependencies, data/history effects and the exact script. A production rollback, hosted SQL, resource deletion, merge or deployment needs explicit authorization. Prefer reviewed forward fixes and retain release evidence.

## Collaboration

CH owns product decisions and approvals for hosted or destructive actions. Claude scopes tasks, reviews actual diffs/evidence and prepares PRs/release instructions. ChatGPT implements authorized bounded tasks, verifies them and writes durable reports/handoffs. Follow the current task packet and shared [AGENTS](AGENTS.md)/[AI workflow](docs/AI_WORKFLOW.md) rules instead of treating an old handoff as standing permission.

Report commits/HEAD, changed files, verification results, evidence source, unrun checks and working-tree status. Cleanup starts with an inventory; deletion waits for CH's item-by-item approval. Historical documents remain until that approval.
