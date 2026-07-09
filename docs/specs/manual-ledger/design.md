# Manual Ledger Design

## Experience Goals

Manual entry should feel fast for repeated daily spending while still protecting accounting correctness.

The form should help with history-based suggestions, but the user remains in control. Suggestions never silently become official records.

The workflow should support the old spreadsheet's coverage without forcing photos, meals, scans, or imports.

## Entry Modes

Manual ledger entry starts from record kind:

- expense
- income
- transfer
- refund
- fund addition
- adjustment
- unresolved expense

The UI can use segmented controls or tabs for kind selection. Each kind should have a focused form rather than one giant all-purpose form.

## Shared Field Model

Common fields:

- local date and optional time
- timezone or offset when available
- account
- amount
- currency
- category when applicable
- source or merchant when applicable
- item name or description when applicable
- tags
- event
- source label for imported or migrated context

The implementation should keep field components reusable, but kind-specific validation must remain explicit.

## Validation

Validation should happen before official save.

Validation rules should come from the accounting rules, not from UI convenience.

Missing merchant and missing item/name are explicit states, not blank strings.

Currency precision validation happens at input boundary.

## Suggestions

Suggestion sources:

- merchant history
- item/name history
- category history
- account history
- amount history
- event and tag history
- recurrence history

Suggestions should be stored in local component state until accepted. They should not mutate the draft form silently.

Suggested fields should be shown as light placeholder or suggestion chips. The user can accept one field, accept a group, or clear a suggested field.

## Save Behavior

Manual save creates an official record immediately when validation passes.

Offline save creates a local official-intent record queued for sync. It should be visibly local-only until cloud persistence succeeds.

Idempotency key is created when the save action enters the queue.

## Editing Behavior

Editing an official record should preserve audit history.

Editing kind is allowed only when the resulting record satisfies the target kind's required fields. For unresolved expense conversion, preserve the same stable id.

Soft delete and void are separate actions and should not be hidden under the same button.

## Recurrence

The recurrence control appears after core fields are valid enough to evaluate recurrence safety.

Options:

- current cycle only
- prompt next cycle
- auto-record next cycle

Auto-record is disabled unless amount and all future-required fields are known.

## Shared Payment

V1 uses tags and refund subtype for shared-payment support.

When marking an expense as paid for others, the UI should suggest `代墊` or `待還款` tags.

When recording friend payback, the UI should use refund flow with `refund_subtype=payback` and optional link to original expense.

## Boundaries

This spec does not define physical database tables. Schema details belong in the schema-core spec.

This spec does not implement scan/import/media workflows.

This spec does not implement full debt tracking, budget limits, credit-card statement cycles, or provider sync.

## References

- [Accounting rules](../../v1/accounting-rules.md)
- [Data lifecycle](../../v1/data-lifecycle.md)
- [Technical operations](../../v1/technical-ops.md)
- [Product requirements](../../product/product-requirements.md)
