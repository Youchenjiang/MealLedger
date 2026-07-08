# MealLedger V1 Privacy Checklist

This document turns privacy and compliance concerns into implementation checklist items. It is not legal advice; a Taiwan Personal Data Protection Act review is still required before public launch.

## Data Inventory

V1 should document which data classes are collected:

- account profile and authentication identifiers
- ledger records
- account names and balances
- categories, tags, and events
- meal entries
- uploaded meal photos and retained attachments
- temporary receipt or invoice scans
- import files and source payloads
- AI/OCR extraction payloads
- audit logs and security events

Each class should define whether it is required, optional, temporary, or user-retained.

## User Rights Features

Before public production use, V1 should provide:

- user data export
- account deletion request path
- deletion status or confirmation
- clear warning for temporary scans versus retained media
- disclosure that local-only PWA data cannot be recovered if the browser deletes it before sync

Account deletion should remove or anonymize personal ledger data, media, temporary files, queued drafts, and external credentials. Operational logs may be retained only when there is a documented security, fraud, or legal basis.

## Deletion Timelines

V1 target timelines:

- temporary scans: delete by TTL after confirmation, discard, or expiry
- temporary AI/OCR payloads: delete or archive by documented TTL
- generated export files: expire after 24 hours
- account deletion: complete normal user data deletion within 30 days unless a legal hold applies
- backups: expire through provider backup retention; disclose that backup deletion is delayed

## Audit Log Retention

Security audit logs default to 180 days for V1 private or early production use.

If a user deletes the account, audit logs should be deleted or anonymized unless retention is required for security investigation, abuse prevention, payment disputes, or law.

Audit logs should avoid storing raw receipt images, full import files, or unnecessary ledger details. Log identifiers and event summaries instead.

## Data Region And Cross-Border Notice

The selected database, object storage, and AI/OCR processing regions must be documented before public launch.

If data is stored or processed outside Taiwan, the product should disclose cross-border storage or processing in privacy-facing copy.

External AI/OCR providers must be reviewed for whether uploaded images or extracted text are retained for training, logging, or abuse monitoring.

## Access And Security Requirements

RLS or equivalent ownership checks are required for every user-owned row.

Signed URL issuance must check media ownership before creating the URL.

Magic link login should have expiry, resend limits, and abuse-rate limits.

External credentials for future invoice or bank sync must be encrypted with application-level protection and must not appear in logs.

Bulk export, account deletion, credential changes, and unusual signed URL activity should create security audit events.

## Privacy Copy Before Launch

Before public launch, the app should have user-facing copy for:

- what data is stored
- what remains local-only before sync
- how temporary receipt or invoice scans are handled
- how retained meal photos or attachments are handled
- how to export data
- how to delete an account
- whether data leaves Taiwan
- whether AI/OCR providers process uploaded content

## Open Legal Review Items

Legal or compliance review should confirm:

- Taiwan Personal Data Protection Act obligations
- account deletion and backup retention wording
- cross-border transfer disclosure
- third-party AI/OCR processor terms
- whether receipt, invoice, or medical spending data needs extra sensitive-data treatment
