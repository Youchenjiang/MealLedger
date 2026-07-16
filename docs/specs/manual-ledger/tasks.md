# Manual Ledger Tasks

## Current Implementation Boundary

The current branch implements the first local Manual Ledger slice. Valid manual entries create official local-only records, persist in browser storage, preserve audit events, expose stable idempotency keys, support local edit/void lifecycle actions, project per-account reports, represent explicitly unavailable expense merchant/item fields with fixed system labels, store recurrence intent with local pause/resume/cancel controls, convert unresolved expenses in place while preserving record identity, provide selectable inline-created income/funding sources, validate CSV files, preview legacy header mappings, classify rows and ambiguous category aliases for review, confirm valid CSV rows through the shared official-record boundary, and offer clean CSV/JSON plus multi-table ZIP exports without media bytes. The Capture shell now uses a compact intent picker, direct camera capture plus gallery multi-select for meals, and account sign-out is available from Settings rather than every page header. Cloud sync, scheduled next-cycle generation, durable cross-device review state, media workflows, and advanced debt tracking remain outside this slice.

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

Status: Partial. Expense and income records save locally as official records, history suggestions are available, explicitly unavailable expense merchant/item fields use fixed labels and persisted flags, and income/funding sources can be selected or created inline. Richer category management remains.

Add expense and income validation, fixed missing merchant/item controls, and inline category/source creation.

Expected verification:

- Expense and income acceptance cases pass, including fixed missing-value labels and rejection of arbitrary replacements.
- Income and funding source options can be selected or added inline and persist locally.

## Task 4: Implement Fund Addition And Adjustment Forms

Status: Complete for the current local report boundary. The local form, local official-save boundary, persisted account setup, and per-account report projection exist.

Add fund addition and adjustment flows with report-safe labels and required reasons.

Expected verification:

- Fund additions do not appear as income in test fixtures.
- Adjustments do not appear as income or expense.

## Task 5: Implement Transfer Form

Status: Complete for the current local report boundary. The local form supports source/destination selection, same/cross-currency amounts, and fee input. The domain boundary creates a linked fee expense and reports transfer legs separately.

Add same-currency and cross-currency transfer input, including optional fee entry.

Expected verification:

- Same-currency and cross-currency transfer cases pass.
- Fee entry creates linked fee expense behavior in domain tests or mocked save payload.

## Task 6: Implement Refund And Payback Form

Status: Complete for the current local settlement boundary. Refund fields save locally as official records, including payback subtype, multiple linked expenses, combined excess classification, different refund accounts, and report treatment as negative spending plus cash inflow. Full debt tracking and reminders remain outside this slice.

Add refund flow, payback subtype, linked expense selection placeholder, and excess refund warning.

Expected verification:

- Partial refund, payback, different refund account, and excess refund cases pass.

## Task 7: Implement Unresolved Expense Flow

Status: Complete for local unresolved-expense capture and conversion. Day, month, and period records save locally; completion converts the same record ID to an expense with a versioned audit event.

Add time precision, day/month/period inputs, and an in-place conversion editor.

Expected verification:

- Day and period unresolved expense cases pass.
- Conversion preserves the record ID and rejects incomplete completion details.

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

Status: Partial. Local-only save state, browser persistence, audit events, idempotency key creation, and local lifecycle actions are implemented. Cloud retry transport and cross-device conflict resolution remain outside this slice.

Expected verification:

- Repeated queued save keeps the same key in test or mocked state.

## Task 11: Final Verification

Status: Complete for the current local-record and clean-export slice. Remaining partial tasks are explicitly cloud/media/advanced-workflow boundaries above and are not hidden by this verification.

Expected verification:

- `npm run test`
- `npm run test:coverage`
- `npm run test:e2e`
- `npm run build`
- no console errors
- accounting acceptance cases documented or automated

Current slice evidence is recorded below and must be rerun after any further Manual Ledger changes.

Latest verification for the local ledger slice:

- Verification date: 2026-07-14.
- `npm run test`: 215 tests passed across 35 files.
- `npm run test:coverage`: 81.64% statements, 73.43% branches, 82.58% functions, and 83.08% lines.
- `npm run test:e2e`: 8 browser smoke tests passed.
- `npm run build`: passed.
- `git diff --check`: passed.

The latest verification also covers explicit missing expense merchant/item fields from form validation through local official-record persistence, selectable inline-created income sources, recurrence safety and lifecycle controls, unresolved-expense conversion, CSV validation, legacy header mapping, kind-specific row review, ambiguous category alias suggestions, duplicate review actions, confirmed CSV row writes through the official-record boundary, multiple refund links, per-account multi-currency report projections, and clean CSV/JSON/multi-table ZIP export of active records while excluding voided records and media bytes/base64. ZIP export reports staged progress, and the ZIP manifest and account summary keep local-only opening balances explicit. The Playwright smoke selectors use exact labels so the missing-value checkboxes do not make input selectors ambiguous.
