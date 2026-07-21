# Cloud Persistence Tasks

## Specification

- [x] Define local-first and local-only fallback behavior.
- [x] Define canonical table write order and partial-write behavior.
- [x] Define minor-unit, transfer, refund, funding, and void mappings.
- [x] Define idempotency key reuse and version-conflict behavior.
- [x] Explicitly defer provider sync, R2 bytes, OCR, and AI.

## Implementation

- [x] Add typed persistence client boundary.
- [x] Persist the authenticated profile before dependent cloud synchronization.
- [x] Add local account, record, draft, meal, media, and source metadata row mappers.
- [x] Queue account references even when no ledger record exists yet.
- [x] Bootstrap normalized merchant references for expense-like records.
- [x] Bootstrap local category aliases with canonical category references.
- [x] Add idempotent account, draft, record, meal, media, and source persistence.
- [x] Add retry classification and bounded backoff policy.
- [x] Re-queue edited, voided, and unresolved-converted local targets by version/hash;
      keep successfully synced meal, media, and scan targets closed.
- [x] Scope edited, voided, and unresolved-converted record actions to their
      record version so a changed row cannot reuse the original create action.
- [x] Preserve tags, ordinary refund links, and audit history in record mapping.
- [x] Preserve transfer-fee ledger links and enqueue fee records before their
      transfer parent.
- [x] Reorder already-persisted pending queues at execution time so an older
      queue cannot process a transfer before its linked fee record.
- [x] Use the canonical generated category parent key for idempotent root-category upserts.
- [x] Map temporary receipt and invoice links to the canonical media-link enum values.
- [x] Add an authenticated atomic RPC for transfer bundles and version checks.
- [x] Connect the adapter to the local queue without changing local-first commit.
- [x] Add authenticated-style integration tests with a mocked Supabase client.

## Verification

- [x] Unit tests for implemented row mappers and currency precision.
- [x] Unit tests for idempotency replay and request-hash mismatch.
- [x] Unit tests for child-write failure and retry classification.
- [x] Integration-style tests with a mocked Supabase client.
- [x] Queue meal, media metadata, and temporary source payload writes independently.
- [x] Verify account-only synchronization closes after the owned reference is returned.
- [x] Verify merchant bootstrap and ledger `merchant_id` mapping.
- [x] Verify category alias deduplication and canonical category mapping.
- [x] Verify profile persistence failure keeps pending work retryable.
- [x] Existing local app, import/export, E2E, and build gates remain green.
- [x] Real RLS integration run against local Supabase with two authenticated
      identities and cross-owner rejection checks.

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

## Production Deployment Rule

Production Supabase schema changes use the repository migration path described
in [Supabase Deployment Policy](../../engineering/supabase-deployment.md).
The GitHub integration watches `main`; new migrations are deployed from
reviewed Git history. The dashboard SQL Editor and direct production
`supabase db push` are break-glass-only paths and must be followed by a tracked
forward-only migration.

## Verification Evidence

The current branch was re-verified after the meal/media/source queue slice,
Supabase configuration hardening, changed-local-target requeue fix, exact
minor-unit aggregation fix, category uniqueness hardening, account-only
reference queue coverage, profile persistence, and category alias bootstrap.
Pending queue execution also reorders legacy transfer items behind linked fee
records. Temporary scan links now use
`receipt-evidence` or `invoice-scan`, matching the canonical enum:

- `npm run test`: 35 files, 226 tests passed.
- `npm run test:coverage`: 84.33% statements, 75.25% branches, 86.68% functions,
  87.03% lines.
- `npm run test:e2e`: 8 browser smoke tests passed.
- `npm run build`: TypeScript and Vite build passed.
- `npm run test:rls`: local Supabase execution passed with two authenticated
  identities, owner-only visibility, cross-owner rejection, and cleanup.
- Mocked authenticated persistence tests continue to cover adapter failure and
  retry behavior that is independent of the local database runtime.
- Remote Supabase migration `0001_schema_core.sql` is applied and matches the
  local migration list.
- Remote Auth and RLS smoke passed with a temporary authenticated user; the
  temporary user and profile row were deleted after verification.
- The frontend remote endpoint is configured only through ignored local
  environment files; no project secret is tracked in Git.

The Supabase configuration boundary also rejects template placeholders and
keeps production deployments fail-closed when cloud authentication is missing.

## Review Evidence

- QA review blocking findings were fixed: partial-bundle retry completion,
  edited-record requeue, missing tags/refund/audit mappings, and transfer
  atomicity.
- Cloud sync hardening also covers version-scoped record idempotency keys and
  transfer-fee dependency ordering, including recovery for already-persisted
  queues; all paths have regression tests.
- Exact minor-unit aggregation prevents decimal report/export drift, and
  successful meal/media/source sync items no longer reopen on a later queue
  pass.
- Responsive review found no blocking overflow or overlap. Non-blocking follow-up
  suggestions are visible status-strip affordance and optional sticky header;
  they remain UI polish outside this persistence slice.
