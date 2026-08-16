# Settings Requirements

Status: **voice/AI entity policy (ADR 0012) implemented**; the in-page
restructure, theme, delete behavior (ADR 0007), and negative-balance policy
(ADR 0008) are planned (Phase 4 restructure).

## Purpose

Define the Settings page (`/settings` + `/account`) structure and the
user-configurable behaviors that live there. This spec is the behavior home
for [ADR 0007](../../decisions/0007-ledger-record-delete-void-or-hard-delete.md)
(delete behavior), [ADR 0008](../../decisions/0008-configurable-negative-balance-policy.md)
(negative balance policy), and [ADR 0012](../../decisions/0012-ai-capture-entity-policy-configurable.md)
(voice/AI entity policy), plus the in-page restructure that hosts them.

## Settings Structure

WHEN the user opens Settings
THE SYSTEM SHALL present the settings as in-page sections rather than a single
flat list: 登入, 匯入匯出, 類別, 相關設定.

WHEN the user opens Settings
THE SYSTEM SHALL show the account/cloud section (sign-in, sign-up, OAuth,
password reset, cloud sync status, workspace takeover) inside the 登入 section,
and remove `/account` from the bottom navigation; `/account` remains reachable
as an anchor or is merged entirely.

WHEN the user opens the 匯入匯出 section
THE SYSTEM SHALL keep the existing import/export tab behavior (CSV/JSON/ZIP
export, CSV import review).

WHEN the user opens the 類別 section
THE SYSTEM SHALL offer category/tag/alias management there, consolidating the
category creation that previously lived scattered in the Capture page.

## Related Settings (相關設定)

### Account Management

WHEN the user opens the 相關設定 section
THE SYSTEM SHALL offer account management (rename, type, balance adjustment)
there; the Overview page keeps quick-add and review only.

### Theme

WHEN the user opens the theme control
THE SYSTEM SHALL offer 深色 / 淺色 / 跟隨系統, defaulting to 深色.

WHEN the user changes the theme
THE SYSTEM SHALL apply it through CSS variables and persist the choice in
localStorage.

### Delete Behavior (ADR 0007)

WHEN the user opens the delete behavior control
THE SYSTEM SHALL offer 作廢 (default) or 真正刪除, persisted in localStorage.

WHEN the delete behavior is 作廢
THE SYSTEM SHALL keep deleted ledger records stored, marked voided, and
excluded from balances and reports.

WHEN the delete behavior is 真正刪除
THE SYSTEM SHALL remove the ledger record and its bundle children entirely,
and the ledger UI SHALL surface that the action is irreversible.

WHEN the user deletes a ledger record
THE SYSTEM SHALL execute the currently configured behavior (the ledger row
delete action consumes this setting).

### Negative Balance Policy (ADR 0008)

WHEN the user opens the negative balance control
THE SYSTEM SHALL offer whether editable accounts may hold a negative balance,
defaulting to allowed (off), consistent with the accounting rules.

WHEN the policy is enabled
THE SYSTEM SHALL reject expenses and balance adjustments that would push an
editable account below zero, and SHALL surface the reason in the UI.

### Voice/AI Entity Policy (ADR 0012)

WHEN the user opens the voice/AI preferences
THE SYSTEM SHALL show one row per entity type — accounts and categories first,
extensible to future types — each offering 只能歸類到現有 (default) / 詢問是否
新增 / 直接新增.

WHEN the user changes an entity policy option
THE SYSTEM SHALL persist it locally and apply it to both the AI panel and the
voice-capture modes on the next capture.

### Localization

WHEN the user opens the localization control
THE SYSTEM SHALL merge the `/settings/localization` preferences into the
相關設定 section (localization behavior itself follows the
[localization spec](../localization/requirements.md)).

## Persistence And Boundaries

WHEN the user changes any related setting
THE SYSTEM SHALL persist the choice in localStorage under a namespaced key and
apply it to subsequent behavior without a server round trip.

WHEN the app is offline
THE SYSTEM SHALL keep all related settings usable and persisted locally.

- Settings changes never rewrite existing ledger records; delete behavior and
  negative balance policy apply to writes and deletes made after the change.
- The negative balance policy does not change the accounting model for
  existing records; it only gates new expenses and balance adjustments when
  enabled.

## References

- [Settings restructure plan](../../product/settings-restructure-plan.md)
- [Ledger row compact plan](../../product/ledger-row-compact-plan.md)
- [ADR 0007](../../decisions/0007-ledger-record-delete-void-or-hard-delete.md)
- [ADR 0008](../../decisions/0008-configurable-negative-balance-policy.md)
- [ADR 0012](../../decisions/0012-ai-capture-entity-policy-configurable.md)
- [Accounting rules](../../v1/accounting-rules.md)
- [Auth requirements](../auth/requirements.md)
