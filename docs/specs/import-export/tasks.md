# Import Export Tasks

## Task 1: Implement CSV File Validation

Status: Complete for local pre-review validation. The current boundary accepts UTF-8/UTF-8 with BOM CSV files up to 10 MB and 5,000 data rows.

Validate encoding, delimiter, headers, size, and row count.

Expected verification:

- UTF-8 and UTF-8 with BOM files are accepted.
- Normalized and legacy Traditional Chinese ledger headers are recognized.
- Malformed rows, unsupported headers, invalid UTF-8, and over-limit batches are rejected before ledger writes.
- Valid selections report row and column counts as review-ready; no official records are created.

## Task 2: Implement Field Mapping

Map normalized headers and legacy spreadsheet headers.

Expected verification:

- Old spreadsheet headers map to normalized fields.

## Task 3: Implement Row Validation

Validate date, kind, account, amount, currency precision, and kind-specific required fields.

Expected verification:

- Invalid rows become review items.

## Task 4: Implement Alias Mapping

Apply default taxonomy aliases and review rules.

Expected verification:

- `特殊`, `0`, and `?` enter review.

## Task 5: Implement Duplicate Detection

Add kind-specific duplicate heuristics.

Expected verification:

- Expense, transfer, fund addition, adjustment, and refund duplicates are detected.

## Task 6: Implement Import Review Actions

Support skip, keep separate, merge into draft, and link to existing.

Expected verification:

- Review action does not destructively overwrite official records.

## Task 7: Implement Clean Export

Status: Complete for normalized local CSV and JSON export. Multi-table ZIP export remains Task 8.

Generate normalized CSV and JSON without media bytes.

Expected verification:

- Export includes stable ids, ISO dates, and the normalized field set.
- CSV uses UTF-8 with BOM and escaped values; JSON remains valid UTF-8 JSON.
- Only active records are exported; voided records and image bytes/base64 are excluded.
- Settings exposes both download actions.

## Task 8: Implement Multi-Table ZIP Export

Status: Complete for small synchronous local exports. Large-export progress or async handling remains Task 9.

Generate manifest, ledger tables, and account summary.

Expected verification:

- ZIP has the expected manifest, six ledger tables, and account summary.
- Manifest records schema version, export time, date range, currency modes, file list, and per-file counts.
- Account summary includes opening balance, income, expense, refund, fund addition, transfer, adjustment, closing balance, and record count columns.
- ZIP rows exclude voided records and media bytes/base64.

## Task 9: Add Performance Path

Add progress or large-export path for exports above 10,000 records.

Expected verification:

- Large export path does not freeze UI.
