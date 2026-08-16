# Settings Tasks

Status key: `[x]` implemented, `[ ]` planned (Phase 4 restructure).

## Voice/AI Entity Policy (ADR 0012)

- [x] Add the entity policy section (accounts/categories, three options,
      default existing-only) to the Settings page.
- [x] Persist the choice in localStorage (`mealledger.ai.entity-policy`) and
      apply it to the AI panel and voice-capture modes.
- [x] Cover the policy options and persistence in unit tests.

## Settings Restructure (Phase 4)

- [ ] Split the Settings page into in-page sections 登入 / 匯入匯出 / 類別 /
      相關設定 and move `/account` content into 登入; remove the standalone
      `/account` route (or reduce it to an anchor).
- [ ] Consolidate category/tag/alias management into the 類別 section from
      the Capture page.
- [ ] Add the theme control (深色 default / 淺色 / 跟隨系統) via CSS variables,
      persisted in localStorage and applied before first paint.
- [ ] Add the delete-behavior switch (作廢 default / 真正刪除) per ADR 0007;
      the ledger row delete action consumes it (ledger-row-compact plan).
- [ ] Add the negative-balance policy switch (default off) per ADR 0008 and
      validate the write path when enabled.
- [ ] Merge `/settings/localization` preferences into 相關設定.
- [ ] Update app-shell and e2e selectors for the new sections; add theme and
      policy toggle tests.
- [ ] Run typecheck, full tests, build, and e2e gates.

## References

- [Settings requirements](requirements.md)
- [Settings design](design.md)
- [Settings test plan](test-plan.md)
