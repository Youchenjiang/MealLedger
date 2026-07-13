# Backend Architecture

MealLedger separates structured financial records from large media files. The backend is designed around clear ownership boundaries so ledger exports stay small, media storage can grow independently, and future invoice providers can be swapped without rewriting the core ledger.

## Backend Components

| Component | Technology | Responsibility |
| --- | --- | --- |
| Identity and app API | Supabase Auth + Supabase client | User identity, session handling, and authenticated reads/writes to app tables |
| Structured database | Supabase PostgreSQL | Canonical ledger records, accounts, meals, media metadata, source payloads, drafts, links, exports, and RLS |
| Media object storage | Cloudflare R2 | Original meal photos, receipt images, thumbnails, and future media backups |
| Server-side integration layer | Supabase Edge Functions | R2 signed URLs, invoice import jobs, AI/OCR calls, provider adapters, and secrets handling |
| AI provider layer | Edge Function adapters | OCR, natural-language parsing, transaction suggestions, and anomaly drafts |
| Official invoice provider | Ministry of Finance e-invoice service adapter | Future scheduled invoice synchronization and invoice-to-transaction draft generation, only after the invoice spike gates pass |

## Storage Boundaries

### Supabase PostgreSQL

Supabase PostgreSQL is the source of truth for structured data:

- `accounts`, `categories`, `merchants`, `ledger_records`
- `meal_entries`, `media_links`, `meal_transaction_links`
- `media_assets` metadata only, never image bytes
- `source_payloads` and `drafts` for scan, import, and future AI/OCR output
- `audit_events` and `idempotency_keys`
- future invoice tables: `invoice_import_accounts`, `invoice_import_runs`, `invoice_records`, `invoice_line_items`
- export adapters or views built over the canonical rows; V1 does not require a `ledger_export` view

PostgreSQL owns permissions through RLS. Every user-owned table must include `user_id` or be reachable through a user-owned parent row.

### Cloudflare R2

Cloudflare R2 stores large binary objects:

- original meal photos
- receipt photos
- thumbnails
- optional full media backup bundles

R2 object keys are referenced from `media_assets`. Ledger exports include media IDs and object keys only when needed; they never include image bytes or base64 data.

### Edge Functions

Edge Functions are the only place that may hold service-role keys, R2 credentials, AI keys, or invoice-provider credentials.

Frontend code may call Edge Functions but must not directly access R2 credentials or service-role Supabase keys.

### Official Invoice Provider Boundary

The official invoice integration is deferred behind the [invoice import
spike](../specs/invoice-import-spike/requirements.md). An adapter may not be
implemented merely because the API exposes invoice fields. Before production
access, the project must confirm developer eligibility, required security
evidence, user consent and six-month re-consent, deletion/stop-use handling,
required cloud-invoice donation, retention, and data-location disclosures.

Provider credentials and carrier validation secrets belong only in the
server-side integration boundary. They are never Supabase client settings,
PWA environment variables, local drafts, or ledger fields. The adapter must
assume scheduled pull until an official push method is documented, and it must
keep imported provider snapshots at the source/draft boundary until explicit
user confirmation.

## Data Flow

### Manual Ledger Entry

1. Frontend commits a user-confirmed local ledger record before the cloud adapter attempts a Supabase write.
2. RLS ensures the row belongs to the authenticated user.
3. The export adapter reads canonical ledger, account, reference, and link rows.
4. No media object is involved unless the ledger record is linked to a meal or receipt.

### Meal Photo Upload

1. Frontend calls `create-r2-upload-url`.
2. Edge Function validates the user and request.
3. Edge Function creates a `media_assets` metadata row and returns a short-lived R2 PUT URL.
4. Frontend uploads the image directly to R2.
5. Frontend creates or updates `meal_entries` and `media_links` with `target_type = 'meal'`.
6. A later confirmation or cleanup workflow should reconcile abandoned metadata rows if the browser upload fails.

### Meal-to-Transaction Matching

1. A meal has time, optional merchant, and linked media.
2. A future candidate-query service searches nearby expense rows in `ledger_records`.
3. The UI shows candidates and confidence.
4. User confirmation creates `meal_transaction_links`.
5. Confirmed links make photo-to-ledger and ledger-to-photo navigation possible.

### Taiwan Cloud Invoice Import

1. A separately approved server-side adapter authenticates with the official
   invoice provider after all spike gates pass.
2. Scheduled sync writes an `invoice_import_runs` row and records consent,
   authorization, and provider status transitions.
3. Imported invoice headers and optional line items are stored as immutable
   provider snapshots.
4. Import logic creates source payloads and transaction drafts, not official
   ledger transactions.
5. User confirmation converts a draft into a `ledger_records` row and optional
   links to meals/media.
6. Any future push entry point must be explicitly supported by the provider;
   it cannot be inferred from the polling API.

### AI/OCR Collaboration

1. Frontend or scheduled job submits media or text to an Edge Function.
2. Edge Function calls an AI/OCR provider.
3. Parsed output is saved at the `source_payloads`/`drafts` boundary.
4. AI-generated rows remain drafts until the user confirms them.
5. Confirmed drafts create or update official ledger/meal/link records.

## Export and Backup

Daily ledger export reads structured canonical rows through the export adapter:

- ledger records
- accounts
- categories
- merchants
- linked meal IDs
- linked media IDs

Media backup is separate:

- R2 object list/export for originals and thumbnails
- optional mapping export from `media_assets`

This separation keeps accounting exports small and portable while allowing media storage to scale independently.

## Provider Replacement Rules

- Replace media storage by changing `storage_provider`, bucket, and object-key handling behind `media_assets`.
- Replace invoice providers by adding a new adapter that writes the same
  provider-neutral source/draft boundary and satisfies the same consent,
  deletion, audit, and clean-export rules.
- Replace AI providers by changing Edge Function adapters that still write through
  the `source_payloads`/`drafts` boundary.
- Do not let provider-specific response shapes leak into official ledger tables.
