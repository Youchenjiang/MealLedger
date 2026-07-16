# Schema Core Test Plan

Schema tests should protect data ownership, accounting boundaries, and sync safety.

## Ownership And RLS

Test user cannot read another user's accounts.

Test user cannot read another user's ledger records.

Test user cannot create a ledger record for another user.

Test user cannot link their media to another user's record.

Test signed URL issuance fails when media does not belong to the requesting user.

## Ledger Constraints

Test valid expense can be inserted.

Test valid income can be inserted.

Test valid fund addition can be inserted.

Test valid transfer requires transfer details.

Test valid cross-currency transfer stores both source and destination amounts.

Test transfer detail does not duplicate source-side account, amount, or currency fields already stored on the ledger record.

Test valid unresolved expense supports day precision.

Test valid unresolved expense supports period precision.

Test adjustment requires reason.

Test adjustment without a non-blank reason is rejected at the database boundary.

Test a voided record may point to a replacement record owned by the same user,
but cannot point to itself or another user's record.

Test account currency cannot be changed after official records exist.

## Lifecycle

Test soft-deleted ledger record is excluded from active query views.

Test voided ledger record is excluded from normal totals but remains audit-visible.

Test disabled account remains linkable to historical records.

Test disabled category remains linkable to historical records.

Test draft archival does not affect official balances.

## Idempotency And Concurrency

Test duplicate `user_id, idempotency_key` is rejected or returns original result.

Test version mismatch is detectable on update.

Test idempotency key expiry can be queried for cleanup.

Test an expired idempotency key can be reused with a new request hash, while an
unexpired key with a different request hash remains rejected.

Test a completed idempotent bundle stores replay response metadata.

Test completed idempotency rows are not reused as a new action merely because
their cleanup timestamp has passed.

## Media And Source Payloads

Test media row stores object key but no bytes.

Test media row can store captured time independently from upload time.

Test media checksum uniqueness or duplicate detection behavior is explicit.

Test malformed SHA-256 checksums are rejected and a user cannot store two
media assets with the same non-null checksum.

Test temporary media can be queried by `expires_at` for cleanup.

Test temporary media and temporary source payloads cannot be stored without an
expiry timestamp.

Test source payload can store inline JSON under size limit.

Test source payload can point to object storage for larger payloads.

Test draft targeting an existing official record stores target record id.

Test idempotency record stores response data needed to replay a successful request.

## Export Views

Test active ledger export excludes soft-deleted rows.

Test export includes stable ids for linked tags, events, meals, media, and source payloads.

Test export does not include media bytes or base64 data.

## Implemented V1 Coverage

- SQL contract tests assert canonical tables, accounting kinds, minor-unit amounts, transfer/refund boundaries, RLS enablement, idempotency, and cleanup indexes.
- Migration and schema entrypoints are asserted byte-equivalent.
- Domain contract tests run through the standard Vitest suite.
- Live RLS execution is explicitly deferred until Supabase CLI/local services are available.

## Hardening Follow-up

- Database checks now enforce adjustment reasons, replacement-record ownership,
  temporary-media/source expiry, and idempotency expiry lookup.
- The transfer RPC now expires old idempotency rows and stores replay metadata.
- Successful idempotency rows retain replay metadata; only incomplete expired
  rows are eligible for cleanup/reuse.
- Live RLS execution remains an environment-gated verification task, not a
  skipped ownership requirement.
