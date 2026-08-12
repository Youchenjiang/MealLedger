# ADR 0006: Unified Bottom Navigation Bar

## Status

Accepted

## Context

The original app shell shipped two navigation structures: a left sidebar on
desktop and a top five-item tab row on narrow screens, maintained as two
separate media-query blocks in `src/styles.css`. MealLedger's primary use case
is capturing expenses from a phone, so mobile is not a secondary layout to
bolt on; it is the main surface. Maintaining two structures duplicated nav
state, split UI tests across desktop and mobile selectors, and made the mobile
experience feel like an afterthought.

The previous nav items were Overview (`/`), Ledger (`/ledger`), Capture
(`/capture`), Workspace/Settings (`/settings`), and Cloud & account
(`/account`).

## Decision

Replace the sidebar and top tab row with a single fixed bottom navigation bar
used at every viewport width:

- Five equal-width items: 概覽 (Overview), 明細 (Ledger), 新增 (Add, the
  center item), 專區 (Zone), 設定 (Settings).
- The center 新增 item is a raised circular "+" button in the primary color,
  visually dominant, and links to `/capture`.
- On wide screens the bottom bar stays and the content area is capped at a
  readable max width.
- `/account` remains as a route but is removed from the navigation; it is
  reached from the Settings page.
- 專區 is reserved as a tab but intentionally shows an empty-state placeholder
  until its content (meals, photos, scan sources as a feed) is decided.

## Consequences

Becomes easier:

- One navigation structure to style, test, and reason about; mobile and
  desktop behave identically.
- The center "+" makes the primary capture action always one tap away.
- 專區 can be filled in later without another navigation restructure.

Becomes harder:

- Desktop loses the sidebar, so wide-screen users must use the bottom bar and
  a capped content width.
- `/account` is no longer directly reachable from navigation; discoverability
  depends on the Settings entry point.
- Navigation labels are now Chinese (概覽/明細/新增/專區/設定), so UI tests
  must target those labels.

## References

- [App shell requirements](../specs/app-shell/requirements.md)
- [Voice capture plan](../product/voice-capture-plan.md)
- `src/App.tsx`
- `src/styles.css`
