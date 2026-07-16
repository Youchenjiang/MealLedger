# Capture Media Test Plan

## Current V1 Status

Capture currently verifies local metadata and queue behavior. Cloud object upload completion, permanent retention, cleanup jobs, OCR/manual takeover, and batch grouping are future-spec cases and must not be reported as implemented by the current branch.

## Capture Intent

Test Capture page shows manual entry, scan receipt, scan invoice, record meal, and attach photo.

Test scan receipt creates temporary scan intent.

Test scan invoice creates temporary scan intent.

Test record meal creates meal photo intent.

Test attach photo requires target or explicit retain behavior.

## Receipt And Invoice Scan

Test scan creates draft or source payload, not official ledger record.

Test confirming draft creates official ledger data through ledger rules.

Test discarding draft queues temporary scan cleanup.

Test confirming draft without retain queues temporary scan cleanup.

Test retaining scan moves it to permanent media.

Test OCR failure allows manual takeover.

Test late OCR result appears as suggestion and does not overwrite user fields.

## Meal Photos

Test meal can be created with meal time only.

Test photo timestamp can suggest meal time.

Test one meal can link multiple photos.

Test meal can remain unlinked from ledger.

Test meal-to-ledger candidate does not create confirmed link until user confirms.

## Attachments And Links

Test one media asset can link to more than one target without duplicating bytes.

Test media link stores link intent.

Test deleting transaction removes active link but not permanent media.

Test clean ledger export contains media ids but no image bytes.

## Batch Capture

Test batch over file-count limit is blocked before upload.

Test batch over size limit is blocked before upload.

Test user can split suggested group.

Test user can merge suggested groups.

Test user can reorder or relabel draft groups.

## Offline

Test offline capture creates local-only queue item.

Test local-only media warning is visible.

Test persistent-storage denied state warns before large media capture.

Test queued media sync preserves idempotency and does not duplicate metadata.

## Implemented V1 Coverage

- `src/captureMedia/intents.test.ts` verifies all five entry intents.
- `src/captureMedia/meals.test.ts` verifies time-required meals, multiple photo links, and optional transaction links.
- `src/captureMedia/media.test.ts` verifies temporary, retained, discarded, and 24-hour expired scan states.
- `src/captureMedia/upload.test.ts` verifies 20-file/100 MB limits, local queue metadata, and the signed upload boundary response.
- `src/App.test.tsx` verifies meal and scan UI flows never create official ledger records.
- `tests/e2e/app-shell.spec.ts` verifies desktop/mobile browser flows and console cleanliness.

## V1 Boundary

The V1 implementation stores source metadata and local queue state only. It does not run OCR, write provider invoice data, or expose a permanent public media URL. Those cases remain follow-up specs.
