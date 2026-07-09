# Capture Media Requirements

Capture media handles photo and file entry points. It is supporting context for the ledger, not a requirement for accounting records.

## Scope

This spec covers:

- capture intent selection
- receipt or invoice scan
- meal photo capture
- attachment capture
- batch image import
- temporary scan retention
- media links
- AI/OCR draft boundaries

This spec does not cover manual ledger forms, CSV import, official provider invoice sync, bank statement sync, or full media backup export.

## Capture Intent

WHEN the user opens Capture
THE SYSTEM SHALL let the user choose manual entry, scan receipt, scan invoice, record meal, or attach photo.

WHEN the user chooses scan receipt or scan invoice
THE SYSTEM SHALL treat the image as a temporary ledger-source input by default.

WHEN the user chooses record meal
THE SYSTEM SHALL treat the image as a meal photo and allow more than one photo per meal.

WHEN the user chooses attach photo
THE SYSTEM SHALL require the user to select or create a target record before the attachment becomes permanent.

WHEN one physical file supports more than one logical link
THE SYSTEM SHALL avoid duplicating file bytes while preserving clear link intent.

## Receipt And Invoice Scan

WHEN the user scans a receipt or invoice
THE SYSTEM SHALL upload or queue it as temporary media.

WHEN OCR or AI succeeds
THE SYSTEM SHALL create a draft or suggestion, not an official ledger record.

WHEN OCR or AI fails
THE SYSTEM SHALL allow manual takeover and keep any user-entered fields.

WHEN the user confirms the draft
THE SYSTEM SHALL create or update official ledger data according to manual/import rules.

WHEN the user confirms or discards the draft
THE SYSTEM SHALL delete the raw scan by TTL unless the user explicitly keeps it as attachment or evidence.

WHEN the user explicitly keeps the scan
THE SYSTEM SHALL move it to permanent media and show privacy/storage implications.

## Meal Photo

WHEN the user records a meal
THE SYSTEM SHALL require meal time at minimum.

WHEN the user starts from a photo
THE SYSTEM SHALL suggest meal time from photo timestamp when available.

WHEN the user adds multiple photos
THE SYSTEM SHALL allow linking multiple photos to one meal.

WHEN the system suggests ledger matches for a meal
THE SYSTEM SHALL show candidates without creating official links until user confirmation.

## Attachment

WHEN the user attaches a photo to an existing transaction, meal, draft, or source payload
THE SYSTEM SHALL create a media link with clear `link_intent`.

WHEN the target record is deleted or archived
THE SYSTEM SHALL follow data lifecycle rules and not automatically delete permanent media without confirmation.

## Batch Capture

WHEN the user imports multiple images
THE SYSTEM SHALL group them into reviewable draft groups.

WHEN AI/OCR suggests grouping
THE SYSTEM SHALL let the user split, merge, reorder, or relabel groups before confirmation.

WHEN the batch exceeds V1 limits
THE SYSTEM SHALL ask the user to split the batch before expensive processing starts.

## Offline Behavior

WHEN the app is offline
THE SYSTEM SHALL allow local capture queueing when browser storage is available.

WHEN captured media is local-only
THE SYSTEM SHALL show local-only status and warn if it remains unsynced.

WHEN persistent storage is denied
THE SYSTEM SHALL warn before large media capture.
