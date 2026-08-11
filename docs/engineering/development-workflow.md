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
3. Keep every commit atomic and make each PR one independently deliverable
   increment (see [Commit and PR Granularity](#commit-and-pr-granularity)).
4. Rebase on `main` if the branch becomes stale.
5. Merge only after checks pass and review threads are resolved.

## Commit and PR Granularity

Granularity lives at two levels:

- **Commit — the atomic unit.** One commit makes exactly one logical change
  (one concern). Unrelated changes belong in separate commits; the local
  hook's atomic-commit nudge suggests a split when staged files span
  unrelated areas (see [commit-policy.mjs](../../scripts/commit-policy.mjs)).
- **PR — the deliverable unit.** A PR is the smallest increment that can be
  reviewed, merged, and reverted on its own: one vertical slice, feature,
  fix, or coherent docs change. It contains one or more atomic commits that
  together deliver that increment.

Do not ship one PR per commit just because the commits are atomic. When
several atomic commits belong to the same deliverable (for example three
ADRs plus their index update), group them in one PR. Split a PR only when it
is too large to review in one pass or when its parts can ship independently.
A one-commit PR is fine when that commit is itself a complete deliverable.

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

Ports are pinned in `package.json` scripts (single source of truth):

| Script | URL |
| --- | --- |
| `npm run dev` | `http://127.0.0.1:4173/` |
| `npm run dev:5200` (auth review server) | `http://127.0.0.1:5200/` |
| `npm run dev:e2e` (Playwright server) | `http://127.0.0.1:4174/` |
| `npm run preview` | `http://127.0.0.1:4173/` |

Default local app URL: `http://127.0.0.1:4173/`.

## Frontend PR Verification

Every frontend PR must include:

- `npm run build` result
- Browser smoke test result
- Console error check
- Confirmation that generated artifacts are not staged

Smoke test checklist:

- App loads at `http://127.0.0.1:4173/`.
- Main navigation is visible.
- Primary workflow entry point is visible.
- Layout has no obvious overlapping text at desktop and mobile widths.
- Browser console has no errors.

## Risk-Driven Testing

Use stricter tests where mistakes can corrupt money, privacy, or imports. The
required evidence per change area is defined in exactly one place — the
[Testing Policy](testing-policy.md). Keep the mapping out of this file so the
rules cannot drift.

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
