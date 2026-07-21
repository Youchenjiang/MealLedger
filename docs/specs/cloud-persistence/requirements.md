# Cloud Persistence Requirements

## Goal

Persist the existing local-first MealLedger domain in Supabase when a configured
authenticated client is available, without changing the accounting model or
making cloud availability a prerequisite for recording locally.

## In Scope

- Map local accounts to `public.accounts`.
- Bootstrap merchant names to `public.merchants` and map expense-like records
  to their owned merchant references.
- Map local official records to `public.ledger_records`.
- Map transfer details, refund links, and audit events after their parent record
  is accepted.
- Map pending local drafts to `public.drafts`.
- Persist meal metadata, media metadata, and temporary scan source metadata when
  the local queue contains the corresponding objects. Client-only identifiers
  are converted to deterministic UUIDs at the cloud boundary; image bytes are
  never placed in Supabase rows.
- Use the local idempotency key as the stable action key for retries.
- Keep failed writes in the local queue and expose a retryable error state.
- Use Supabase RLS as the ownership boundary; the browser never uses a service
  role key.

## Explicitly Out Of Scope

- Ministry of Finance invoice synchronization.
- Bank, credit-card, or statement synchronization.
- R2 object upload, signed URL generation, image bytes, OCR, or AI processing.
- Anonymous cloud accounts or a second authentication provider.
- Automatic conflict merging. A version mismatch becomes a retry/conflict
  result and never silently overwrites a newer cloud row.

## Local-First Contract

1. A local write is committed to the existing local store before a cloud write
   is attempted.
2. When Supabase is not configured or the session is not authenticated, the
   local write remains `local-only`; the UI must not label it `synced`.
3. When a cloud write fails, the local record remains available and its queue
   item records the error, attempt count, and next retry time.
4. A successful cloud write changes the local status to `synced` only after the
   complete record bundle succeeds.
5. A retry reuses the original idempotency key. It must not create a new key on
   reload, reconnect, or repeated button clicks.
6. Meal, media metadata, and scan source writes have independent queue targets;
   a scan remains a source/draft until the user confirms it.
7. An account has its own queue target, so creating an account does not require
   a ledger record before the account reference is persisted.

## Write Order

For an official record bundle, the adapter writes in this order:

1. `idempotency_keys` with `(user_id, idempotency_key, request_hash)`.
2. Required account and reference rows that are not already known remotely.
3. `ledger_records` parent rows.
4. `transfer_details` or `refund_links` for the applicable kind.
5. `ledger_record_tags` and `audit_events`.

The adapter must stop after the first failed dependency and return a typed
failure. It must never report the parent as synced while a required child row
is missing.

Transfer records use `persist_ledger_record_bundle`, an authenticated atomic
RPC that writes the parent and its deferred-required `transfer_details` in one
transaction. A client without that RPC remains local-only and reports a
non-retryable cloud boundary error.

## Mapping Rules

- Local monetary strings are parsed with the existing currency precision rules
  and stored as `amount_minor` bigint values. No floating-point arithmetic is
  used for persistence.
- Local account IDs are the canonical account IDs only after account upsert has
  succeeded. A local ID that is not a UUID is treated as a client-side key and
  resolved through the account mapping response.
- Category, merchant, event, and tag names are resolved through explicit maps;
  the adapter does not invent reference IDs or silently discard unresolved
  required values.
- `fund-addition` remains a ledger record kind and is never converted to
  `income`.
- `refund` stores links to one or more original records. A payback remains a
  refund subtype and does not become income.
- Ordinary refunds and paybacks both preserve their original-record links;
  multiple links require explicit allocation amounts.
- Record tags are persisted through `ledger_record_tags` after tag reference
  bootstrap.
- A transfer always requires both the source parent amount and destination
  details. A transfer fee is a separate expense record linked to the transfer;
  the transfer bundle uses the atomic RPC boundary.
- Local `recordState: voided` maps to `record_state: voided`; it is not hard
  deleted during synchronization.
- Local drafts remain drafts. Draft confirmation is a separate operation and
  must not be inferred from a successful draft upload.
- Meal records and media metadata never place image bytes in `ledger_records`
  or any clean ledger export.
- A meal may link multiple media assets and transaction records. A scan source
  may link its temporary media metadata through `media_links` without copying
  the file bytes.

## Idempotency And Concurrency

- The action key is created before a local queue item is stored.
- The request hash is deterministic for the action payload. Reusing a key with
  a different hash is a hard error.
- The server-side unique constraint `(user_id, idempotency_key)` is the final
  duplicate guard.
- Updates include the local `version`. A preflight version mismatch returns a
  conflict result; transfer bundles additionally use atomic compare-and-write
  inside the RPC. The adapter does not use last-write-wins for official ledger
  data.
- Retryable transport failures use bounded exponential backoff. Validation,
  ownership, duplicate-key/hash mismatch, and version conflicts require user
  review rather than infinite retry.

## Authentication And Privacy

- The adapter accepts a session-bound Supabase client and user ID; it does not
  accept or store a service-role client in frontend code.
- Every mutation includes the authenticated user ownership fields expected by
  RLS. Client-side IDs are not treated as proof of ownership.
- The adapter persists metadata only. Temporary scan cleanup and signed media
  URL behavior remain in the capture-media boundary until the cloud media slice.
- If the authenticated user differs from the local data owner, automatic claim
  and sync are blocked until an explicit migration/review flow exists.

## Acceptance Criteria

- Local recording still works with no Supabase configuration.
- Configured authenticated writes use the canonical schema and preserve minor
  units, record kinds, transfer details, refund links, and audit events.
- Replaying the same queue item is idempotent.
- A failed child write leaves the item retryable and never reports a partial
  official bundle as synced.
- A retry of a partial bundle reuses the idempotency key but still attempts the
  missing child writes; an existing key with the same request hash is not an
  early success signal.
- A version conflict is visible and does not silently overwrite the cloud row.
- Transfers without the atomic RPC boundary remain local-only rather than being
  reported as synced.
- Tests prove that clean exports remain unchanged and contain no media bytes.
