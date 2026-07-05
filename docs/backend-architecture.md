# Backend Architecture

MealLedger separates structured financial records from large media files. The backend is designed around clear ownership boundaries so ledger exports stay small, media storage can grow independently, and future invoice providers can be swapped without rewriting the core ledger.

## Backend Components

| Component | Technology | Responsibility |
| --- | --- | --- |
| Identity and app API | Supabase Auth + Supabase client | User identity, session handling, and authenticated reads/writes to app tables |
| Structured database | Supabase PostgreSQL | Accounts, ledger transactions, meals, media metadata, invoice metadata, AI drafts, links, exports, and RLS |
| Media object storage | Cloudflare R2 | Original meal photos, receipt images, thumbnails, and future media backups |
| Server-side integration layer | Supabase Edge Functions | R2 signed URLs, invoice import jobs, AI/OCR calls, provider adapters, and secrets handling |
| AI provider layer | Edge Function adapters | OCR, natural-language parsing, transaction suggestions, and anomaly drafts |
| Official invoice provider | Ministry of Finance e-invoice service adapter | Scheduled invoice synchronization and invoice-to-transaction draft generation |

## Storage Boundaries

### Supabase PostgreSQL

Supabase PostgreSQL is the source of truth for structured data:

- `accounts`, `categories`, `merchants`, `transactions`
- `meal_entries`, `meal_media_links`, `meal_transaction_links`
- `media_assets` metadata only, never image bytes
- `ai_imports` drafts and parsed AI output
- future invoice tables: `invoice_import_accounts`, `invoice_import_runs`, `invoice_records`, `invoice_line_items`
- export views such as `ledger_export`

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

## Data Flow

### Manual Ledger Entry

1. Frontend writes a user-confirmed transaction to Supabase.
2. RLS ensures the row belongs to the authenticated user.
3. Exports read from `ledger_export`.
4. No media object is involved unless the transaction is linked to a meal or receipt.

### Meal Photo Upload

1. Frontend calls `create-r2-upload-url`.
2. Edge Function validates the user and request.
3. Edge Function creates a `media_assets` metadata row and returns a short-lived R2 PUT URL.
4. Frontend uploads the image directly to R2.
5. Frontend creates or updates `meal_entries` and `meal_media_links`.
6. A later confirmation or cleanup workflow should reconcile abandoned metadata rows if the browser upload fails.

### Meal-to-Transaction Matching

1. A meal has time, optional merchant, and linked media.
2. `find_transaction_candidates_for_meal` searches nearby expense transactions.
3. The UI shows candidates and confidence.
4. User confirmation creates `meal_transaction_links`.
5. Confirmed links make photo-to-ledger and ledger-to-photo navigation possible.

### Taiwan Cloud Invoice Import

1. Edge Function invoice adapter authenticates with the official invoice provider.
2. Scheduled sync writes an `invoice_import_runs` row.
3. Imported invoice headers and line items are stored in invoice tables.
4. Import logic creates transaction drafts, not official ledger transactions.
5. User confirmation converts a draft into a `transactions` row and optional links to meals/media.
6. If the official service later supports push delivery, the adapter can add a webhook-like entry point without changing core ledger tables.

### AI/OCR Collaboration

1. Frontend or scheduled job submits media or text to an Edge Function.
2. Edge Function calls an AI/OCR provider.
3. Parsed output is saved to `ai_imports`.
4. AI-generated rows remain drafts until the user confirms them.
5. Confirmed drafts create or update official ledger/meal/link records.

## Export and Backup

Daily ledger export reads structured PostgreSQL views only:

- transactions
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
- Replace invoice providers by adding a new adapter that writes the same invoice tables.
- Replace AI providers by changing Edge Function adapters that still write `ai_imports`.
- Do not let provider-specific response shapes leak into official ledger tables.

