# Product Requirements Notes

These notes capture current product decisions and unresolved questions before the app shell and schema become too specific. They are intentionally working notes, not a final specification.

## Confirmed Direction

- MealLedger is accounting-first. The main product job is to keep a clean personal ledger.
- Meal records are optional context, not the primary record type.
- Photos are optional evidence or memory. A transaction can exist without photos, and a meal can exist without a linked transaction.
- Capture should support multiple entry intents:
  - add a manual transaction
  - scan a receipt or invoice as a ledger source
  - record a meal
  - attach photos to an existing or draft record
- Imported images can be reused across contexts without re-uploading the same file. Each media link should still have one clear product intent, such as ledger source, meal photo, or attachment.
- A meal can have more than one photo.
- Receipt and invoice scan images are temporary capture inputs by default. After the user confirms ledger fields or abandons the draft, the app should clear raw scan files and OCR/AI working data unless the user explicitly chooses to keep a file as an attachment or evidence.
- AI and OCR output should create drafts and suggestions only. Official transactions require user confirmation.
- Ledger export must stay small and independent from image file size. Export rows may include media ids or linked record ids, but never image bytes or base64 content.

## Core Concepts

### Spreadsheet Baseline

The app must not provide less accounting coverage than the user's existing spreadsheet. The baseline spreadsheet has these views:

- Cash summary by account: account, total income, transfers, total expenses, and current cash balance.
- Budget or fund additions: date, account, amount, and source. These are not always earned income.
- Transfers: date, source account, amount, and destination account. Transfer history must be retained and reviewable.
- Unrecorded or unresolved expenses: date, account, amount, and pending note/status. These count as spending even when merchant/category details are missing.
- Cash expenses: date, merchant, item name, category, amount, and account.

The app should improve this baseline by making these views derived from one consistent ledger model instead of requiring duplicate manual tables. Account balances, transfer history, unresolved expenses, and expense lists should be computed from confirmed ledger records.

Summary views are useful only when they answer a concrete question. They should be optional derived views, not the primary value of the app. A well-formatted ledger should remain useful even without the cash summary.

`現金餘額` means the current amount in that account.

Minimum ledger capabilities:

- Multiple accounts, including cash wallets, bank accounts, stored-value cards, and digital wallets.
- Accounts should have a currency, such as TWD or JPY. Transactions normally use the currency of the selected account.
- Opening balances, fund additions, and later balance adjustments with an explicit source or reason. These should not be forced into earned income.
- Income records require date, account, amount, category, and source.
- Expense and refund records require date, merchant, item name or description, category, amount, and account.
- Expense entry can explicitly mark merchant missing or item/name missing. The system should then fill a fixed missing-value label or a user-approved suggestion, not invent arbitrary data.
- Transfers between accounts without counting the transfer as spending, while retaining a clear transfer record.
- Low-information expense records for amounts that are known but not yet fully identified.
- Optional account summary that separates income, fund additions, transfer movement, expenses, refunds, unresolved expenses, and resulting balance.
- Clean export that can reproduce the spreadsheet-level tables without media bytes.
- Export mode choice: one normalized ledger table, or multiple spreadsheet-style tables such as summary, fund additions, transfers, expenses, refunds, unresolved expenses, and adjustments.

Currency and cross-currency rules:

- Multi-currency support means supporting accounts with different currencies, not requiring exchange rates on every foreign-currency purchase.
- Currency exchange should be recorded at the moment money is exchanged or moved between currencies, such as TWD cash to JPY cash.
- Same-currency transfers can use one `amount`.
- Cross-currency transfers require both `source_amount` with source currency and `destination_amount` with destination currency. Example: source account decreases by TWD 10000 and destination cash account increases by JPY 46000.
- Cross-currency transfer records do not need a live exchange-rate lookup, but they must preserve both sides so account balances remain correct.
- Transfer fees should be represented as a separate `expense`, usually categorized as `手續費`, rather than silently inferred from transfer differences.
- The transfer entry UI may offer an inline fee field for convenience, but saving should still create a transfer record plus a fee expense record so reports remain explicit.
- V1 cross-currency transfer entry should include an optional fee section. The user experiences one exchange/transfer flow, while the app persists normalized records behind the scenes.
- After exchange, spending from a foreign-currency cash account reduces that account's balance in its own currency.
- First version does not need live exchange rates, automatic foreign-exchange gains/losses, or automatic conversion of every foreign purchase back to TWD.
- Reports should avoid adding different currencies into one misleading total. They can show account balances and spending by currency, with TWD as the default base view for TWD accounts.
- First version should show assets grouped by currency instead of a single cross-currency net-worth number.
- A future net-worth view may use user-entered valuation rates or an exchange-rate provider, but that should not force every foreign-currency spending record to store an exchange rate.

Additional official-record requirements:

- Transfer records require date, source account, source amount, destination account, and destination amount when account currencies differ. Same-currency transfers can display as one amount.
- Fund-addition records require date, account, amount, and source.
- Adjustment records require date, account, amount, and reason.
- Refund records follow expense-like required fields and report as negative spending.
- Expense item/name is separate from merchant and category.

