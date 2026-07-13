# V1 Hardening Requirements

V1 hardening is a release-readiness pass for the local-first MealLedger preview. It protects accounting meaning, import/export fidelity, ownership boundaries, and honest local-only behavior. It does not add cloud persistence or provider synchronization.

## Accounting Regression Boundary

- Balances and reports use currency-aware minor-unit parsing at the calculation boundary.
- TWD and JPY reject fractional amounts. Other V1 currencies accept at most two decimal places.
- Transfers keep source and destination amounts and currencies separate.
- Fund additions affect account balance and cash flow, but never income totals.
- Refunds reduce net spending and increase cash flow; a payback requires at least one linked expense in the local draft flow.
- Adjustments may be positive or negative and remain separate from income and ordinary spending.
- Voided records do not affect balances, reports, or clean exports.

## Import And Export Boundary

- Clean CSV and JSON exports contain ledger fields only; they never contain image bytes, Base64, or media payloads.
- Income and fund-addition sources round-trip through the `source` field.
- Transfer legs, refund links, tags, events, and source labels are preserved when present.
- CSV exports remain UTF-8 with BOM for spreadsheet compatibility.
- Import validation rejects malformed dates, unsupported kinds, missing required fields, unknown accounts, invalid currency precision, and invalid transfer legs.

## Media And Privacy Boundary

- Media metadata is owned by the same user as its media asset and target record.
- A media link cannot attach an asset or target owned by another user.
- The R2 upload boundary writes the schema's `thumbnail_object_key` column and does not expose a public media base URL.
- Clean ledger exports contain no media bytes or Base64.
- Current V1 Capture stores local file metadata and a local queue only. It does not claim durable image-byte backup, signed upload completion, signed GET delivery, or cloud cleanup.
- Permanent attachment retention, real object deletion, and 24-hour cloud TTL jobs are deferred to `cloud-persistence` / a later media spec.

## Offline And Failure Boundary

- Local records and drafts remain visibly local-only when cloud sync is unavailable.
- The UI reports offline state and warns when browser storage writes fail.
- A failed import does not modify the local ledger.
- No error path may present local data as synchronized cloud data.

## Schema Boundary

- `supabase/schema.sql` and `supabase/migrations/0001_schema_core.sql` remain byte-identical.
- Transfer details must belong to a transfer record and use a destination account owned by the same user.
- Existing refund links must belong to a refund and point to an expense owned by the same user. Ordinary refunds may remain unlinked when no source record is known.
- A transfer record requires transfer details at transaction commit time.
- RLS policies validate media asset and polymorphic target ownership, not only the link row's `user_id`.
- Live Supabase/RLS execution is not part of this local environment because the Supabase CLI is not installed; static migration contract checks are required until cloud-persistence enables an integration environment.
