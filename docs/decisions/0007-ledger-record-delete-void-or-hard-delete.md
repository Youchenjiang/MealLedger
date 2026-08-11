# ADR 0007: Ledger Record Delete Defaults to Void, with Optional Hard Delete

## Status

Accepted

## Context

Ledger records are money rows with accounting meaning. Deleting one outright
removes it from history, balances, exports, and audit — which makes accounting
state hard to reconstruct or review later. The project already has a
void/soft-delete concept (voided rows stay stored but are excluded from
balances and reports). Users, however, sometimes want a row actually gone
(mistakes, data cleanup).

Two behaviors were in tension:

- **Void** keeps the row, marks it voided, and excludes it from balances and
  reports. History and audit survive.
- **Hard delete** removes the row and its bundle children entirely.

## Decision

Delete in the ledger UI defaults to **void**: the record stays in storage,
marked voided, and is excluded from balances and reports.

A Settings switch (stored in localStorage) can change the delete action to
**hard delete**, which removes the record directly. The ledger row's delete
action executes whichever behavior is currently configured.

## Consequences

Becomes easier:

- The default path preserves history and audit, keeping accounting consistent
  for everyone by default.
- Users who want real removal get it without changing the default for
  everyone.

Becomes harder:

- Hard delete is irreversible; when enabled, a mistake removes the row for
  good.
- The delete action's meaning now depends on user configuration, so the UI
  must surface the active behavior and tests must cover both modes.

Follow-up work:

- The Settings switch lands with the settings restructure
  ([settings-restructure-plan](../product/settings-restructure-plan.md));
  the ledger row delete action consumes it
  ([ledger-row-compact-plan](../product/ledger-row-compact-plan.md)).

## References

- [Ledger row compact plan](../product/ledger-row-compact-plan.md)
- [Settings restructure plan](../product/settings-restructure-plan.md)
- [Accounting rules](../v1/accounting-rules.md)
