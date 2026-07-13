# V1 Hardening Test Plan

## Required Gates

Run sequentially before the hardening closeout commit:

```text
npm run test
npm run test:coverage
npm run test:e2e
npm run build
git diff --check
git status --short
```

Do not run Vitest and coverage concurrently because both use the same temporary coverage output.

## Unit Tests

- Currency precision and minor-unit parsing.
- Exact decimal aggregation without floating-point drift.
- Required fields for every ledger kind.
- Transfer source/destination amounts and currencies.
- Refund/payback link requirements.
- Temporary scan retention, discard, expiry, and malformed upload response handling.
- CSV row validation and clean export serialization.

## React Integration Tests

- Offline and online status transitions.
- Local-only record visibility.
- Failed CSV import leaves records unchanged.
- Local browser storage failure is visible.
- Meal photo queue is clearly metadata-only and does not create a ledger record.
- Draft, record, and media state remain separated.

## Browser Smoke

Playwright verifies signed-out entry, workspace navigation, manual capture to local ledger flow, desktop and mobile navigation without document-level horizontal overflow, no console/page errors, and no clean export containing media bytes.

## Static Schema Checks

The schema contract test verifies migration equality, required tables, accounting kinds, currency immutability, idempotency, transfer/refund triggers, media target ownership, cleanup indexes, and RLS policy declarations. A live RLS run is intentionally deferred until Supabase local/cloud persistence is enabled.

## Known Limits

V1 hardening cannot prove cloud object deletion or live signed-URL revocation because no cloud upload worker is enabled. It must therefore verify that the UI and docs do not claim those behaviors are already available.
