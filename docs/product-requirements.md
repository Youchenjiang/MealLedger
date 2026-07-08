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

### Ledger Records

`transactions` are the official accounting records. They hold amount, account, category, merchant, time, note, and transfer relationships. These records are the source of truth for ledger export and reports.

Time fields should preserve both absolute and local context:

- Store an absolute timestamp for ordering and sync, such as UTC.
- Preserve the user's local date/time and timezone or offset at capture/import time.
- Meal-period inference, invoice matching, and travel workflows should use local context, not only UTC.
- Imported external records should preserve provider time fields and timezone assumptions when known.
- If timezone is unknown, the app should mark it as inferred and avoid high-confidence automatic matching based only on time.

Transaction-like ledger records need distinct kinds so the app does not mislabel money movement:

- `income`: earned or received income.
- `fund_addition`: money added to an account for setup, original savings, budget refill, unknown source, or other non-income funding sources.
- `expense`: normal spending.
- `refund`: money returned under the original expense category. Reports should treat refunds as negative spending, not income.
- `unresolved_expense`: spending with limited details that still reduces account balance. Requires statistical period/time, amount, and account before it can be saved as this kind.
- `transfer`: movement between two accounts, retained as its own history and excluded from spending totals.
- `adjustment`: explicit correction when the account balance needs to be fixed with a reason.

### Naming And Reporting Semantics

Internal kind names should stay stable and normalized. Traditional Chinese UI labels can be refined, but they should map to one consistent internal vocabulary.

Suggested internal-to-UI mapping:

- `income`: `收入`
- `fund_addition`: `初始資金`
- `expense`: `支出`
- `refund`: `退款`
- `unresolved_expense`: `缺漏支出`
- `transfer`: `轉帳`
- `adjustment`: `餘額調整`

Reporting rules:

- `fund_addition` changes account balance but does not count as income, especially for original balances, unknown source money, or setup funding. The preferred Traditional Chinese UI label is `初始資金`.
- `refund` belongs under its own transaction kind and the relevant expense category. Spending reports subtract refunds from expenses.
- Cross-period refunds should default to the period when the refund actually happened. A refund can link back to the original expense for drilldown, but the app should not silently rewrite old monthly reports.
- Reports may offer an alternate "original purchase period" view later, but cash-flow and normal monthly spending views use the refund date.
- Refunds can flow into an account different from the original expense account. The refund account should reflect where money actually returned, while category and original-transaction links explain what spending area was reduced.
- A refund can be greater or smaller than the linked original expense. For cross-currency card refunds, fee differences, discounts, or exchange-rate drift, the app should show the difference and let the user categorize or adjust it instead of silently creating an adjustment.
- Refunds can carry an `exchange_difference` or similar subfield for exchange-rate drift, fee differences, discounts, or rounding. Reports should keep this difference separate from normal spending categories such as food or transportation unless the user chooses otherwise.
- `transfer` changes account balances and remains reviewable as transfer history, but does not count as income or expense.
- `unresolved_expense` counts as spending even when merchant, item name, or category is incomplete. The preferred Traditional Chinese UI label is `缺漏支出`.
- In category reports, unresolved expenses should roll up under a visible placeholder such as `未分類支出` or `缺漏支出` so category totals still reconcile with total spending.
- `adjustment` should be visible in audit/export views so balance corrections are not hidden.

Shared payment and payback rules:

- First version does not need a full debt or receivable system.
- When the user pays for others, the ledger should prioritize actual account cash flow. If the user paid 1000 from a wallet, the account balance should decrease by 1000.
- Payback from friends should be recorded like a refund or return under the relevant category, not as earned income.
- Paybacks should be linkable to the original shared expense when known.
- The app should provide a lightweight pending-payback review surface for shared expenses that the user has marked as waiting for repayment.
- Reports should support a filter or view that excludes or nets marked payback-related spending and refunds when the user wants a cleaner monthly personal-spending view.
- Reports should distinguish cash-flow view from personal net-spending view. Cash-flow uses the actual payment and payback dates; personal net-spending can exclude or net marked payback items for easier monthly review.
- Shared context, people, and split notes can be stored as event, tag, or link metadata, but they should not replace the confirmed cash-flow records.
- Reports should subtract friend paybacks from spending in the same way they subtract refunds.

### Recurring Records

Recurring transactions need explicit user intent when entered. Recurrence can apply to expenses, income, and transfers. For subscription-like expenses such as `訂閱 > AI`, repeated income, or repeated account transfers, the app should ask whether the entry applies only to the current cycle, should prompt the user again next cycle, or should be recorded automatically next cycle.

Recurring options:

- Current cycle only: save one record and do not schedule a future reminder.
- Prompt next cycle: create a recurrence reminder that asks the user before posting.
- Auto-record next cycle: create a recurrence rule that posts future records automatically.

Recurring rules:

- The first occurrence must still satisfy normal required fields.
- Auto-record should be clearly marked and easy to pause or cancel.
- Prompted recurrence should create a draft/reminder, not an official ledger record, until the user confirms.
- Future recurrence changes should not rewrite historical confirmed records unless the user explicitly chooses a retroactive edit.
- Interest can be recurring income when the account provides it periodically, but the recurrence cadence and calculation method may need user review or later provider-specific rules.
- Recurrence must support both fixed amount and variable amount records.
- V1 variable-amount recurrence should create a draft or reminder with amount pending, not an auto-posted official ledger record.
- Later versions may support estimated amount, maximum amount, due date, bill-pool linking, or cash-flow forecast treatment for variable bills such as utilities and credit cards.
- If external bills or statement records arrive later, they can fill in or suggest the actual amount before user confirmation.
- Auto-record is allowed only when all required fields, including amount, are known for that cycle.
- For recurring transfers, both source and destination accounts must be known before auto-recording.

