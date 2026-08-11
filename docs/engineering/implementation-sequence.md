# V1 Implementation Sequence

This sequence turns the current specs into a practical implementation order. It is not a long-lived release plan; update it when completed work changes the safest next step.

## Principles

- Keep `main` deployable.
- Prefer small PRs that complete one spec task or one vertical slice.
- Implement lower-risk app shell before high-risk ledger persistence.
- Do not implement official invoice or bank provider sync in V1.
- Do not let feature work override accounting, privacy, import/export, or lifecycle specs.

## Sequence Overview

1. App shell — Complete.
2. Schema foundation — Complete.
3. Default taxonomy and onboarding — Complete (optional import entry deferred).
4. Manual ledger — Complete (cloud retry and conflict-resolution boundaries deferred).
5. Capture media — Complete (attachment and batch-review flows deferred).
6. Import/export — Complete.
7. Hardening and release readiness — Complete.
8. Cloud persistence — Complete (provider sync, R2 cleanup, multi-device merge, and native offline deferred).
9. Auth — Complete.
10. Invoice import spike — Deferred until its decision gates pass.
11. Localization — Planned; the spec at
    [docs/specs/localization/](../specs/localization/requirements.md) is
    restored but not started. Implementation must extract the currently
    hardcoded Traditional Chinese UI copy into a `zh-TW` dictionary, add an
    `en-US` fallback, and re-review the spec against the shipped
    hardcoded-Chinese baseline before starting.
12. AI ledger drafts — Complete.

All implementation tracks except the deferred invoice import spike and the
planned localization work are merged into `main`; deferred V2 items are
listed at the end of this document.

## 1. App Shell

Spec:

- [App shell](../specs/app-shell/requirements.md)

Goal:

- Create a usable PWA shell with navigation, empty states, and status placeholders.

Deliverables:

- Vite + React + TypeScript shell.
- Routes for Overview, Ledger, Capture, Meals, Imports, and Settings.
- Responsive navigation.
- Offline/local-only/review placeholders.

Exit criteria:

- `npm run build` passes.
- Browser smoke test passes.
- Console has no errors.
- No real ledger data model is required.

## 2. Schema Foundation

Spec:

- [Schema core](../specs/schema-core/requirements.md)

Goal:

- Define and apply the minimum database foundation for accounts, categories, ledger records, drafts, media metadata, links, audit, and idempotency.

Deliverables:

- Initial migrations.
- RLS policies.
- Seed hook surface.
- Basic TypeScript data types or generated types.

Exit criteria:

- RLS ownership checks are reviewed.
- Idempotency uniqueness exists.
- Soft delete, version, and core indexes exist.
- Provider invoice and statement sync tables remain deferred.

## 3. Default Taxonomy And Onboarding

Specs:

- [Default taxonomy](../specs/default-taxonomy/requirements.md)
- [Onboarding](../specs/onboarding/requirements.md)

Goal:

- Let a new user create a first account, apply seed categories/tags/aliases, and understand initial funds.

Deliverables:

- Default taxonomy seed data.
- First-account setup.
- Initial funds behavior.
- Optional import entry point.
- Local-only/sync guidance copy.

Exit criteria:

- Initial funds do not count as income.
- Default taxonomy can be applied without duplicates.
- New user can complete onboarding and reach Overview.

## 4. Manual Ledger

Spec:

- [Manual ledger](../specs/manual-ledger/requirements.md)

Goal:

- Let the user create the spreadsheet-baseline ledger records without photos, scans, imports, or provider sync.

Deliverables:

- Manual forms for expense, income, transfer, refund, fund addition, adjustment, and unresolved expense.
- Required-field validation.
- Currency precision validation.
- Local-only queued save behavior.
- History suggestions when practical.

Exit criteria:

- Accounting acceptance cases pass.
- Transfers do not affect income/expense totals.
- Fund additions do not count as income.
- Refund and payback behavior matches accounting rules.
- Unresolved expenses count as spending and can later convert.

## 5. Capture Media

Spec:

- [Capture media](../specs/capture-media/requirements.md)

Goal:

- Add photo/file capture intents without compromising clean ledger export or scan privacy.

Deliverables:

- Capture intent UI.
- Temporary scan source behavior.
- Meal photo flow with multiple photos per meal.
- Attachment links.
- Offline media queue placeholders or implementation.

Exit criteria:

- Receipt/invoice scans create drafts, not official records.
- Temporary scans expire or are cleaned after confirmation/discard.
- Meal photos can remain independent from ledger.
- Clean export still has no image bytes.

