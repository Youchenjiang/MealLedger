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

Status: Complete for normalized and legacy header preview. Mapping is local-only and does not create draft or official records.

Map normalized headers and legacy spreadsheet headers.

Expected verification:

- Old spreadsheet headers map to normalized fields, including `日期`, `店家`, `名稱`, `種類`, `金額`, and `帳戶`.
- `種類` maps to `category`; transaction kind uses `kind` or `類型`.
- Transfer `原帳戶` and `後帳戶` map to `account` and `target_account` respectively.
- Duplicate canonical mappings and unmapped headers are visible before review.

## Task 3: Implement Row Validation

Status: Complete for normalized local validation and review classification. Confirmed import writes use the shared official-record boundary.

Validate date, kind, account, amount, currency precision, and kind-specific required fields.

Expected verification:

- Dates normalize from `YYYY-MM-DD` or `YYYY/MM/DD`.
- Amounts normalize display commas and enforce currency precision.
- Expense, income, transfer, refund, fund addition, adjustment, and unresolved-expense rules are checked separately.
- Same-currency transfers default target amount/currency; cross-currency transfers require both destination values.
- Invalid or incomplete rows become review items and never become official records.

## Task 4: Implement Alias Mapping

Status: Complete for local alias classification and review suggestions. Alias acceptance remains review-gated before official import writes.

Apply default taxonomy aliases and review rules.

Expected verification:

- `特殊`, `0`, and `?` enter review without silent final categories.
- `AI` suggests `訂閱 > AI` and remains review-gated.
- `登山` suggests event/tag context; `浪費` suggests a tag.
- Original labels remain available for later `source_label` preservation.

## Task 5: Implement Duplicate Detection

Status: Complete for local kind-specific heuristics against active records and within-batch rows.

Add kind-specific duplicate heuristics.

Expected verification:

- Expense, transfer, fund addition, adjustment, and refund duplicates are detected.

## Task 6: Implement Import Review Actions

Status: Complete for the current local review boundary. The queue supports confirm, skip, keep separate, merge to draft, and link to an existing candidate. Row editing, durable cross-device review state, and server-side review persistence remain outside this slice.

Support skip, keep separate, merge into draft, and link to existing.

Expected verification:

- Confirmed rows pass through the shared official-record boundary and create local records.
- Invalid rows and ambiguous category aliases cannot be confirmed yet.
- Skipped rows do not create or modify official records.
- Review action does not destructively overwrite official records.

## Task 7: Implement Clean Export

Status: Complete for normalized local CSV and JSON export, including the plural refund-link field without media bytes.

Generate normalized CSV and JSON without media bytes.

Expected verification:

- Export includes stable ids, ISO dates, and the normalized field set.
- CSV uses UTF-8 with BOM and escaped values; JSON remains valid UTF-8 JSON.
- Only active records are exported; voided records and image bytes/base64 are excluded.
- Settings exposes both download actions.

## Task 8: Implement Multi-Table ZIP Export

Status: Complete for local multi-table ZIP exports. The manifest, ledger tables, account summary, active-record filtering, and staged progress path are covered.

Generate manifest, ledger tables, and account summary.

Expected verification:

- ZIP has the expected manifest, six ledger tables, and account summary.
- Manifest records schema version, export time, date range, currency modes, file list, and per-file counts.
- Account summary includes opening balance, income, expense, refund, fund addition, transfer, adjustment, closing balance, and record count columns.
- ZIP rows exclude voided records and media bytes/base64.

## Task 9: Add Performance Path

Status: Complete for the current browser-local export boundary. ZIP generation yields between preparation/build stages and exposes progress to the UI; a worker-backed or server-side export remains a future optimization for substantially larger datasets.

Add progress or large-export path for exports above 10,000 records.

Expected verification:

- Large export path does not freeze UI.