### Original Labels And Notes

Imported spreadsheet text should be preserved without forcing it into user-facing notes. The app should distinguish:

- `source_label`: the original imported text from the spreadsheet row when it helps audit import mapping.
- `note`: optional user-written explanation, such as why an expense was marked wasteful.
- `system_suggestion`: AI or import assistant guesses that require user confirmation.

Notes are not a substitute for structured fields. When a label can be structured into category, source, event, period, or item name, the app should suggest that split while preserving the original `source_label`.

Income official fields remain fixed: date, account, amount, category, and source. During import, the app may suggest mapping old combined text into those fixed fields. For example, `紅包(母)` can be suggested as category `紅包` and source `母`, but the user can keep or change the mapping.

### Category Taxonomy

Categories should support at least two levels: parent category and child category. The old spreadsheet has many useful labels, but some labels are broad domains while others are meal periods, sources, people, or unresolved placeholders.

Expense category examples from the existing spreadsheet:

- Daily life: `日用`, `清潔`, `文具`, `郵費`, `禮物`
- Food: `早餐`, `午餐`, `晚餐`, `早午餐`, `宵夜`, `點心`, `水果`
- Transport and travel: `交通`
- Event spending: `登山`
- Shopping and belongings: `電子`, `服飾`, `鞋襪`, `收藏`, `園藝`
- Personal and activities: `學習`, `醫藥`, `娛樂`, `租賃`, `特殊`, `浪費`
- Temporary or unresolved labels: `0`, `?`
- Subscription examples: `AI`

Income and funding labels from the old spreadsheet should not all become flat income categories. They often include source, person, month, employer, scholarship name, reimbursement reason, or one-time event. The app should preserve the original row text during import, then optionally suggest values for the fixed income fields.

Suggested income import mapping:

- Category examples: allowance, salary, scholarship, red envelope, reward, reimbursement, interest, subsidy, government payment, original balance, unknown.
- Source examples: parent, relative, school, employer, bank, government, platform, unknown.
- Extra imported words such as month, contest, trip, certificate, or reimbursement target should be suggested as event or note only when useful.

Category requirements:

- Categories are user-editable.
- Parent and child categories can be different by transaction kind.
- The original imported label should be retained as `source_label` or import metadata when it helps audit mapping.
- Ambiguous labels such as `0` and `?` should map to unresolved or review-needed categories instead of being silently deleted.
- Refunds should keep an expense-related category so reports can subtract them from the matching spending area.
- Reports should support parent-category rollups and child-category drilldown.
- Meal-period labels such as `早餐`, `午餐`, `晚餐`, `早午餐`, `宵夜`, and `點心` can be used both as expense child categories and meal tags.
- The app should support category mapping suggestions during import, but the user must be able to keep the original label.

Recommended category cleanup:

- Merge narrow food labels under a parent like `飲食`, while keeping meal periods as child categories or meal tags.
- Keep `水果` under `飲食` unless the user wants a separate health or grocery grouping.
- Split broad labels such as `特殊` into more descriptive children instead of using it as a permanent catch-all. Existing examples suggest children such as fees, fines, deposits, tickets, gifts, treating others, religious/custom spending, and reimbursement preparation.
- Treat `浪費` as a personal review category or tag. It is useful emotionally, but reports may also need the actual spending domain.
- Treat `0` and `?` as unresolved/import-review states, not long-term report categories.
- Keep `登山` as a valid event category because the existing ledger uses it for hiking gear, clothing, food supplies, hydration, and small outdoor-use items. The app can still suggest child categories such as gear, clothing, food supply, hydration, and small tools.
- Preserve old labels as aliases so historical exports can still match the spreadsheet.

Category and tag distinction:

- A transaction can have one reporting category for accounting rollups.
- A transaction can have multiple tags for context such as activity, emotion, trip, meal period, reimbursement status, or review state.
- Event-like labels such as `登山` can use a separate event field and may also appear as category or tag when useful.
- Review-like labels such as `浪費` are better as tags unless the user explicitly wants a spending bucket named `浪費`.

Events are optional grouping concepts for records that cross normal categories. An event can group expenses, income, funding, and transfers related to the same real-world purpose, such as hiking purchases, a trip, a certification exam, a competition, or reimbursable work. Unlike category, it does not need to be the reporting bucket; it can group equipment, food, transport, deposits, fees, reimbursements, and funding under one real-world event.

Import cleanup examples:

- `登山`: keep as an event grouping; optionally suggest children like `登山 > 裝備`, `登山 > 服飾`, `登山 > 補給`, `登山 > 工具`.
- `特殊`: suggest migration into clearer categories such as `手續費`, `罰款`, `訂金`, `門票`, `禮物`, `請客`, `宗教習俗`, `報銷準備`, or `其他`.
- `AI`: use a normal category such as `訂閱 > AI` for clear AI tools or subscription transactions.
- `浪費`: keep the note explaining why it was wasteful, and optionally add a normal category so spending reports remain useful.

