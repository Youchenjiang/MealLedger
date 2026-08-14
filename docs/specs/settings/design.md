# Settings Design

## Current State

- `/account` is a separate route (Cloud & account) reachable from Settings; it
  holds sign-in, OAuth, password reset, cloud sync status, and workspace
  takeover.
- The voice/AI entity policy section (accounts and categories, three options
  each) is already implemented in the current Settings page and persisted to
  localStorage under `mealledger.ai.entity-policy` (see
  [ADR 0012](../../decisions/0012-ai-capture-entity-policy-configurable.md)).
- The in-page restructure, theme switch, delete-behavior switch, and negative
  balance switch are **planned** (Phase 4, per the settings restructure plan).

## In-Page Sections

Settings becomes one page with sections:

1. 登入 — the current `/account` content moves here; `/account` route is
   removed or reduced to an anchor.
2. 匯入匯出 — existing import/export tab behavior.
3. 類別 — category/tag/alias management consolidated from the Capture page.
4. 相關設定 — account management, theme, delete behavior, negative balance
   policy, voice/AI entity policy, localization, other preferences.

## Theme

- CSS-variable driven; 深色 is the default, options 深色 / 淺色 / 跟隨系統.
- Persisted in localStorage; applied at app load before first paint to avoid
  a flash of the wrong theme.

## Delete Behavior (ADR 0007)

- Stored in localStorage (e.g. `mealledger.settings.delete-action`).
- The ledger row's delete action reads this setting each time; the UI labels
  or confirms the irreversible hard-delete path when enabled.
- 作廢 keeps the row stored with voided state (existing void semantics);
  真正刪除 removes the record and its bundle children.

## Negative Balance Policy (ADR 0008)

- Stored in localStorage (e.g. `mealledger.settings.allow-negative-balance`).
- When enabled, the write path validates that an expense or balance
  adjustment does not push an editable account below zero and rejects with a
  readable reason.
- Validation lives in the same boundary that rejects writes today so both
  modes are tested at the same place; it never rewrites existing records.

## Voice/AI Entity Policy (ADR 0012)

- Persisted as `mealledger.ai.entity-policy` with one option per entity type;
  default `existing` for accounts and categories.
- Read by the AI panel and both voice-capture modes at parse/confirm time;
  entity creation happens only as part of the confirmed write (ADR 0003).

## Persistence

All related settings live in localStorage behind the existing replaceable
storage adapter, so they stay usable offline and migrate with the PWA. No new
server schema is required.

## Rejected Alternatives

- Keeping `/account` as a separate tab: rejected because the bottom nav has
  five fixed items and account management is a settings concern (ADR 0006).
- Server-persisted settings: rejected for V1 — settings are device-local
  preferences and sync is a later concern.

## References

- [Settings restructure plan](../../product/settings-restructure-plan.md)
- [Ledger row compact plan](../../product/ledger-row-compact-plan.md)
- [ADR 0007](../../decisions/0007-ledger-record-delete-void-or-hard-delete.md)
- [ADR 0008](../../decisions/0008-configurable-negative-balance-policy.md)
- [ADR 0012](../../decisions/0012-ai-capture-entity-policy-configurable.md)
- [Localization spec](../localization/requirements.md)
