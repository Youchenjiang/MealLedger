# 設定分區計畫（Phase 4）

狀態：**計畫，尚未實作**（分支 `feature/settings-restructure`，預期獨立 PR）。本文件為版面重構（底部導覽決策見 [ADR 0006](../decisions/0006-unified-bottom-navigation.md)）中設定頁（Phase 4）的拆分細節。

---

## 1. 目標

設定頁（現 `/settings` + `/account`）改為頁內分區（tab 或區塊標題）：

1. **登入（已定案）**：登入/註冊/OAuth、密碼重設、雲端同步狀態、工作區接管——**由現 `/account` 頁（Cloud & account）併入設定**，不再有獨立的「雲端與帳號」tab；`/account` route 一併移除（或改為設定內的錨點）。
2. **匯入匯出**：CSV/JSON/ZIP 匯出、CSV 匯入審核——沿用現 Import & export tab。
3. **類別**：分類/標籤/別名管理（目前分類建立散在新增頁，收攏集中管理）。
4. **相關設定**：
   - 帳戶管理（改名、類型、餘額調整）
   - **主題切換（已定案）**：預設**深色**（對齊參考圖），可切換「深色 / 淺色 / 跟隨系統」；用 CSS 變數實作，儲存選擇於 localStorage
   - **刪除行為（已定案）**：預設作廢，可改真正刪除（行為由[明細列緊湊化計畫](ledger-row-compact-plan.md)消費）
   - **負餘額政策（已定案）**：供使用者選擇是否讓可編輯帳戶**不允許負餘額**；預設不開啟，維持現行「允許負餘額」行為，與 [docs/v1/accounting-rules.md](../v1/accounting-rules.md) 一致；開啟後可編輯帳戶餘額不得為負
   - 本地化（`/settings/localization` 併入）、其他偏好

## 2. 影響範圍

| 檔案 | 預期變動 |
|---|---|
| `src/types.ts` | 移除 `account` route（併入設定） |
| `src/App.tsx` | 設定頁分區（登入/匯入/類別/相關設定）；`/account` 併入或改錨點；負餘額政策設定存 localStorage（關聯帳戶的 `allowNegativeBalance`）；刪除行為設定存 localStorage |
| `src/styles.css` | 改為 CSS 變數主題（預設深色 + 淺色/跟隨系統切換）；設定分區樣式 |
| `src/App.test.tsx`、`src/App.auth.test.tsx`、`tests/e2e/app-shell.spec.ts` | 帳戶頁選擇器改為設定內分區；新增主題/政策開關測試 |

## 3. 已定案

- 「Cloud & account」併入設定的「登入」區，移除獨立 `/account` tab（Phase 1 已把 `/account` 移出底部導覽，本階段完成合併）。
- **預設深色主題**，可在設定切換「深色 / 淺色 / 跟隨系統」。
- **帳戶管理**留在設定的「相關設定」；概覽只做快速新增與檢視。
- **刪除行為可設定**：預設作廢，可在設定改為真正刪除（決策已寫入 [ADR 0007](../decisions/0007-ledger-record-delete-void-or-hard-delete.md)）。
- **可編輯帳戶的負餘額政策可設定**：設定「相關設定」提供選項；**預設不開啟**（維持「允許負餘額」模型，與 [docs/v1/accounting-rules.md](../v1/accounting-rules.md) 一致）；開啟後可編輯帳戶餘額不得為負（支出或餘額調整不得使餘額低於 0）（決策已寫入 [ADR 0008](../decisions/0008-configurable-negative-balance-policy.md)）。

## 4. 驗證

`npm run typecheck`、`npm test`、`npm run build`、`npm run test:e2e`；深/淺色主題切換與負餘額政策開關各補測試。
