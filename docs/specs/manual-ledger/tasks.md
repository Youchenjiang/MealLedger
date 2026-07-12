# Manual Ledger Tasks

## Current Implementation Boundary

The current branch implements the first local Manual Ledger slice. Valid manual entries create official local-only records, persist in browser storage, preserve audit events, expose stable idempotency keys, support local edit/void lifecycle actions, project per-account balances, represent explicitly unavailable expense merchant/item fields with fixed system labels, and store recurrence intent with local pause/resume/cancel controls. Cloud sync, scheduled next-cycle generation, and several advanced field workflows remain outside this slice.

## Task 1: Define Form State And Kind Configuration

Status: Complete for the current local record boundary.

Create record-kind configuration for fields, labels, required fields, and validation.

Expected verification:

- Unit tests or documented cases for required fields by kind.

## Task 2: Build Kind Selection And Shared Form Layout

Status: Complete for the current local-save layout.

Implement the manual entry shell with kind selection and common field components.

Expected verification:

- Browser smoke test can switch between all record kinds.

## Task 3: Implement Expense And Income Forms

Status: Partial. Expense and income records save locally as official records, history suggestions are available, and explicitly unavailable expense merchant/item fields use fixed labels and persisted flags. Inline category/source creation and richer category management remain.

Add expense and income validation, fixed missing merchant/item controls, and inline category/source creation placeholders.

Expected verification:

- Expense and income acceptance cases pass, including fixed missing-value labels and rejection of arbitrary replacements.

## Task 4: Implement Fund Addition And Adjustment Forms

Status: Partial. The local form, local official-save boundary, persisted account setup, and balance projection exist. Full report projections remain.

Add fund addition and adjustment flows with report-safe labels and required reasons.

Expected verification:

- Fund additions do not appear as income in test fixtures.
- Adjustments do not appear as income or expense.

## Task 5: Implement Transfer Form

Status: Partial. The local form supports source/destination selection, same/cross-currency amounts, and fee input. The domain boundary creates a linked fee expense; report projections remain.

Add same-currency and cross-currency transfer input, including optional fee entry.

Expected verification:

- Same-currency and cross-currency transfer cases pass.
- Fee entry creates linked fee expense behavior in domain tests or mocked save payload.

## Task 6: Implement Refund And Payback Form

Status: Partial. Refund fields save locally as official records, including payback subtype, one linked expense, and an excess-classification guard. Multiple linked expenses and full refund settlement views remain.

Add refund flow, payback subtype, linked expense selection placeholder, and excess refund warning.

Expected verification:

- Partial refund, payback, different refund account, and excess refund cases pass.

## Task 7: Implement Unresolved Expense Flow

Status: Partial. Day, month, and period unresolved records save locally. Conversion to expense remains.

Add time precision, day/month/period inputs, and conversion prompt placeholder.

Expected verification:

- Day and period unresolved expense cases pass.

## Current Lifecycle Slice

Status: Complete for local persistence and lifecycle behavior.

- Accounts and custom categories persist across reloads.
- Official records can be edited with an incremented version and `record-updated` audit event.
- Official records can be voided without hard deletion and with a `record-voided` audit event.
- Overview projects active records into per-account balances without combining currencies.

Expected verification:

- App integration tests cover reload persistence, edit, void, and audit history.
- Record domain tests cover versioning and void state transitions.

## Task 8: Add History Suggestions

Status: Complete for local merchant/item suggestions.

Add suggestion surfaces for merchant and item/name entry.

Expected verification:

- Suggestions can be accepted field by field and cleared field by field. Covered by App integration tests.

## Task 9: Add Recurrence Intent Control

Status: Complete for local recurrence intent and lifecycle controls. Scheduled generation of future records remains outside this slice.

Add recurrence choice and auto-record safety disabling.

Expected verification:

- Variable amount disables auto-record; the form falls back to prompt-next-cycle.
- Fixed complete expense, income, and transfer records allow auto-record.
- Saved recurrence intent can be paused, resumed, or cancelled locally.

## Task 10: Offline And Idempotency UI Hook

Status: Partial. Local-only save state, browser persistence, audit events, idempotency key creation, and local lifecycle actions are implemented. Cloud retry transport remains.

Expected verification:

- Repeated queued save keeps the same key in test or mocked state.

## Task 11: Final Verification

Status: In progress for the first local-record slice.

Expected verification:

- `npm run test`
- `npm run test:coverage`
- `npm run test:e2e`
- `npm run build`
- no console errors
- accounting acceptance cases documented or automated

Current slice evidence is recorded in the branch commits and must be rerun after the remaining Manual Ledger tasks are implemented.

Latest verification for the local ledger slice:

- `npm run test`: 70 tests passed.
- `npm run test:coverage`: 86.04% statements, 80.37% branches, 82.11% functions, and 85.94% lines.
- `npm run test:e2e`: 4 browser smoke tests passed.
- `npm run build`: passed.

The latest verification also covers explicit missing expense merchant/item fields from form validation through local official-record persistence, plus recurrence safety and lifecycle controls. The Playwright smoke selectors use exact labels so the missing-value checkboxes do not make input selectors ambiguous.
