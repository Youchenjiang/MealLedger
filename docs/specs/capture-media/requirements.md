# Capture Media Requirements

Capture media handles photo and file entry points. It is supporting context for the ledger, not a requirement for accounting records.

## Current V1 Boundary

The current branch implements a local preview: it stores capture metadata and a local upload queue, but it does not persist image bytes to cloud storage. The queue must be presented as local-only metadata until the future cloud-persistence spec is complete. Requirements below that mention cloud upload, permanent retention, object deletion, or late OCR handling are planned behavior, not current V1 acceptance criteria.

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

WHEN the user records a meal on a device with a camera
THE SYSTEM SHALL provide a direct camera action with a live preview for one photo and a separate gallery action for selecting multiple photos.

WHEN the browser cannot access a camera or the user denies permission
THE SYSTEM SHALL explain the failure and keep Choose photos available as the fallback.

WHEN the user adds photos through the camera or gallery action
THE SYSTEM SHALL append them to the same meal instead of replacing previously selected photos.

WHEN the user saves a meal with multiple photos in current V1
THE SYSTEM SHALL create one local meal entry and one local media queue item per photo; it SHALL NOT create multiple meals or an official ledger record.

WHEN the user chooses attach photo
THE SYSTEM SHALL require the user to select or create a target record before the attachment becomes permanent.

WHEN one physical file supports more than one logical link
THE SYSTEM SHALL avoid duplicating file bytes while preserving clear link intent.

## Receipt And Invoice Scan

WHEN the user scans a receipt or invoice
THE SYSTEM SHALL queue its local metadata as temporary media in current V1; cloud upload is deferred.

WHEN OCR or AI succeeds in a future processing workflow
THE SYSTEM SHALL create a draft or suggestion, not an official ledger record.

WHEN OCR or AI fails in a future processing workflow
THE SYSTEM SHALL allow manual takeover and keep any user-entered fields.

WHEN the user confirms the draft in a future processing workflow
THE SYSTEM SHALL create or update official ledger data according to manual/import rules.

WHEN the user confirms or discards the draft in a cloud-backed workflow
THE SYSTEM SHALL delete the raw scan by TTL unless the user explicitly keeps it as attachment or evidence.

WHEN the user explicitly keeps the scan in a cloud-backed workflow
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

WHEN the user attaches a photo to an existing transaction, meal, draft, or source payload in a future media workflow
THE SYSTEM SHALL create a media link with clear `link_intent`.

WHEN the target record is deleted or archived
THE SYSTEM SHALL follow data lifecycle rules and not automatically delete permanent media without confirmation.

## Batch Capture

WHEN the user imports multiple images in a future batch workflow
THE SYSTEM SHALL group them into reviewable draft groups.

WHEN AI/OCR suggests grouping in a future batch workflow
THE SYSTEM SHALL let the user split, merge, reorder, or relabel groups before confirmation.

WHEN the batch exceeds V1 limits
THE SYSTEM SHALL reject the local selection before any processing starts.

## Offline Behavior

WHEN the app is offline
THE SYSTEM SHALL allow local capture metadata queueing when browser storage is available.

WHEN captured media is local-only
THE SYSTEM SHALL show local-only status and warn if it remains unsynced.

WHEN persistent storage is denied
THE SYSTEM SHALL warn that local changes, including media bytes not yet backed up, may be lost.
