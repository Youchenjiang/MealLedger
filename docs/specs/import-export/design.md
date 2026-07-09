# Import Export Design

## Import Flow

Recommended flow:

1. User chooses import file.
2. App validates file type, size, and encoding.
3. App previews headers.
4. App maps fields using built-in mappings.
5. App validates rows and detects duplicates.
6. App creates review groups.
7. User confirms, skips, edits, links, or keeps separate.
8. Confirmed rows create official records through ledger rules.

## Supported Formats

V1 required:

- CSV, UTF-8 or UTF-8 with BOM

V1 optional:

- `.xlsx` only when a reliable parser is already available

Post-V1:

- provider statement formats
- government invoice sync
- media backup import

## Normalized Columns

The normalized import template supports:

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

## Review Groups

Import should create review groups rather than immediately writing official records when:

- required fields are missing
- category mapping is ambiguous
- duplicate candidates exist
- currency precision needs review
- row kind cannot be inferred safely

## Export Modes

V1 export modes:

1. Single normalized ledger CSV/JSON.
2. Multi-table spreadsheet-compatible ZIP.

ZIP structure:

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

`manifest.json` includes schema version, export time, date range, file list, and record counts.

`account_summary.csv` includes account balances and totals by income, expense, refund, transfers, adjustments, and closing balance.

## Boundaries

Clean ledger export is not a full media backup.

Import does not call AI/OCR unless a later feature explicitly adds it.

Import does not overwrite official records destructively.

## References

- [V1 import and export spec](../../v1/import-export-spec.md)
- [Accounting rules](../../v1/accounting-rules.md)
- [Default taxonomy](../default-taxonomy/requirements.md)
- [Schema core design](../schema-core/design.md)
