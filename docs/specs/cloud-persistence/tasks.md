# Cloud Persistence Tasks

## Specification

- [x] Define local-first and local-only fallback behavior.
- [x] Define canonical table write order and partial-write behavior.
- [x] Define minor-unit, transfer, refund, funding, and void mappings.
- [x] Define idempotency key reuse and version-conflict behavior.
- [x] Explicitly defer provider sync, R2 bytes, OCR, and AI.

## Implementation

- [ ] Add typed persistence client boundary.
- [ ] Add local account, record, draft, meal, and metadata row mappers.
- [ ] Add idempotent account and record bundle persistence.
- [ ] Add retry classification and bounded backoff state.
- [ ] Connect the adapter to the local queue without changing local-first commit.
- [ ] Add authenticated Supabase integration tests when a test project exists.

## Verification

- [ ] Unit tests for all row mappers and currency precision.
- [ ] Unit tests for idempotency replay and request-hash mismatch.
- [ ] Unit tests for child-write failure and version conflict.
- [ ] Integration tests with a mocked Supabase client.
- [ ] Existing local app, import/export, E2E, and build gates remain green.
- [ ] Real RLS integration run is deferred until Supabase CLI/project
      credentials are intentionally enabled.

## Deferred

- [ ] Invoice and statement provider synchronization.
- [ ] R2 upload and media cleanup jobs.
- [ ] Multi-device conflict merge UI.
- [ ] Capacitor/SQLite offline guarantee.
