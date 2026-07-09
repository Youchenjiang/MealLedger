# Manual Ledger Requirements

Manual ledger is the core V1 accounting workflow. It lets the user create official records without photos, AI/OCR, import, or provider sync.

## Scope

This spec covers manual creation and editing flows for:

- expense
- income
- transfer
- refund
- fund addition
- adjustment
- unresolved expense
- recurrence intent at entry time
- lightweight shared-payment marking
- history-based field suggestions

This spec does not cover receipt scanning, CSV import, media upload, provider sync, full budgeting, or full debt tracking.

## Common Requirements

WHEN the user opens manual ledger entry
THE SYSTEM SHALL let the user choose the record kind before saving.

WHEN the user changes record kind
THE SYSTEM SHALL show only the fields required or relevant for that kind.

WHEN the user saves a valid manual record
THE SYSTEM SHALL create an official ledger record, not a draft.

WHEN required fields are missing
THE SYSTEM SHALL block official save and show field-level errors.

WHEN the user cancels entry with unsaved changes
THE SYSTEM SHALL ask whether to discard, keep as local draft, or continue editing.

WHEN the user saves any official record
THE SYSTEM SHALL preserve an audit event with created time, user id, kind, and changed fields.

WHEN the app is offline
THE SYSTEM SHALL allow local manual entry and mark the record as local-only until sync succeeds.

WHEN a record is local-only
THE SYSTEM SHALL keep the same idempotency key across retries.

## Expense

WHEN creating an expense
THE SYSTEM SHALL require date, account, amount, merchant, item name or description, and category.

WHEN merchant is unknown
THE SYSTEM SHALL let the user explicitly mark merchant missing and fill a fixed missing-merchant label.

WHEN item name is unknown
THE SYSTEM SHALL let the user explicitly mark item/name missing and fill a fixed missing-item label.

WHEN merchant or item name is marked missing
THE SYSTEM SHALL not invent arbitrary values.

## Income

WHEN creating income
THE SYSTEM SHALL require date, account, amount, category, and source.

WHEN the user enters a new income category or source
THE SYSTEM SHALL allow inline creation or selection from existing values.

WHEN income is saved
THE SYSTEM SHALL count it as income in reports.

## Fund Addition

WHEN creating a fund addition
THE SYSTEM SHALL require date, account, amount, and source.

WHEN fund addition is saved
THE SYSTEM SHALL change account balance without counting as earned income.

WHEN the user enters initial balance
THE SYSTEM SHALL label the behavior as `初始資金` or equivalent UI copy.

## Transfer

WHEN creating a same-currency transfer
THE SYSTEM SHALL require date, source account, destination account, and amount.

WHEN creating a cross-currency transfer
THE SYSTEM SHALL require date, source account, source amount, destination account, and destination amount.

WHEN the transfer includes a fee
THE SYSTEM SHALL let the user enter optional fee account, fee amount, fee currency, and fee category.

WHEN a transfer with fee is saved
THE SYSTEM SHALL persist the transfer and a linked fee expense.

WHEN a transfer is saved
THE SYSTEM SHALL not count it as income or expense.

## Refund And Payback

WHEN creating a refund
THE SYSTEM SHALL require date, account, amount, merchant or source, category, and refund reason or linked expense when available.

WHEN the refund is a friend payback
THE SYSTEM SHALL save it as `kind=refund` with `refund_subtype=payback`.

WHEN a refund links to one or more expenses
THE SYSTEM SHALL show the refundable amount and warn if the refund exceeds it.

WHEN refund amount exceeds the linked refundable amount
THE SYSTEM SHALL require explicit classification of the excess portion before save.

WHEN refund account differs from the original expense account
THE SYSTEM SHALL allow saving and report the actual cash flow account.

## Adjustment

WHEN creating an adjustment
THE SYSTEM SHALL require date or period, account, amount, and reason.

WHEN adjustment is saved
THE SYSTEM SHALL change account balance and appear in audit/export views.

WHEN adjustment is saved
THE SYSTEM SHALL not count it as income, expense, refund, or transfer.

## Unresolved Expense

WHEN creating an unresolved expense
THE SYSTEM SHALL require account, amount, and time precision.

WHEN time precision is day
THE SYSTEM SHALL require date.

WHEN time precision is month or period
THE SYSTEM SHALL require period start and period end.

WHEN unresolved expense is saved
THE SYSTEM SHALL count it as spending under `缺漏支出` or `未分類支出`.

WHEN the user later fills all required expense fields
THE SYSTEM SHALL prompt conversion from unresolved expense to expense.

WHEN unresolved expense converts to expense
THE SYSTEM SHALL preserve stable id, links, and audit history.

## History Suggestions

WHEN the user types merchant text
THE SYSTEM SHALL show matching merchants and recent related records.

WHEN the user types item/name text
THE SYSTEM SHALL show related merchants, amounts, accounts, categories, events, and tags from prior records.

WHEN suggestions are shown
THE SYSTEM SHALL visually distinguish suggested values from confirmed user input.

WHEN the user accepts a suggestion
THE SYSTEM SHALL apply it field by field.

WHEN the user clears a suggested field
THE SYSTEM SHALL clear only that field.

WHEN a suggestion includes amount, account, kind, recurrence, or official posting behavior
THE SYSTEM SHALL require explicit user confirmation before save.

## Recurrence Intent

WHEN saving income, expense, or transfer
THE SYSTEM SHALL allow recurrence choice: current cycle only, prompt next cycle, or auto-record next cycle.

WHEN amount is variable or missing
THE SYSTEM SHALL disallow auto-record and allow only current cycle or prompt next cycle.

WHEN auto-record is selected
THE SYSTEM SHALL require all fields needed for future official records.

WHEN recurrence is saved
THE SYSTEM SHALL make it easy to pause or cancel later.
