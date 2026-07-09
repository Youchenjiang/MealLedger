# PR Review Checklist

Use this checklist to keep MealLedger PR reviews focused. The goal is to catch ledger, privacy, import/export, sync, and UX regressions without restarting product brainstorming in every review.

## Review Scope

Every PR should state:

- what user problem or engineering problem it solves
- which spec or task it implements
- what files or modules are intentionally in scope
- what is explicitly out of scope
- how it was verified

If a PR implements a feature spec, the PR should link to the relevant `docs/specs/<feature-name>/` folder and list completed tasks.

If a PR changes behavior that conflicts with a spec, update the spec first or in the same PR.

## Required Checks For All PRs

- The branch is focused on one concern.
- Generated artifacts are not staged.
- New dependencies are justified.
- Existing user data assumptions are not silently changed.
- User-facing text is clear and consistent with ledger-first positioning.
- Documentation links still point to valid files.
- Review threads from prior rounds are resolved before merge.

## Accounting Checks

Apply when a PR touches ledger records, accounts, categories, reports, forms, imports, exports, sync, or schema.

- Transfers do not count as income or expense.
- Fund additions change balance but do not count as earned income.
- Refunds are negative spending and do not double-count as income.
- Excess refund amounts are explicitly classified.
- Adjustments affect balances but stay out of income and expense totals.
- Unresolved expenses count as spending under a visible placeholder.
- Account currency is not changed after confirmed records exist.
- Multi-currency reports do not directly sum unrelated currencies.
- Amounts use currency precision and avoid floating-point drift.

## Import And Export Checks

Apply when a PR touches import, export, CSV parsing, duplicate detection, source payloads, or file generation.

- CSV import supports UTF-8 and UTF-8 with BOM.
- Imported dates normalize predictably.
- Legacy labels such as `特殊`, `0`, and `?` enter review.
- Duplicate detection does not silently overwrite official records.
- Import retries use idempotency.
- Export excludes image bytes and base64 data.
- Multi-table ZIP files include manifest and account summary when relevant.
- Exported totals reconcile by account and currency.

## Privacy And Media Checks

Apply when a PR touches media, object storage, signed URLs, auth, export, account deletion, or logs.

- Media object bytes are not stored in Postgres.
- Signed URL creation checks ownership.
- Temporary receipt/invoice scans have expiry or cleanup behavior.
- Retained media requires explicit user intent.
- Clean ledger export does not include media bytes.
- Logs do not store raw receipt images or unnecessary ledger details.
- Account deletion or privacy behavior follows the privacy checklist.

## Sync And Offline Checks

Apply when a PR touches IndexedDB, queued actions, Supabase writes, idempotency, conflict handling, or offline UI.

- Local-only data is visibly marked.
- Persistent-storage denial has a clear degraded-mode behavior.
- Queued creates keep stable idempotency keys across retries.
- Version conflicts do not silently overwrite user edits.
- Conflict UI shows human-readable summaries, not raw JSON.
- Background AI/OCR results do not overwrite user-edited fields.

## UI And Accessibility Checks

Apply to frontend PRs.

- `npm run build` passes.
- Browser smoke test passes.
- Console has no errors.
- Desktop layout has no overlapping text.
- Mobile layout has no overlapping text.
- Primary actions use clear controls and labels.
- Buttons and icon buttons have accessible names.
- Empty states do not imply photos are required for ledger use.
- Operational tools are quiet and scannable, not marketing-style landing pages.

## Test Expectations By Risk

| Risk area | Expected evidence |
| --- | --- |
| Ledger math | Acceptance tests or explicit manual cases |
| Schema/RLS | SQL verification, policy tests, or migration review |
| Import/export | Fixture-based tests or generated-file inspection |
| Media/privacy | Ownership, retention, and export exclusion checks |
| UI shell | Build plus browser smoke test |
| Docs-only | Link check or reviewer walkthrough |

## When To Block A PR

Block merge when:

- accounting totals can become wrong
- user data can leak across accounts
- image bytes enter clean ledger export
- import can overwrite official records silently
- sync can silently lose user edits
- a required spec is missing for high-risk work
- verification evidence is missing for the touched risk area

Do not block merge only because a future feature is not implemented, unless the PR claims it is implemented or makes later implementation harder.

## Suggested Review Prompt

Use this prompt for external reviewers:

```text
Please review only the changed files and the linked spec.
Focus on whether the PR satisfies the spec, preserves accounting correctness,
does not weaken privacy/export guarantees, and has enough verification evidence.
Please avoid proposing new product scope unless it blocks the current behavior.
```
