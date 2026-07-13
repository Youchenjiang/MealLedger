# V1 Hardening Tasks

## Implementation

### Task 1: Accounting regressions — Complete

Covered minor-unit parsing, currency precision, transfer legs, fund additions, refunds, adjustments, unresolved expenses, and voided records.

Verification: `npm run test`, `npm run test:coverage`.

### Task 2: Import/export fixtures — Complete

Added clean CSV round-trip fixtures for expense, income, fund addition, transfer, refund, grouping metadata, and media-byte exclusion.

Verification: `npm run test`.

### Task 3: Schema ownership and relationship guards — Complete

Added transfer-detail, transfer-detail deletion, refund-link, transfer-required, and media-target ownership guards. Aligned the R2 thumbnail column with the canonical schema and verified temporary scan media links use canonical receipt/invoice intents.

Verification: schema contract tests and migration equality check. Live RLS remains deferred until cloud-persistence.

### Task 4: Media privacy and cleanup boundary — Complete as a local-only boundary

Verified temporary scan state transitions, invalid upload responses, media-byte exclusion, and explicit local metadata-only warning. Cloud object deletion and signed upload completion are deferred because V1 has no cloud persistence.

Verification: media unit tests, App integration test, and clean-export tests.

### Task 5: Offline and error degradation — Complete

Verified offline local records, failed CSV import isolation, and browser storage failure warning.

Verification: React integration tests and Playwright console smoke.

### Task 6: Documentation and review closeout — Complete

Updated the Capture and App Shell scope notes, recorded the read-only review dispositions, ran the complete gate, and left the branch ready for user review without pushing or opening a PR.

Verification snapshot on 2026-07-13 after the cloud-persistence slice,
invoice-import spike documentation, auth configuration hardening, changed-

- `npm run test`: 209 tests passed across 35 files.
- `npm run test:coverage`: 83.09% statements, 73.51% branches, 84.55% functions, and 84.20% lines.
- `npm run test:e2e`: 6 Playwright tests passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- `git status --short`: clean.

The lower aggregate coverage is expected because later cloud, auth, and
provider-boundary modules are included in the measured source set. It remains
above the V1 hardening gate of 70% statements/functions/lines and 60% branches.

## Third-party Review Evidence

Three read-only reviews were requested before closeout:

| Reviewer | Blocking finding | Disposition |
| --- | --- | --- |
| UX / first-use | Local media queue stored metadata only; storage failures were silent; local-only scope was easy to over-read | Fixed with visible media metadata and storage warnings; scope documented as local-only |
| QA / accounting | Income and fund-addition export mismatch; precision used floating-point arithmetic; relationship constraints were incomplete | Fixed with source round-trip fixtures, minor-unit aggregation, and schema triggers/policies |
| Responsive / privacy | Media links did not validate parent ownership; Edge Function column differed from schema; cloud cleanup was not implemented | Fixed ownership and column mismatch; cloud upload/deletion explicitly deferred |
| Follow-up UX / sync | Draft review had no completion path; failed/conflict sync states lacked a user-facing action; edited synced records could still look synced | Fixed with Continue in Capture, Confirm to ledger, Sync attention with retry, conflict visibility, and local-only status on edits |
| Follow-up QA / sync | Successful meal, media, and scan writes could be reopened when their local status hash changed after sync | Fixed by keeping synced targets closed and adding regression coverage for all three target types |
| Schema / cloud follow-up | Record edits reused create idempotency keys; transfer fees were not linked or ordered before their parent | Fixed with version-scoped action keys, fee-link mapping, dependency ordering, and sync regressions |
| Persisted queue follow-up | An older local queue could still contain a transfer before its linked fee | Fixed by ordering pending items again at sync execution time and adding a persisted-queue regression |

Non-blocking follow-ups remain outside this hardening pass:

- live Supabase RLS integration tests
- durable IndexedDB/SQLite media bytes
- signed GET URL and object deletion workers
- full OCR/manual-takeover and batch grouping workflows
- provider invoice/bank synchronization
