# Cloud Persistence Tasks

## Specification

- [x] Define local-first and local-only fallback behavior.
- [x] Define canonical table write order and partial-write behavior.
- [x] Define minor-unit, transfer, refund, funding, and void mappings.
- [x] Define idempotency key reuse and version-conflict behavior.
- [x] Explicitly defer provider sync, R2 bytes, OCR, and AI.

## Implementation

- [x] Add typed persistence client boundary.
- [x] Add local account, record, draft, meal, media, and source metadata row mappers.
- [x] Add idempotent account, draft, record, meal, media, and source persistence.
- [x] Add retry classification and bounded backoff policy.
- [x] Re-queue edited, voided, and unresolved-converted records by version/hash.
- [x] Preserve tags, ordinary refund links, and audit history in record mapping.
- [x] Add an authenticated atomic RPC for transfer bundles and version checks.
- [x] Connect the adapter to the local queue without changing local-first commit.
- [x] Add authenticated-style integration tests with a mocked Supabase client.

## Verification

- [x] Unit tests for implemented row mappers and currency precision.
- [x] Unit tests for idempotency replay and request-hash mismatch.
- [x] Unit tests for child-write failure and retry classification.
- [x] Integration-style tests with a mocked Supabase client.
- [x] Queue meal, media metadata, and temporary source payload writes independently.
- [x] Existing local app, import/export, E2E, and build gates remain green.
- [ ] Real RLS integration run is deferred until Supabase CLI/project
      credentials are intentionally enabled.

## Deferred

- [ ] Invoice and statement provider synchronization.
- [ ] R2 upload and media cleanup jobs.
- [ ] Multi-device conflict merge UI.
- [ ] Capacitor/SQLite offline guarantee.

## Current Slice Boundary

The local-first adapter is wired into the authenticated App path. It persists
canonical ledger/draft rows plus meal, media metadata, and temporary source
payload metadata when Supabase is configured. It never uploads image bytes,
confirms scan drafts, or runs provider synchronization. Existing local data
owned by another authenticated user remains blocked for explicit review rather
than being claimed automatically.

## Verification Evidence

The current branch was verified after the meal/media/source queue slice:

- `npm run test`: 34 files, 192 tests passed.
- `npm run test:coverage`: 83.55% statements, 73.52% branches, 84.53% functions,
  84.90% lines.
- `npm run test:e2e`: 6 browser smoke tests passed.
- `npm run build`: TypeScript and Vite build passed.
- Real Supabase/RLS execution remains environment-gated; mocked authenticated
  persistence tests cover the adapter contract.
