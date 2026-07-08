# MealLedger Accounting Test Plan

This document lists accounting and data-integrity tests that should guide schema and feature implementation.

## Test Principles

Amounts should be stored and calculated as integer minor units whenever possible.

Transfers do not count as income or expense.

Refunds are negative spending, not income.

Fund additions change balances but do not count as earned income.

Exports must not include image bytes.

AI, OCR, import, and recurrence suggestions must remain drafts until user confirmation unless a rule explicitly allows auto-recording.

## Fund Addition And Adjustment

Test that initial funds increase account balance without increasing income totals.

Test that budget refills or original savings are exported as `fund_addition`, not `income`.

Test that an identified missed purchase is backfilled as `expense` on the original date.

Test that unknown balance drift can be recorded as `adjustment` with a required reason.

Test that adjustments appear in audit/export views and can be excluded from ordinary spending reports.

## Expense And Refund

Test that an expense decreases the selected account and increases spending for its category.

Test partial refund against one expense.

Test multiple refunds against one expense.

Test one refund linked to multiple original expenses.

Test refund into a different account than the original expense.

Test refund greater than the linked original expense requires confirmation and difference classification.

Test cross-currency refund with `exchange_difference` separated from ordinary category spending.

Test cross-period refund appears on the actual refund date in cash-flow reports and can be netted in personal spending views.

## Shared Payments

Test user pays a full shared bill and account balance reflects the full cash outflow.

Test friend payback is recorded as refund-like negative spending and links to the original shared expense.

Test pending payback tag or event appears in review views until marked settled.

Test net-spending report can exclude or net marked shared-payment records while cash-flow report keeps actual dates.

## Transfers And Currency

Test same-currency transfer subtracts one account and adds another without changing income or expense totals.

Test cross-currency transfer stores source amount and destination amount independently.

Test cross-currency transfer with fee creates a separate fee expense.

Test transfer fee can use a third account and third currency.

Test account currency cannot be changed after confirmed ledger records exist.

Test TWD and JPY reject decimal fractions by default.

Test USD and common foreign currencies accept two decimal places by default.

Test imported amounts with excessive precision create review warnings before rounding.

Test reports group balances and spending by currency and never directly sum TWD, JPY, USD, or other currencies into one raw total.

Test rounding uses `round half away from zero` only at input or import boundaries.

## Unresolved Expense

Test unresolved expense can be saved with time or period, account, and amount.

Test unresolved expense with month precision exports `period_start` and `period_end` without inventing a fake day.

Test unresolved expense counts as spending and appears under `缺漏支出` or `未分類支出` in category reports.

Test partial completion preserves `unresolved_expense` kind.

Test completion of all required expense fields prompts conversion to `expense`.

Test conversion preserves stable id, links, media, and audit history.

Test reverting to unresolved status preserves audit history.

## Recurrence

Test fixed known recurrence can auto-record only when all required fields are known.

Test variable-amount recurrence creates a draft or reminder, not an official record.

Test monthly recurrence on the 31st falls back to the last valid day of short months.

Test monthly recurrence on February 29 behaves correctly in leap years and non-leap years.

Test transaction and recurrence dates near timezone boundaries remain assigned to the user's intended local date.

Test recurrence edits affect future cycles only by default.

Test pause prevents future generated items.

Test resume starts from the next eligible cycle without silent backfill.

## Import

Test UTF-8 and UTF-8 with BOM CSV import.

Test `YYYY-MM-DD` and `YYYY/MM/DD` date normalization.

Test legacy spreadsheet headers map to normalized fields.

Test ambiguous legacy labels such as `特殊`, `0`, and `?` enter review instead of silently finalizing.

Test idempotent retry does not create duplicate imported records.

Test business duplicate warning for same date, account, amount, and merchant or source label.

Test transfer duplicate warning uses source account, target account, source amount, target amount, and source label.

Test same-currency transfer import accepts empty `target_amount` and defaults it to `amount`.

Test transfer import with fee columns creates a linked fee expense.

Test import refuses over-limit batches before partial processing.

Test 5,000-row import completes within the V1 performance target once that target is set.

## Export

Test CSV export includes UTF-8 BOM for Excel compatibility.

Test JSON export is UTF-8 without BOM.

Test single-table export contains normalized ledger rows.

Test multi-table ZIP contains manifest, ledger tables, and account summary.

Test `manifest.json` includes schema version, exported timestamp, file list, and record counts.

Test `reports/account_summary.csv` balances opening balance, income, expenses, refunds, transfers, adjustments, and closing balance.

Test exported rows include tags, events, source labels, and linked media ids when available.

Test exported rows do not include media bytes or base64 images.

## Sync And Idempotency

Test manually queued offline action carries the same idempotency key across retries.

Test repeated submit with the same idempotency key returns the original result or no-op behavior.

Test version conflict creates a conflict draft instead of silently overwriting user edits.

Test offline edit followed by cloud edit on the same record creates a conflict draft with both versions.

Test two clients editing the same record preserve audit history after conflict resolution.

Test soft-deleted records disappear from normal reports but remain recoverable.

Test voided records remain visible in audit/export views but are excluded from normal totals.

## Master Data Changes

Test category rename updates current display while preserving stable ids and export/audit snapshots.

Test disabled category remains visible in historical reports and is hidden from new-entry selectors.

Test disabled account remains included in balances and history but is hidden from new-entry selectors.

Test category alias mapping does not silently rewrite historical `category_id` values.

Test account currency cannot be changed after confirmed records exist.

## Performance Baselines

Test ledger list loads a bounded date window rather than all historical rows.

Test reports exclude soft-deleted rows through indexed active-record queries.

Test export above 10,000 records uses the large-export path or shows progress instead of blocking the UI.

Test search uses backend filtering for persisted records and does not require loading all history into the client.

## Media And Drafts

Test deleting a transaction removes active links but does not delete linked meal or permanent media.

Test temporary scan is deleted after confirmation when the user does not choose to retain it.

Test retained scan migrates from temporary storage to permanent media and old temporary object is queued for cleanup.

Test meal with two photos can link both photos to one meal entry.

Test one media asset can link to both a meal and ledger evidence without duplicating file bytes.
