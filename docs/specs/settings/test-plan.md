# Settings Test Plan

## Unit Tests

- The entity policy reads the persisted value and falls back to the default
  (existing-only) when unset or malformed; writing an option round-trips
  through localStorage.
- Delete behavior defaults to 作廢 and reads the configured value; the ledger
  delete action executes the configured behavior in both modes.
- Negative balance policy, when enabled, rejects an expense or balance
  adjustment that pushes an editable account below zero with a readable
  reason, and allows the same write when disabled or when the balance stays
  non-negative.
- Theme resolution maps 深色 / 淺色 / 跟隨系統 to the expected CSS variable set
  and persists the choice.

## App Integration

- The entity policy radios (只能歸類到現有 / 詢問是否新增 / 直接新增) render one
  row per entity type and the persisted JSON matches the selection.
- The Settings page shows the sections 登入 / 匯入匯出 / 類別 / 相關設定; the
  account content (sign-in, cloud sync status) is reachable from the 登入
  section and `/account` is no longer a bottom-nav item.
- Hard delete mode surfaces the irreversibility in the delete flow; void mode
  keeps the row excluded from balances and reports.
- Theme switch applies the theme immediately and survives a reload; no flash
  of the wrong theme on load.

## Gates

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run test:e2e`
- `git diff --check`
