# Import Export Tasks

## Task 1: Implement CSV File Validation

Validate encoding, delimiter, headers, size, and row count.

Expected verification:

- UTF-8 and UTF-8 with BOM files are accepted.
- Over-limit files are rejected before partial processing.

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

Generate manifest, ledger tables, and account summary.

Expected verification:

- ZIP has expected files and record counts.

## Task 9: Add Performance Path

Add progress or large-export path for exports above 10,000 records.

Expected verification:

- Large export path does not freeze UI.
