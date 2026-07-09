# MealLedger V1 Import And Export Spec

This document defines the first implementable import and export behavior. It keeps V1 focused on ledger migration and clean export, while leaving official cloud invoice and bank API sync for later phases.

This file is the canonical V1 import/export policy. Feature-level specs under `docs/specs/import-export/` translate these rules into requirements, design, tasks, and tests for implementation; they should not redefine conflicting behavior.

## V1 Import Scope

V1 must support CSV import. CSV files should be UTF-8 or UTF-8 with BOM, comma-delimited, and use one header row.

V1 may support `.xlsx` only if the implementation already includes a reliable parser. If not, `.xlsx` remains post-V1 and the UI should ask users to export CSV from their spreadsheet tool.

Accepted date formats are `YYYY-MM-DD` and `YYYY/MM/DD`. Imported records should be normalized to ISO `YYYY-MM-DD`.

Amounts are interpreted according to the target account currency precision. Currency is optional when an account is selected and defaults to that account's currency.

## Import Templates

The normalized ledger CSV template should support these columns:

- `date`
- `kind`
- `account`
- `amount`
- `currency`
- `merchant`
- `item_name`
- `category`
- `source`
- `target_account`
- `target_amount`
- `target_currency`
- `fee_account`
- `fee_amount`
- `fee_currency`
- `fee_category`
- `tags`
- `event`
- `source_label`
- `notes`

The spreadsheet-style import path may also accept separated tables for expenses, income, transfers, fund additions, refunds, unresolved expenses, and adjustments.

V1 should provide a default mapping for the user's existing spreadsheet headers, including `日期`, `帳戶`, `金額`, `來源`, `店家`, `名稱`, `種類`, `原帳戶`, and `後帳戶`.

Saving custom import mappings is post-V1 unless it is simple to keep as local browser preference.

Multi-value import fields such as `tags` should use `|` as the default separator. Import should trim whitespace, drop empty values, and remove duplicates while preserving the first seen order.

For same-currency transfers, `target_amount` may be empty and should default to `amount`. For cross-currency transfers, `amount`, `currency`, `target_amount`, and `target_currency` are required.

Transfer fee columns are optional. When provided, the importer should create a separate fee `expense` linked to the imported transfer. This preserves normalized ledger records while still allowing a one-row spreadsheet import.

## Legacy Classification Mapping

Old labels should map through taxonomy aliases first. Clear labels can be mapped automatically; ambiguous labels should enter review.

`特殊`, `0`, and `?` must not silently map to final categories. They should become review items, `缺漏支出`, or more specific suggested categories.

Legacy source labels should be preserved in `source_label` for audit and later cleanup.

## Import Deduplication

Idempotency keys prevent retry duplicates for the same import action.

V1 should also warn about business duplicates inside the import batch and against existing records. The first heuristic is:

- same date
- same account
- same amount
- same merchant, item name, or source label when available

Transfers should use a transfer-specific duplicate heuristic:

- same date
- same source account
- same target account
- same source amount
- same target amount when present
- same source label when present

Fund additions should compare date, account, amount, source, and source label.

Adjustments should compare date or period, account, amount, reason, and source label.

Refunds should compare date, account, amount, linked expense ids when present, merchant or source label, and refund subtype.

Duplicate handling options are skip, keep separate, merge into draft, or link to existing. V1 must not destructively overwrite official records during import.

## Import Limits

V1 CSV import should allow up to 5,000 rows per batch.

V1 scan or media batch import should allow up to 20 files, 10 MB per file, and 100 MB per batch.

When a batch exceeds the limit, the UI should ask the user to split the file or import in smaller batches. The system should fail before partial processing when the batch is clearly over limit.

## V1 Export Scope

V1 must support a clean ledger export that does not include image bytes.

CSV export should use UTF-8 with BOM to reduce Traditional Chinese garbling in Excel. JSON export should use UTF-8 without BOM.

Dates should export as ISO `YYYY-MM-DD`. Timestamps should export as ISO 8601 with timezone or offset.

Amounts should export as display decimals and, when available, integer minor units.

## Export Modes

V1 should support two export modes:

1. Single normalized ledger table.
2. Multi-table ZIP that mirrors spreadsheet-style review.

The multi-table ZIP should use this structure:

```text
manifest.json
ledger/transactions.csv
ledger/transfers.csv
ledger/fund_additions.csv
ledger/refunds.csv
ledger/unresolved_expenses.csv
ledger/adjustments.csv
reports/account_summary.csv
```

`manifest.json` should include:

- `app`
- `schema_version`
- `exported_at`
- `user_id_hash`
- `export_mode`
- `date_range`
- `currency_modes`
- `files`
- `record_counts`

`reports/account_summary.csv` should include:

- `account_id`
- `account_name`
- `currency`
- `opening_balance`
- `income_total`
- `expense_total`
- `refund_total`
- `transfer_in_total`
- `transfer_out_total`
- `adjustment_total`
- `closing_balance`
- `record_count`

Exported rows may include tags, event id, event name, source label, and linked media ids. They must not include media bytes.

Multi-value fields such as tags should use `|` as the default separator.

## Export Limits

V1 can generate small exports synchronously.

Exports above 10,000 records should be treated as long-running work. The first implementation may show progress in the UI; later versions can move large exports to an async job.

Only one active export job per user should run at a time. Generated export files should expire after 24 hours unless the user downloads them locally.
