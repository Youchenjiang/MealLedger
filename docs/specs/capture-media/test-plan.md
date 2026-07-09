# Capture Media Test Plan

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
