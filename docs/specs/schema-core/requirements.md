# Schema Core Requirements

Schema core defines the minimum V1 data model needed by app shell, manual ledger, future import/export, meals, media, drafts, and sync.

## Scope

This spec covers table responsibilities and required data contracts for:

- profiles
- accounts
- categories
- merchants
- ledger records
- transfer details
- refund links
- tags and events
- meals
- media assets
- source payloads
- drafts
- audit logs
- idempotency keys

This spec does not create migrations yet. It prepares the schema design so implementation can write migrations with fewer product ambiguities.

## Ownership

WHEN a table stores user-owned data
THE SYSTEM SHALL include `user_id` or enforce ownership through a required user-owned parent row.

WHEN a user reads, writes, updates, or deletes user-owned data
THE SYSTEM SHALL enforce ownership through RLS or an equivalent server-side policy.

WHEN a table is shared lookup data
THE SYSTEM SHALL define whether rows are system defaults, user-created rows, or both.

## Core Record Requirements

WHEN the system stores an official ledger record
THE SYSTEM SHALL preserve kind, local date, account, amount, currency, lifecycle status, version, and audit timestamps.

WHEN the record kind is transfer
THE SYSTEM SHALL preserve source account, destination account, source amount, destination amount when needed, and linked fee record when present.

WHEN the record kind is refund
THE SYSTEM SHALL support links to one or more original expense records.

WHEN the record kind is unresolved expense
THE SYSTEM SHALL support day, month, or period time precision.

WHEN a ledger record belongs to one primary event
THE SYSTEM SHALL store that primary event directly on the ledger record.

WHEN a record is soft-deleted
THE SYSTEM SHALL exclude it from active queries by default while preserving audit/recovery data.

WHEN a record is voided
THE SYSTEM SHALL exclude it from normal totals while preserving an audit-visible correction chain.

## Reference Data Requirements

WHEN the user creates an account
THE SYSTEM SHALL store name, currency, account type, disabled state, and sort/display order.

WHEN account currency is set and official ledger records exist
THE SYSTEM SHALL prevent changing the account currency.

WHEN the user creates a category
THE SYSTEM SHALL support parent/child hierarchy, transaction kind scope, aliases, and disabled state.

WHEN categories or accounts are disabled
THE SYSTEM SHALL preserve historical records and hide disabled values from new-entry selectors by default.

## Draft And Source Requirements

WHEN AI/OCR/import creates a suggestion
THE SYSTEM SHALL store it as draft data, not an official ledger record.

WHEN source data comes from scan, spreadsheet row, manual import, or future provider sync
THE SYSTEM SHALL store source context separately from official ledger records.

WHEN a draft is confirmed
THE SYSTEM SHALL create or update official records through an audited action.

WHEN a draft targets an existing record
THE SYSTEM SHALL preserve the target record id for traceability.

## Media Requirements

WHEN the system stores media metadata
THE SYSTEM SHALL store object keys and metadata only, never image bytes.

WHEN the system stores media metadata
THE SYSTEM SHALL preserve captured time when known so media can be sorted independently of upload time.

WHEN one physical media object supports multiple product links
THE SYSTEM SHALL avoid duplicating file bytes.

WHEN a receipt or invoice scan is temporary
THE SYSTEM SHALL support expiry and cleanup metadata.

## Sync And Idempotency Requirements

WHEN a client submits a create or confirm action
THE SYSTEM SHALL support idempotency keys scoped to the user and action.

WHEN an idempotent action succeeds
THE SYSTEM SHALL store enough response data to replay the same result without creating duplicate records.

WHEN editable records are updated
THE SYSTEM SHALL use a version token for optimistic concurrency.

WHEN a sync conflict is detected
THE SYSTEM SHALL preserve both sides in a conflict draft or review task.

## Export Requirements

WHEN exporting the ledger
THE SYSTEM SHALL be able to query active official records without image bytes.

WHEN exporting relationship ids
THE SYSTEM SHALL include stable ids for linked meals, media, tags, events, and source payloads when available.
