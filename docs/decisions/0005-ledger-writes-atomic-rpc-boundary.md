# ADR 0005: All Ledger Record Writes Go Through One Atomic RPC Boundary

## Status

Accepted

## Context

MealLedger syncs local ledger records to Supabase. Until now the write path
was split in two:

- **Client-side sequential upserts** for non-transfer records: the client
  claimed an idempotency key, read the cloud `ledger_records.version` row to
  detect conflicts, upserted the parent row, upserted each child table
  (`refund_links`, `ledger_record_tags`, `audit_events`), then wrote the
  idempotency response.
- **A `security definer` RPC** (`persist_ledger_record_bundle_resolved`) for
  transfer records only, because a transfer is a multi-table money write
  (parent + `transfer_details` + children) that must be all-or-nothing.

This split caused real problems:

- A network drop between the sequential upserts left partial bundles: a
  ledger row without its `transfer_details`, or a claimed idempotency key
  without a response.
- The client-side version check was a select-then-upsert with a TOCTOU
  window: two devices could both pass the check and then both write.
- Idempotency was spread across three separate client calls, so a crash
  mid-sequence left dangling keys that later replays had to guess about.
- The same logic (version conflict, idempotency, expired-key GC) existed in
  two places and drifted; each RPC change forced a full `create or replace`
  rewrite of the function (migrations 0005-0008).

## Decision

Every `ledger_records` write — transfer or not — goes through the single
atomic boundary `persist_ledger_record_bundle_resolved`, a `security definer`
PL/pgSQL function that performs the whole bundle in one database
transaction:

1. Claims or replays the idempotency key (`request_hash`, expiry, response).
2. Locks the parent row with `select ... for update` and rejects stale
   versions (`ME002`).
3. Verifies ownership of every referenced row (`42501` on mismatch).
4. Writes the parent and all children (`transfer_details`, `refund_links`,
   `ledger_record_tags`, `audit_events`) and records the idempotency
   response.

The client-side upsert path for ledger records is removed. `upsert` remains
only for reference and linkage tables that are safe to write with row-level
security: `accounts`, `profiles`, `drafts`, `media_assets`,
`source_payloads`, `meal_entries`, and the various link tables.

The client keeps a read-only pre-flight check of `idempotency_keys` to
short-circuit completed replays and reject hash mismatches early; it never
writes anything itself for ledger records.

## Consequences

Becomes easier:

- One canonical integrity boundary for money rows to audit, test, and reason
  about; no client/server logic drift for version conflict or idempotency.
- Partial writes and TOCTOU version races are impossible by construction.
- `classifyCloudError` already maps the RPC error codes (`ME001`,
  `ME002`, `42501`), so conflict/idempotency/ownership semantics are
  unchanged for the sync queue.

Becomes harder:

- Every record sync now depends on the deployed function; if the function is
  missing or revoked, records are kept local-only with a validation error
  instead of syncing.
- Schema changes to the bundled tables require recreating the function; the
  consolidated definition lives in migration 0010 and must be kept as the
  single active `create or replace`.
- A failed child write surfaces as a single RPC error classified against
  `persist_ledger_record_bundle_resolved` rather than the specific table.

Follow-up work:

- ~~Consolidate the four RPC rewrites (0005-0008) into one clean function.~~
  Done in migration 0010, which folds the 0005-0009 layers into a single
  self-contained definition that no longer delegates to
  `persist_ledger_record_bundle`.
- `supabase/tests/rls.integration.sql` now exercises the consolidated
  function: fresh write and replay, `ME001` hash mismatch, `42501`
  cross-owner rejection, `ME002` version conflict, name resolution, and
  account auto-creation for source and transfer destination accounts.

## Migration notes

- **Deploy order matters**: ship the RPC function (migrations 0005-0010)
  before deploying client builds that route all records through it. Older
  clients writing via upsert remain compatible with the same tables and RLS.
- **Stale account references**: the `_resolved` wrapper resolves stale local
  account ids by account name inside the authenticated user's accounts, and
  migration 0008 may create missing account rows. It strips
  `account_name`/`destination_account_name` before calling the core
  function; the mapper sends these fields on transfer rows only.
- **Replay semantics**: for a claimed-but-incomplete key the RPC resumes the
  write and reports `replayed: true`; for a completed key the client
  pre-flight returns the stored response without calling the RPC. Expired
  claims are deleted and written fresh.
- **Version semantics unchanged**: the RPC accepts `existing in (desired,
  desired - 1)` exactly like the old client check. When `existing ==
  desired` the parent row is not rewritten (it is already present); children
  and the response are still written, which completes interrupted bundles.

## References

- [Cloud persistence requirements](../specs/cloud-persistence/requirements.md)
- [Cloud persistence tasks](../specs/cloud-persistence/tasks.md)
- [Cloud persistence test plan](../specs/cloud-persistence/test-plan.md)
- `src/cloudPersistence/repository.ts`
- `supabase/migrations/0005_secure_ledger_bundle_rpc.sql`
- `supabase/migrations/0006_precise_ledger_bundle_ownership_errors.sql`
- `supabase/migrations/0007_resolve_ledger_account_names.sql`
- `supabase/migrations/0008_create_missing_ledger_accounts.sql`
- `supabase/migrations/0010_consolidate_ledger_bundle_rpc.sql`
