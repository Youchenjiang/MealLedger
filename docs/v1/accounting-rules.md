# MealLedger V1 Accounting Rules

This document turns the product requirements into implementable accounting rules for V1. The goal is consistent personal-ledger behavior, not full business accounting.

## Transaction Kind Boundaries

Use `expense` when the user knows the real-world spending event and can provide required expense fields. If the user later remembers a missed purchase, prefer backfilling an `expense` on the original date over using `adjustment`.

Use `unresolved_expense` when money is known to be missing or spent, but required details are not known yet. V1 requires statistical time or period, amount, and account. Missing merchant, item/name, or category can be completed later.

Use `fund_addition` for setup balances, original savings, account funding, unknown starting funds, or non-income budget refills. It changes account balance but does not count as earned income.

Use `income` for earned or received income with date, account, amount, category, and source.

Use `transfer` for money movement between accounts. Transfers do not count as income or expense. Same-currency transfers can use one amount; cross-currency transfers must store both source and destination amounts.

Use `adjustment` only when the account balance must be corrected and the real transaction is unknown, intentionally not reconstructed, or outside the ledger's useful detail. `adjustment` must require a reason and should appear in audit/export views.

`adjustment` changes account balance and asset views, but does not count as income, expense, refund, or transfer. Positive and negative adjustments should appear in a separate `balance_adjustment` report section.

## Backfill vs Adjustment

If the user can identify the original event, backfill the proper record type on the original date. Examples: missed lunch, forgotten transfer, missed refund, or late-entered income.

If the user only knows the balance is wrong, use `adjustment`. Examples: old wallet count mismatch, inherited spreadsheet drift, rounding cleanup, or unknown historical missing cash.

If the user only knows money was spent but lacks details, use `unresolved_expense` rather than `adjustment`.

## Unresolved Expense Lifecycle

An unresolved expense can be saved with time or period, account, and amount. It remains official spending, but reports group it under `缺漏支出` or `未分類支出`.

V1 should store unresolved expense time precision explicitly. Supported values are `day`, `month`, and `period`. Day precision uses `date`; month or period precision uses `period_start` and `period_end` so the app does not need to invent a fake transaction date.

Partial completion is allowed while the record remains `unresolved_expense`. When merchant, item/name, category, and other required expense fields are complete, the app should prompt conversion to `expense`.

Conversion should preserve the same stable record id, links, media references, and audit history. The audit trail should record that the record moved from unresolved to complete.

V1 may allow reverting a converted expense back to `unresolved_expense` if required fields are cleared or the user explicitly marks the record incomplete. Reversion must preserve the same record id and audit trail.

## Refund Rules

Refunds are negative spending, not income. They should keep an expense-related category so reports can subtract them from the matching spending area.

A refund can link to one or more original expenses. One original expense can also have multiple partial refunds.

Refund accounts do not need to match original expense accounts. The refund account should reflect where money actually returned.

If a refund differs from the linked original expense because of exchange drift, fee differences, discounts, rounding, or partial refund behavior, record the difference under `exchange_difference` or a user-selected difference category. Reports should keep exchange difference separate from normal spending categories unless the user chooses otherwise.

If a refund amount is greater than the linked original expense, V1 should warn the user and require confirmation. The portion up to the linked refundable amount remains `refund` and counts as negative spending. The excess portion must be split into one explicit record or sub-line such as `exchange_difference`, `fee_reversal`, `income`, or a user-selected category. The same excess amount must not count as both income and negative spending.

## Shared Payment Rules

V1 does not implement full debt tracking. When the user pays for others, record the actual cash flow first.

Friend payback should use `kind=refund` with `refund_subtype=payback` and can link to the original shared expense. `代墊` and `待還款` tags support lightweight review before settlement.

Personal net-spending reports may net the payback principal against the linked original shared expense. Transfer fees, exchange differences, and unrelated bonuses should remain separate. Cash-flow reports always use the actual payment and payback dates.

## Account And Currency Rules

An account has one currency. V1 should not allow changing account currency after confirmed ledger records exist. If the user made a setup mistake, create a new account and migrate intentionally through transfer/adjustment records.

V1 supports negative balances for cash-like, bank, wallet, credit-card, and loan-like accounts when the user chooses to model them that way. V1 does not implement full credit-card billing cycles, statements, interest, loan schedules, or minimum-payment logic.

Currency precision should be defined per currency. V1 defaults: TWD and JPY use 0 decimal places; USD and common foreign currencies use 2 decimal places unless configured otherwise.

Input should reject extra fractional digits beyond the account currency precision. Calculations should use integer minor units internally to avoid floating-point drift.

Rounding should happen at input or import boundaries, not repeatedly inside reports. If imported data has more precision than allowed, V1 should show a review warning before rounding.

V1 rounding mode is `round half away from zero` at the currency precision boundary. Internal calculations should not re-round already normalized minor units.

Cross-currency transfer fees can use a third account and third currency. UI may present this as an optional fee section, but persistence should create a separate fee `expense` in the fee account's currency.

## Recurring Rules

V1 supports current-cycle-only, prompt-next-cycle, and auto-record for fixed known amounts. Auto-record is allowed only when all required fields are known.

V1 variable-amount recurrence creates a reminder or draft with amount pending. It must not auto-post official records.

Monthly recurrence on the 29th, 30th, or 31st should default to "last valid day of month" when the target day does not exist. The user can later adjust recurrence rules when V2 scheduling options exist.

Recurrence changes affect future occurrences only by default. Retroactive changes require an explicit user action and audit trail.

Pause stops creating future reminders or records. Resume starts from the next eligible cycle and should not backfill skipped cycles unless the user asks.

V1 reminder timing defaults to the due date. Reminder lead time, email reminders, push notifications, and cash-flow forecasts are post-V1 unless added explicitly.
