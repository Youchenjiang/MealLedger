# Capture Media Design

## Capture Choices

Capture page choices:

- `手動記帳`
- `掃描發票`
- `掃描收據`
- `紀錄餐點`
- `附加照片`

The first screen should make the user's intent explicit before upload when possible.

## Media Kinds

V1 media concepts:

- temporary receipt scan
- temporary invoice scan
- meal photo
- attachment/evidence

Temporary scans are source inputs. Meal photos and explicit attachments are permanent until the user deletes them.

## Upload Flow

Online flow:

1. User chooses intent.
2. Client requests upload authorization from Edge Function.
3. Edge Function validates ownership and creates metadata row.
4. Client uploads to object storage.
5. Client links media to draft, meal, or target record.

Offline flow:

1. User chooses intent.
2. Client stores local queue item.
3. UI marks item as local-only.
4. When online, upload queue requests authorization and uploads.
5. Idempotency prevents duplicate metadata rows.

## Scan Draft Flow

Receipt and invoice scans create source payloads and drafts.

OCR/AI output can suggest:

- date
- merchant
- item/name
- amount
- category
- duplicate candidates
- ledger link candidates

OCR/AI output cannot create official ledger records without confirmation.

If manual takeover happens before OCR completes, the OCR result returns as optional suggestions only.

## Meal Flow

A meal entry can have:

- meal time
- meal period
- multiple photos
- optional place/merchant
- optional notes
- optional linked ledger records

Meal-to-ledger matching uses candidates and user confirmation.

## Retention

Temporary scans:

- have `expires_at`
- use no-store cache when feasible
- are deleted after confirmation, discard, or TTL
- can be promoted to permanent attachment only by explicit user action

Permanent media:

- stores object key and metadata
- may have thumbnails
- is not included as bytes in clean ledger export

## Boundaries

This spec should not define CSV import behavior.

This spec should not implement full R2 backup export.

This spec should not require local/offline AI models in V1.

## References

- [Product flows](../../product/flows.md)
- [Data lifecycle](../../v1/data-lifecycle.md)
- [Technical operations](../../v1/technical-ops.md)
- [Schema core design](../schema-core/design.md)
