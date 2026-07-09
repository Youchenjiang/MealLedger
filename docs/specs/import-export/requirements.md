# Import Export Requirements

Import/export lets users migrate from spreadsheets and leave with clean ledger data. V1 keeps this separate from media backup and external provider sync.

## Scope

This spec covers:

- CSV import
- optional `.xlsx` decision point
- field mapping
- legacy label mapping
- duplicate detection
- import review
- clean CSV/JSON export
- multi-table ZIP export

This spec does not cover government cloud invoice sync, bank API sync, full media backup export, or OCR image import.

## Import Requirements

WHEN the user imports data in V1
THE SYSTEM SHALL support CSV files encoded as UTF-8 or UTF-8 with BOM.

WHEN the user imports `.xlsx`
THE SYSTEM SHALL support it only if a reliable parser is included; otherwise the UI shall ask the user to export CSV first.

WHEN importing dates
THE SYSTEM SHALL accept `YYYY-MM-DD` and `YYYY/MM/DD` and normalize to `YYYY-MM-DD`.

WHEN importing amounts
THE SYSTEM SHALL validate currency precision at import boundary.

WHEN importing old spreadsheet headers
THE SYSTEM SHALL map known headers such as `日期`, `帳戶`, `金額`, `來源`, `店家`, `名稱`, `種類`, `原帳戶`, and `後帳戶`.

WHEN importing multi-value fields such as tags
THE SYSTEM SHALL parse `|` separated values, trim whitespace, remove empty values, and deduplicate repeated values.

WHEN importing ambiguous labels such as `特殊`, `0`, or `?`
THE SYSTEM SHALL create review items instead of silently finalizing categories.

WHEN importing rows
THE SYSTEM SHALL preserve original row text as `source_label` when useful.

WHEN importing same-currency transfers
THE SYSTEM SHALL allow empty `target_amount` and default it to `amount`.

WHEN importing cross-currency transfers
THE SYSTEM SHALL require source and destination amounts and currencies.

WHEN transfer fee columns are present
THE SYSTEM SHALL create a linked fee expense rather than hiding the fee in the transfer.

WHEN an import row is incomplete or ambiguous
THE SYSTEM SHALL create a draft/review item, not an official ledger record.

WHEN an import row is valid and user-confirmed
THE SYSTEM SHALL create official ledger records.

## Deduplication Requirements

WHEN a request is retried with the same idempotency key
THE SYSTEM SHALL not create duplicate records.

WHEN imported rows match existing records by business heuristics
THE SYSTEM SHALL warn the user before confirmation.

WHEN duplicate candidates exist
THE SYSTEM SHALL offer skip, keep separate, merge into draft, or link to existing.

WHEN importing transfers
THE SYSTEM SHALL use transfer-specific duplicate fields including source account, target account, source amount, target amount, date, and source label.

## Export Requirements

WHEN the user exports clean ledger data
THE SYSTEM SHALL not include image bytes or base64 data.

WHEN exporting CSV
THE SYSTEM SHALL use UTF-8 with BOM for spreadsheet compatibility.

WHEN exporting JSON
THE SYSTEM SHALL use UTF-8 without BOM.

WHEN exporting dates
THE SYSTEM SHALL use ISO `YYYY-MM-DD`.

WHEN exporting timestamps
THE SYSTEM SHALL use ISO 8601 with timezone or offset.

WHEN exporting multi-value fields
THE SYSTEM SHALL use `|` as the default separator.

WHEN exporting multi-table ZIP
THE SYSTEM SHALL include `manifest.json`, ledger tables, and `reports/account_summary.csv`.

WHEN exporting media relationships
THE SYSTEM SHALL include media ids or linked ids only, not media bytes.

WHEN export is large
THE SYSTEM SHALL use progress or long-running export behavior instead of freezing the UI.
