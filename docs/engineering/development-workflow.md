# Development Workflow

MealLedger uses lightweight agile delivery with risk-driven testing. Work is organized as small PRs against `main`; there is no long-lived `dev` branch.

Medium or high-risk product work should follow the [Spec-Driven Workflow](spec-driven-workflow.md) before implementation. This is required for ledger correctness, import/export, privacy, sync, and cross-module data contracts. PRs should be reviewed with the [PR Review Checklist](pr-review-checklist.md).

## Branch Flow

1. Start from latest `main`.
2. Create a short-lived branch:
   - `feature/<short-name>` for product capability
   - `fix/<short-name>` for bug fixes
   - `docs/<short-name>` for documentation or process
   - `chore/<short-name>` for tooling and maintenance
3. Keep each PR focused on one concern.
4. Rebase on `main` if the branch becomes stale.
5. Merge only after checks pass and review threads are resolved.

## Frontend Stack

- Vite
- React
- TypeScript
- Supabase JavaScript client
- Cloudflare R2 access through Supabase Edge Functions only

## Frontend Commands

```sh
npm install
npm run dev
npm run build
```

Default local app URL:

```text
http://127.0.0.1:5173/
```

## Frontend PR Verification

Every frontend PR must include:

- `npm run build` result
- Browser smoke test result
- Console error check
- Confirmation that generated artifacts are not staged

Smoke test checklist:

- App loads at `http://127.0.0.1:5173/`.
- Main navigation is visible.
- Primary workflow entry point is visible.
- Layout has no obvious overlapping text at desktop and mobile widths.
- Browser console has no errors.

## Risk-Driven Testing

Use stricter tests where mistakes can corrupt money, privacy, or imports.

| Area | Testing expectation |
| --- | --- |
| Ledger amounts and transfers | Acceptance cases before implementation |
| Exports | Automated shape/content checks |
| RLS and auth | Policy tests or SQL verification |
| Invoice import | Fixture-based tests for duplicates and drafts |
| AI/OCR | Schema validation and confirmation-flow tests |
| UI shell | Build plus browser smoke test |

## Generated Artifacts

Do not commit generated or local-only files:

- `node_modules/`
- `dist/`
- `tmp/`
- `*.tsbuildinfo`
- Real `.env` files

Do not solve TypeScript config emission by ignoring files such as `vite.config.js` or `vite.config.d.ts`. Configure the relevant TypeScript project with `noEmit` so those files are not generated.

## App-Shell Pause Rule

If process or tooling rules are missing, pause feature work and land the workflow/process PR first. Preserve any in-progress feature work with a clearly named stash or branch before switching back to `main`.
