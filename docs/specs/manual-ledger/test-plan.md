# Manual Ledger Test Plan

Manual ledger is high accounting risk. Acceptance cases should exist before implementation of each record kind.

## Common Form Behavior

Test changing kind updates required fields.

Test saving with missing required fields is blocked.

Test cancel with dirty form asks whether to discard, keep draft, or continue editing.

Test offline save marks record local-only.

Test queued offline save keeps stable idempotency key across retries.

## Expense

Test expense requires date, account, amount, merchant, item name or description, and category.

Test merchant missing checkbox fills fixed missing-merchant label.

Test item/name missing checkbox fills fixed missing-item label.

Test blank merchant without missing checkbox fails validation.

Test blank item/name without missing checkbox fails validation.

## Income

Test income requires date, account, amount, category, and source.

Test new category can be created inline or queued for creation.

Test new source can be created inline or queued for creation.

Test saved income affects income reports.

## Fund Addition And Adjustment

Test fund addition requires date, account, amount, and source.

Test fund addition changes balance without affecting income totals.

Test adjustment requires date or period, account, amount, and reason.

Test positive adjustment changes balance without affecting income totals.

Test negative adjustment changes balance without affecting expense totals.

## Transfer

Test same-currency transfer requires date, source account, destination account, and amount.

Test same-currency transfer does not require target amount.

Test cross-currency transfer requires source amount and destination amount.

Test transfer does not affect income or expense totals.

Test transfer fee creates separate linked fee expense.

Test transfer fee can use a third account and third currency.

## Refund And Payback

Test refund requires date, account, amount, category, and merchant/source or linked expense.

Test refund can use a different account than original expense.

Test partial refund links to original expense.

Test multiple refunds can link to one original expense.

Test one refund can link to multiple original expenses.

Test payback saves as refund subtype payback.

Test excess refund requires explicit classification before save.

## Unresolved Expense

Test unresolved expense requires account, amount, and time precision.

Test day precision requires date.

Test month precision requires period start and period end.

Test period precision requires period start and period end.

Test unresolved expense counts as spending under placeholder category.

Test completing all expense fields prompts conversion to expense.

Test conversion preserves stable id and audit history.

## Suggestions

Test typing merchant shows matching merchants and recent related records.

Test typing item/name shows related merchant, amount, account, category, event, and tags.

Test accepting a suggestion applies only selected fields.

Test clearing a suggestion clears only that field.

Test suggestions do not silently set amount, account, kind, recurrence, or official save behavior.

## Recurrence

Test current-cycle-only saves one official record with no future reminder.

Test prompt-next-cycle creates recurrence reminder metadata.

Test auto-record is disabled when amount is missing or variable.

Test auto-record is enabled only when all future-required fields are known.

Test recurrence can apply to expense, income, and transfer.

## Accessibility And Layout

Test all fields have labels.

Test keyboard navigation reaches all required controls.

Test mobile layout has no overlapping fields.

Test long Traditional Chinese labels remain readable.
