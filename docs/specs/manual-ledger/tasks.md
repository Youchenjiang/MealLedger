# Manual Ledger Tasks

## Task 1: Define Form State And Kind Configuration

Create record-kind configuration for fields, labels, required fields, and validation.

Expected verification:

- Unit tests or documented cases for required fields by kind.

## Task 2: Build Kind Selection And Shared Form Layout

Implement the manual entry shell with kind selection and common field components.

Expected verification:

- Browser smoke test can switch between all record kinds.

## Task 3: Implement Expense And Income Forms

Add expense and income validation, missing merchant/item controls, and inline category/source creation placeholders.

Expected verification:

- Expense and income acceptance cases pass.

## Task 4: Implement Fund Addition And Adjustment Forms

Add fund addition and adjustment flows with report-safe labels and required reasons.

Expected verification:

- Fund additions do not appear as income in test fixtures.
- Adjustments do not appear as income or expense.

## Task 5: Implement Transfer Form

Add same-currency and cross-currency transfer input, including optional fee entry.

Expected verification:

- Same-currency and cross-currency transfer cases pass.
- Fee entry creates linked fee expense behavior in domain tests or mocked save payload.

## Task 6: Implement Refund And Payback Form

Add refund flow, payback subtype, linked expense selection placeholder, and excess refund warning.

Expected verification:

- Partial refund, payback, different refund account, and excess refund cases pass.

## Task 7: Implement Unresolved Expense Flow

Add time precision, day/month/period inputs, and conversion prompt placeholder.

Expected verification:

- Day and period unresolved expense cases pass.

## Task 8: Add History Suggestions

Add suggestion surfaces for merchant and item/name entry.

Expected verification:

- Suggestions can be accepted field by field and cleared field by field.

## Task 9: Add Recurrence Intent Control

Add recurrence choice and auto-record safety disabling.

Expected verification:

- Variable amount disables auto-record.
- Fixed complete record allows auto-record.

## Task 10: Offline And Idempotency UI Hook

Add local-only save state and idempotency key creation boundary.

Expected verification:

- Repeated queued save keeps the same key in test or mocked state.

## Task 11: Final Verification

Run final verification before PR.

Expected verification:

- `npm run build`
- browser smoke test
- no console errors
- accounting acceptance cases documented or automated