## 6. Import And Export

Spec:

- [Import export](../specs/import-export/requirements.md)

Goal:

- Migrate spreadsheet data and produce clean exports.

Deliverables:

- CSV import.
- Field mapping.
- Alias mapping and review.
- Duplicate detection.
- Single-table and multi-table export.

Exit criteria:

- UTF-8 and UTF-8 BOM import works.
- Ambiguous old labels enter review.
- Import does not silently overwrite official records.
- Export includes manifest/account summary when ZIP mode is used.
- Export excludes image bytes.

## 7. Hardening And Release Readiness

Specs:

- [Accounting test plan](../testing/accounting-test-plan.md)
- [Privacy checklist](../v1/privacy-checklist.md)
- [PR review checklist](pr-review-checklist.md)

Goal:

- Make V1 safe enough for real personal use.

Deliverables:

- Accounting regression cases.
- RLS/policy verification.
- Import/export fixture checks.
- Privacy deletion/export review.
- Browser smoke tests across desktop/mobile.

Exit criteria:

- Critical accounting cases pass.
- RLS checks pass.
- Export and import fixtures pass.
- Privacy checklist has no launch blockers.
- Known limitations are documented.

## 8. Cloud Persistence

Spec:

- [Cloud persistence](../specs/cloud-persistence/requirements.md)

Goal:

- Persist the local-first domain to Supabase when an authenticated, configured
  client is available while keeping local recording available offline.

Deliverables:

- Typed persistence boundary and local-to-canonical row mappers.
- Idempotent account, record, draft, meal, media metadata, and source payload
  writes.
- Signed private R2 upload for available local image bytes before media metadata
  synchronization.
- Retryable queue state with bounded backoff and visible local-only status.
- Version-conflict result without silent overwrite.

Exit criteria:

- Local-only mode behavior is unchanged.
- Minor-unit, transfer, refund, funding, void, and audit mappings are covered.
- Replayed actions do not create duplicate rows.
- Failed child writes are not reported as fully synced.
- Meal/photo/source links are persisted as metadata only; image bytes remain
  outside Supabase and clean ledger exports.
- R2 object deletion/cleanup, provider invoice sync, bank sync, and multi-device
  merge remain outside this spec.

## 9. Auth

Spec:

- [Auth](../specs/auth/requirements.md)

Status:

- Complete. Merged as pull request #8.

Goal:

- Add account sign-in for cloud persistence without gating the local-first
  workspace.

Deliverables:

- Provider-neutral auth adapter for email/password, password reset, Google,
  and Facebook OAuth.
- Settings > Account surface with session expiry, sign-out, and auth-error
  handling.
- Explicit local-data handoff review before cloud ownership is claimed.
- Password-recovery flow that sets a new password from a recovery session.
- Provider setup guide and ADR 0004.

Exit criteria:

- Local workspace remains the default entry with no sign-in gate.
- Cloud sync stays blocked until the handoff is accepted.
- Provider decision recorded; LINE Login and Magic Link deferred.
- Unit, coverage, E2E, remote persistence, and build gates pass.

## 12. AI Ledger Drafts

Spec:

- [AI ledger drafts](../specs/ai-ledger-drafts/requirements.md)

Goal:

- Let the user record transactions by typing, speaking, or photographing a
  receipt, with AI turning the input into prefilled drafts the user confirms
  before anything becomes an official record.

Deliverables:

- AI capture panel with text, speech, and receipt-photo input paths.
- Provider-neutral AI client supporting the OpenAI and Gemini request shapes.
- `ai-parse` Supabase Edge Function proxy with an auth gate and a 4 MB body
  cap as the production route.
- Draft-suggestion parsing with case-insensitive account/category matching,
  transfer handling, and human-readable issues.
- Confirm-to-record, save-to-review-queue, and apply-to-form flows.

Exit criteria:

- AI output stays draft-only until the user confirms it (ADR 0003).
- Unknown accounts, unknown categories, and unparseable amounts produce
  readable issues instead of records.
- Production calls route through the edge-function proxy; direct provider
  calls remain a local-development fallback only.
- Receipt photos are downscaled before sending and keys stay server-side in
  production.

## Deferred Until V2 Or Spike

- Ministry of Finance cloud invoice sync until the [invoice import
  spike](../specs/invoice-import-spike/requirements.md) passes its decision
  gates.
- Bank or account statement API sync.
- Full media backup export.
- Strong multi-day native offline guarantee with Capacitor/SQLite.
- Full debt tracking.
- Budget limits and envelope budgeting.
- Local/offline AI model.
