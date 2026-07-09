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

## Media And Source Payloads

Test media row stores object key but no bytes.

Test media row can store captured time independently from upload time.

Test media checksum uniqueness or duplicate detection behavior is explicit.

Test temporary media can be queried by `expires_at` for cleanup.

Test source payload can store inline JSON under size limit.

Test source payload can point to object storage for larger payloads.

Test draft targeting an existing official record stores target record id.

Test idempotency record stores response data needed to replay a successful request.

## Export Views

Test active ledger export excludes soft-deleted rows.

Test export includes stable ids for linked tags, events, meals, media, and source payloads.

Test export does not include media bytes or base64 data.
