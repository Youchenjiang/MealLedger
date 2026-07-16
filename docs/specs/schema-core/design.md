# Schema Core Design

This is a design draft, not a migration. Names may be adjusted during implementation, but table responsibilities should remain stable.

## Common Columns

Most user-owned tables should include:

- `id`
- `user_id`
- `created_at`
- `updated_at`
- `deleted_at`
- `version`

Official or auditable tables may also include:

- `status`
- `voided_at`
- `void_reason`
- `replaces_record_id`
- `replaces_record_id`
- `source_label`
- `idempotency_key`

Use integer minor units for money where practical:

- `amount_minor`
- `currency`
- `precision`

## Tables

### `profiles`

Stores app-level user profile settings not covered by Supabase Auth.

Important fields:

- `user_id`
- `display_name`
- `default_currency`
- `default_timezone`
- `storage_persistence_seen_at`

### `accounts`

Stores cash wallets, bank accounts, stored-value cards, digital wallets, foreign-currency cash, and optional liability-like accounts.

Important fields:

- `user_id`
- `name`
- `currency`
- `account_type`
- `allow_negative_balance`
- `disabled_at`
- `sort_order`

### `categories`

Stores income and expense category hierarchy.

Important fields:

- `user_id`
- `parent_id`
- `name`
- `kind_scope`
- `disabled_at`
- `sort_order`
- `is_system_default`

### `category_aliases`

Stores old spreadsheet labels and import aliases such as `特殊`, `0`, and `?`.

Important fields:

- `user_id`
- `category_id`
- `alias`
- `source`
- `review_required`

### `merchants`

Stores merchant/place/counterparty names for suggestions and search.

Important fields:

- `user_id`
- `name`
- `normalized_name`
- `disabled_at`

### `ledger_records`

Stores official transaction-like accounting records.

Supported `kind` values:

- `income`
- `fund_addition`
- `expense`
- `refund`
- `unresolved_expense`
- `transfer`
- `adjustment`

Important fields:

- `user_id`
- `kind`
- `status`
- `local_date`
- `local_time`
- `timezone`
- `account_id`
- `amount_minor`
- `currency`
- `event_id`
- `category_id`
- `merchant_id`
- `merchant_text`
- `item_name`
- `source`
- `reason`
- `time_precision`
- `period_start`
- `period_end`
- `source_label`
- `note`

Use kind-specific validation in application/domain logic and database constraints where practical.

### `transfer_details`

Stores second-side transfer data when a `ledger_records` row has `kind=transfer`.

Important fields:

- `ledger_record_id`
- `destination_account_id`
- `destination_amount_minor`
- `destination_currency`
- `fee_ledger_record_id`

The main `ledger_records.account_id`, `amount_minor`, and `currency` store the source side of the transfer. `transfer_details` stores only the destination side and linked fee record to avoid duplicating source fields.

### `refund_links`

Links refund records to original expense records.

Important fields:

- `refund_record_id`
- `original_record_id`
- `amount_minor`
- `currency`
- `refund_subtype`
- `difference_kind`

### `events`

Stores project, trip, activity, or reimbursable context.

Important fields:

- `user_id`
- `name`
- `starts_on`
- `ends_on`
- `disabled_at`

### `tags`

Stores reusable lightweight labels.

Important fields:

- `user_id`
- `name`
- `kind_scope`
- `disabled_at`

### `ledger_record_tags`

Links ledger records to tags.

Important fields:

- `ledger_record_id`
- `tag_id`

### `meal_entries`

Stores meal records independent of transactions.

Important fields:

- `user_id`
- `meal_at`
- `timezone`
- `meal_period`
- `merchant_id`
- `place_text`
- `description`
- `disabled_at`

### `meal_transaction_links`

Links meals and ledger records.

Important fields:

- `meal_id`
- `ledger_record_id`
- `link_reason`
- `confidence`
- `confirmed_at`

### `media_assets`

Stores media metadata and object references.

Important fields:

- `user_id`
- `storage_provider`
- `bucket`
- `object_key`
- `checksum_sha256`
- `content_type`
- `byte_size`
- `captured_at`
- `media_kind`
- `retention_kind`
- `expires_at`
- `upload_status`

`media_assets` never stores image bytes.

### `media_links`

Links media to meals, ledger records, drafts, or source payloads.

Important fields:

- `media_asset_id`
- `target_type`
- `target_id`
- `link_intent`

### `source_payloads`

Stores source context from manual imports, spreadsheet rows, temporary scans, and future provider data.

Important fields:

- `user_id`
- `source_type`
- `source_status`
- `payload_json`
- `payload_object_key`
- `expires_at`
- `confirmed_at`
- `discarded_at`

### `drafts`

Stores non-official suggestions, manual drafts, import drafts, recurrence reminders, and conflict drafts.

Important fields:

- `user_id`
- `draft_type`
- `status`
- `source_payload_id`
- `target_record_id`
- `candidate_json`
- `conflict_local_json`
- `conflict_remote_json`
- `pinned_at`
- `archived_at`
- `expires_at`

### `audit_events`

Stores user-visible and support-visible audit events.

Important fields:

- `user_id`
- `event_type`
- `target_type`
- `target_id`
- `summary`
- `changes_json`
- `created_at`

### `idempotency_keys`

Stores idempotency records for create, confirm, import, and auto-record actions.

Important fields:

- `user_id`
- `idempotency_key`
- `action_type`
- `request_hash`
- `response_json`
- `result_type`
- `result_id`
- `expires_at`

Use a unique constraint on `user_id, idempotency_key`.

## RLS Rules

Every user-owned table should restrict reads and writes to `auth.uid() = user_id`.

Link tables without `user_id` should enforce ownership through the linked parent records.

Signed URL issuance must verify `media_assets.user_id = auth.uid()` before returning object access.

## Indexing

Core indexes:

- `ledger_records(user_id, deleted_at, local_date desc)`
- `ledger_records(user_id, deleted_at, account_id, local_date desc)`
- `ledger_records(user_id, deleted_at, category_id, local_date desc)`
- `ledger_records(user_id, deleted_at, kind, local_date desc)`
- `ledger_records(user_id, idempotency_key)` when populated
- `drafts(user_id, status, updated_at desc)`
- `media_assets(user_id, retention_kind, expires_at)`
- `media_assets(user_id, checksum_sha256)` unique when a checksum is present
- `media_links(target_type, target_id)`
- `idempotency_keys(user_id, idempotency_key)` unique
- `idempotency_keys(expires_at)` for expiry cleanup

## Deferred Tables

Dedicated `invoice_records`, `invoice_line_items`, and `statement_records` are deferred until provider sync or a dedicated V2 feature needs them. V1 uses `source_payloads` and drafts for manual scans and CSV imports.

## References

- [Accounting rules](../../v1/accounting-rules.md)
- [Data lifecycle](../../v1/data-lifecycle.md)
- [Technical operations](../../v1/technical-ops.md)
- [Backend architecture](../../engineering/backend-architecture.md)
