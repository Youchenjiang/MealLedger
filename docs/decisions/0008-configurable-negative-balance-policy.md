# ADR 0008: Negative Balance Policy Is Configurable and Off by Default

## Status

Accepted

## Context

MealLedger's accounting rules allow editable accounts to go negative
(「允許負餘額」), matching the spreadsheet baseline a user imports. Some
users want an overdraft-style guard: an editable account should not drop
below zero.

## Decision

Add a user-configurable setting (Settings > 相關設定) that controls whether
editable accounts may hold a negative balance:

- **Off by default** — preserves the current allow-negative model and stays
  consistent with the accounting rules.
- When enabled, expenses and balance adjustments that would push an editable
  account below zero are rejected.

## Consequences

Becomes easier:

- Users who want the guard can opt in without changing the default accounting
  model.
- Default behavior is unchanged for existing users.

Becomes harder:

- The write path must validate the policy when enabled, and accounting
  acceptance cases need to cover both modes.

Follow-up work:

- The setting lands with the settings restructure
  ([settings-restructure-plan](../product/settings-restructure-plan.md)).

## References

- [Settings restructure plan](../product/settings-restructure-plan.md)
- [Accounting rules](../v1/accounting-rules.md)
