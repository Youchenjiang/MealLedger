# Cloud Persistence Tasks

## Specification

- [x] Define local-first and local-only fallback behavior.
- [x] Define canonical table write order and partial-write behavior.
- [x] Define minor-unit, transfer, refund, funding, and void mappings.
- [x] Define idempotency key reuse and version-conflict behavior.
- [x] Explicitly defer provider sync, R2 bytes, OCR, and AI.

## Implementation

- [x] Add typed persistence client boundary.
- [x] Add local account, record, draft, and official metadata row mappers.
- [x] Add idempotent account, draft, and record bundle persistence.
- [x] Add retry classification and bounded backoff policy.
- [ ] Connect the adapter to the local queue without changing local-first commit.
- [ ] Add authenticated Supabase integration tests when a test project exists.

## Verification

- [x] Unit tests for implemented row mappers and currency precision.
- [x] Unit tests for idempotency replay and request-hash mismatch.
- [x] Unit tests for child-write failure and retry classification.
- [x] Integration-style tests with a mocked Supabase client.
- [x] Existing local app, import/export, E2E, and build gates remain green.
- [ ] Real RLS integration run is deferred until Supabase CLI/project
      credentials are intentionally enabled.

## Deferred

- [ ] Invoice and statement provider synchronization.
- [ ] R2 upload and media cleanup jobs.
- [ ] Multi-device conflict merge UI.
- [ ] Capacitor/SQLite offline guarantee.

## Current Slice Boundary

The adapter foundation is complete, but it is intentionally not wired into
the App write path yet. That wiring requires a remote-reference bootstrap for
local account/category IDs and a configured authenticated Supabase environment.
Until that work is complete, the product remains local-first and never presents
local records as cloud-synced.
