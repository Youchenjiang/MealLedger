# MealLedger V1 Data Lifecycle

This document defines deletion, archive, link, and master-data lifecycle rules for V1.

## Link And Cascade Rules

Transactions, meals, media assets, and source payloads are separate entities. Link tables connect them.

V1 does not require production `invoice_records` or `statement_records` tables for official government invoice sync or bank statement sync. Manual scans and manual CSV imports can be represented as draft/source payloads until V2 sync features justify dedicated external-record tables.

Deleting or archiving a transaction removes or hides its link rows from active views, but does not delete the linked meal, source payload, or media asset.

Deleting or archiving a meal removes or hides its link rows from active views, but does not delete linked transactions or media assets.

Many-to-many links are allowed. A transaction can link to multiple meals, and a meal can link to multiple transactions. V1 UI should keep this simple by showing the primary linked item first and secondary links under an expandable relation section.

## Media Lifecycle

Temporary receipt or invoice scan images exist only to help create a draft or official ledger record. If the user confirms the ledger data but does not choose to retain the scan, the original scan should be deleted by TTL cleanup.

Meal photos and user-retained attachments are permanent media until the user deletes them.

When all links to a permanent media asset are removed, the file becomes an orphan candidate. V1 should not automatically hard-delete user-retained permanent media without explicit user confirmation.

When all links to a temporary media asset are removed, the file should be deleted by the temporary-file cleanup job.

If a user chooses to keep a scan after confirmation, the system should move or copy it from temporary storage to permanent storage, update the media record, and queue cleanup of the old temporary object. Failed migration should leave the draft or record usable and surface a repair task.

## Official Record Deletion

Official ledger records can be soft-deleted or voided in V1, but the two states mean different things.

Soft deletion means the user wants to hide or remove a record from normal use. Soft-deleted records are excluded from normal reports and search results by default, but remain available in audit and recovery views.

Void means the record is an official correction artifact. Voided records are excluded from normal totals, remain visible in audit/export views, and should point to the replacing or correcting record when one exists.

Hard deletion is reserved for account deletion, legal privacy deletion, or explicit user actions with a warning.

Undo can restore a recently soft-deleted record when its related master data still exists.

## Account Lifecycle

Accounts with historical official records cannot be hard-deleted in normal V1 flows.

V1 uses one account lifecycle state: `disabled`. Disabled accounts remain visible in history and reports, but are hidden from new-entry selectors by default. The word "archived" is UI copy for the same state unless a later version adds a separate state.

Account renaming updates the current display name. Ledger records should keep stable account ids. V1 may also store an import/display snapshot for audit and export.

Account merging is not a V1 feature. If a setup mistake must be corrected, the user should create a new account and use transfer or adjustment records intentionally.

Account currency cannot be changed after confirmed ledger records exist.

## Category Lifecycle

Categories with historical official records cannot be hard-deleted in normal V1 flows.

Users can disable a category. Disabled categories remain in historical reports and imports, but are hidden from new-entry selectors by default.

Category renaming updates the current reporting name while preserving stable ids. Old names should be kept as aliases for import mapping when useful.

Category merging is post-V1 by default. V1 should prefer aliases and manual recategorization over automatic merge.

If category merge is later added, the default behavior should not rewrite historical transaction `category_id` values silently. It should preserve old category ids, add an audited alias or redirect for future selection, and make report rollups explicit.

## Tags, Events, And Categories

Category means one primary reporting bucket for income or spending.

Tag means one or more lightweight context flags, such as `待還款`, `代墊`, or `報銷`.

Event means a named project, trip, activity, or time-bounded context that can group income, expenses, meals, and media.

`登山` should usually be modeled as an event or tag. Specific purchases inside it can still use categories such as gear, food, transport, medicine, or fees.

V1 events are flat. Event hierarchy, budgets by event, and event templates are post-V1.

Events can be disabled. Disabled events remain visible on historical records but are hidden from new-entry selectors by default.

## Draft And Conflict Lifecycle

Drafts may be deleted by the user before confirmation.

Manual drafts can be kept until the user confirms, deletes, or archives them.

Drafts created by AI/OCR, imports, recurrence, or sync conflicts should keep enough source context for review until the user confirms, ignores, deletes, or the documented TTL expires.

V1 default draft review policy:

- AI/OCR and import drafts remain active for 30 days, then move to archived review unless the user pins them.
- Recurrence reminder drafts remain active until the next cycle plus 7 days, then move to archived review.
- Conflict drafts remain active until resolved or manually archived.
- Archived drafts do not affect balances or official reports.

Conflict records should keep both versions in human-readable form. V1 should prefer creating an independent `conflict` review draft over attempting complex field-by-field merge.

The primary concurrency token is an incrementing `version` integer. `updated_at` is useful for display and sorting, but should not be the only conflict token.
