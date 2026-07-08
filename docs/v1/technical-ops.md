# MealLedger V1 Technical Operations

This document records V1 operational and technical guardrails that should exist before or during implementation.

## Offline Storage

V1 starts as a PWA. It must request persistent browser storage with `navigator.storage.persist()` when the browser supports it.

The UI must show whether local-only data has been backed up to the cloud. Local-only records and media should be visibly marked.

If persistent storage is denied or unsupported, the app should enter degraded offline mode. Degraded mode still allows quick manual entries, but should warn before large media capture, recommend immediate sync, and keep the local-only badge visible until upload succeeds.

The app should attempt background sync whenever connectivity returns and the user is authenticated. If the browser clears IndexedDB before sync, the app cannot reconstruct lost local-only data; it should explain that only cloud-backed records can be restored.

If local-only data is older than 24 hours, or if the local queue contains more than 20 files or 100 MB, the app should escalate the warning and encourage the user to reconnect.

The code should keep storage behind repository interfaces so a later Capacitor + SQLite/File System shell can replace IndexedDB without rewriting business logic.

## Sync And Concurrency

V1 should use an incrementing `version` column for optimistic concurrency control on editable core records.

Manual offline-created records should sync with stable local ids and idempotency keys that are generated when the local action is queued, not when the network request is sent.

When a conflict is detected, V1 should create a human-readable conflict draft or review task. It should not attempt complex automatic field-by-field merging.

Core records should use soft delete by default. Soft-deleted records are excluded from normal reports and included in audit/recovery views.

## Search And Indexing

Persisted ledger search should be backend-driven. The client may filter the current page and local drafts, but should not load all history to search.

V1 search should support basic Traditional Chinese substring search for merchant, item name, category, source, account, tag, event, and amount/date filters. Zhuyin-aware search is post-V1.

Core database indexes should cover these access paths:

- `user_id, deleted_at, date desc`
- `user_id, deleted_at, account_id, date desc`
- `user_id, deleted_at, category_id, date desc`
- `user_id, deleted_at, kind, date desc`
- normalized merchant or source text
- draft or review status
- link table owner and linked record ids
- unique `user_id, idempotency_key` where applicable

## Media Processing

V1 should compute a content checksum for uploaded files. SHA-256 is the default checksum algorithm.

Checksum calculation can happen client-side when practical and should be verified server-side for permanent media.

V1 should generate thumbnails asynchronously after upload. Suggested default thumbnails are 320 px and 1024 px on the long edge, using WebP or JPEG depending on browser and storage support.

Temporary receipt and invoice scans should use `Cache-Control: no-store` when feasible. Permanent meal photos and attachments may use private cache with short signed URL access.

Signed URLs default to 10 minutes. V1 accepts eventual invalidation for already issued URLs, while preventing new signed URLs after deletion, authorization failure, or retention expiry.

When a signed URL expires while a detail view is open, the client should request a fresh URL if the user still has access. Failed refresh should show a media unavailable state rather than a broken image.

## AI And OCR Boundary

The PWA must not call paid AI/OCR providers directly. AI/OCR calls go through a server boundary such as Supabase Edge Functions.

The provider is an implementation choice, but the interface should record provider id, model or parser id, prompt/schema version when applicable, confidence, and failure reason.

Inline `extraction_payload` should stay small and schema-validated. V1 target maximum is 64 KB. Larger trace payloads should be stored as temporary objects with a pointer and TTL cleanup.

Default scan limits:

- 20 scans per user per day as a soft limit.
- 200 scans per user per month as a soft limit.
- 60 seconds server timeout per scan job.
- Manual takeover option after 20 seconds of visible waiting.

When a user exceeds the soft scan limit, V1 should stop starting new paid scan jobs and guide the user to manual entry. Admin or local-development overrides can be separate from product behavior.

If the user chooses manual takeover while a background OCR job is still running, the returned OCR result must not overwrite fields the user changed. It can appear as a later suggestion with field-level accept actions.

Failures should degrade to manual entry. A failed AI/OCR job should not block saving a draft or official manual record.

## Authentication And Access Security

V1 uses Supabase Auth. Email magic link is the default first login method unless implementation chooses an OAuth provider before coding starts.

Magic links should expire after 15 minutes. Resend should have at least a 60 second cooldown, with per-email and per-IP limits.

RLS must enforce `user_id` ownership on every user table. Object storage signed URL creation must verify the database media row before issuing any URL.

V1 should include IDOR tests for media lookup and signed URL issuance.

External credentials for future invoice or bank sync must be encrypted separately from normal row storage. V1 does not need production government or bank sync, but the schema should not require credentials in plaintext.

## Privacy And Compliance

Before public launch, the project needs a Taiwan Personal Data Protection Act review for data access, export, deletion, and cross-border storage wording.

V1 should provide user data export and account deletion paths before production use beyond private testing.

Supabase and object storage provider encryption at rest are acceptable for ordinary ledger rows and media in V1. External API credentials require additional application-level encryption.

The selected data region must be documented before production launch. If data is not stored in Taiwan, the app must disclose the cross-border storage posture.

## Monitoring And Operations

Schema changes should use forward-only migrations. Destructive migrations require backup and explicit migration notes.

Operational monitoring should track:

- API error rate above 5%.
- Sync failure rate above 5%.
- AI/OCR failure rate above 10%.
- AI/OCR daily cost and call volume.
- Media storage growth and orphan cleanup failures.

V1 alert routing should start simple: developer-facing notifications for private testing, then an operations channel before public launch. Each alert should have an owner, severity, and runbook link before it becomes production-blocking.

Suggested severity defaults:

- Critical: data loss, auth outage, RLS or media access leak.
- High: export failure spike, sync failure spike, AI/OCR cost spike.
- Medium: slow imports, orphan cleanup backlog, thumbnail failures.

Support or repair scripts must leave audit records. Production data should not be manually edited without a tracked repair operation.

Security audit logs should include login, export, delete, credential changes, signed URL issuance, and unusual bulk actions. V1 retention target is 180 days unless storage policy changes.
