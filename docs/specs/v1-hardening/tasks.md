# V1 Hardening Tasks

## Implementation

### Task 1: Accounting regressions — Complete

Covered minor-unit parsing, currency precision, transfer legs, fund additions, refunds, adjustments, unresolved expenses, and voided records.

Verification: `npm run test`, `npm run test:coverage`.

### Task 2: Import/export fixtures — Complete

Added clean CSV round-trip fixtures for expense, income, fund addition, transfer, refund, grouping metadata, and media-byte exclusion.

Verification: `npm run test`.

### Task 3: Schema ownership and relationship guards — Complete

Added transfer-detail, refund-link, transfer-required, and media-target ownership guards. Aligned the R2 thumbnail column with the canonical schema.

Verification: schema contract tests and migration equality check. Live RLS remains deferred until cloud-persistence.

### Task 4: Media privacy and cleanup boundary — Complete as a local-only boundary

Verified temporary scan state transitions, invalid upload responses, media-byte exclusion, and explicit local metadata-only warning. Cloud object deletion and signed upload completion are deferred because V1 has no cloud persistence.

Verification: media unit tests, App integration test, and clean-export tests.

### Task 5: Offline and error degradation — Complete

Verified offline local records, failed CSV import isolation, and browser storage failure warning.

Verification: React integration tests and Playwright console smoke.

### Task 6: Documentation and review closeout — Complete

Updated the Capture and App Shell scope notes, recorded the read-only review dispositions, ran the complete gate, and left the branch ready for user review without pushing or opening a PR.

Verification at hardening close on 2026-07-13, before the later cloud
persistence, invoice spike documentation, and auth configuration follow-up:

- `npm run test`: 159 tests passed across 27 files.
- `npm run test:coverage`: 85.61% statements, 77.10% branches, 85.63% functions, and 86.04% lines.
- `npm run test:e2e`: 6 Playwright tests passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- `git status --short`: clean.

## Third-party Review Evidence

Three read-only reviews were requested before closeout:

| Reviewer | Blocking finding | Disposition |
| --- | --- | --- |
| UX / first-use | Local media queue stored metadata only; storage failures were silent; local-only scope was easy to over-read | Fixed with visible media metadata and storage warnings; scope documented as local-only |
| QA / accounting | Income and fund-addition export mismatch; precision used floating-point arithmetic; relationship constraints were incomplete | Fixed with source round-trip fixtures, minor-unit arithmetic, and schema triggers/policies |
| Responsive / privacy | Media links did not validate parent ownership; Edge Function column differed from schema; cloud cleanup was not implemented | Fixed ownership and column mismatch; cloud upload/deletion explicitly deferred |

Non-blocking follow-ups remain outside this hardening pass:

- live Supabase RLS integration tests
- durable IndexedDB/SQLite media bytes
- signed GET URL and object deletion workers
- full OCR/manual-takeover and batch grouping workflows
- provider invoice/bank synchronization
