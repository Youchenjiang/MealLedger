# 版面重構計畫：底部導覽列 + 專區（Phase 1 + Phase 5）

狀態：**已實作**（分支 `feature/navigation-restructure`）。本文件只涵蓋**底部導覽列**（Phase 1）與**專區占位頁**（Phase 5）；明細、口說、設定的重構各自獨立成檔：

- [明細列緊湊化計畫](ledger-row-compact-plan.md)（Phase 2）
- [口說新增計畫](voice-capture-plan.md)（Phase 3）
- [設定分區計畫](settings-restructure-plan.md)（Phase 4）

密碼重設 recovery 壞掉的問題已由 `fix/password-reset-recovery`（PR #15）修復合入，見[密碼重設修復紀錄](../engineering/password-reset-recovery-fix.md)。

---

## 1. 目標

- 選單從側邊欄改到**底部**，五個按鈕依序為：**概覽、明細、新增、專區、設定**。
- 「新增」為中央的「+」圓鈕（主視覺、比其他按鈕更突出），指向現 `/capture`。
- 桌面與窄螢幕統一使用底部導覽列（「選單擺底下」）；桌面寬度時可限制內容最大寬度維持可讀性。

## 2. 目標版面

```
┌──────────────────────────────┐
│ 頁首：頁面標題 · 狀態列        │
├──────────────────────────────┤
│                              │
│        內容區                 │
│   （各頁內容，見對應文件）      │
│                              │
├──────────────────────────────┤
│ 概覽  明細  (+) 專區  設定     │ ← 固定底部導覽列
└──────────────────────────────┘
```

- 底部導覽列固定於視窗底部，五格等寬，中央「新增」為凸起圓形「+」按鈕（主色）。
- 內容區底部預留 padding，避免被導覽列遮住。

## 3. 現況盤點（2026-08）

| 項目 | 現況 |
|---|---|
| 導覽結構 | 桌面：左側邊欄；窄螢幕：頂部五格橫排（`src/styles.css` 兩組 media query） |
| 導覽項目 | Overview (`/`)、Ledger (`/ledger`)、Capture (`/capture`)、Workspace→Settings (`/settings`)、Cloud & account (`/account`) |
| 帳戶/登入 | 獨立 `/account` 頁，由設定頁的「Manage cloud access」進入 |
| 測試 | `src/App.test.tsx`、`src/App.auth.test.tsx`、`tests/e2e/app-shell.spec.ts` 依賴舊導覽按鈕名稱 |

## 4. 各頁內容規劃

### 4.1 概覽（對應現 `/`，Phase 1 原樣歸位）

Phase 1 只做「原樣歸位」，概覽內容不動。

已定案的**後續**概覽卡片（待排期，不在 Phase 1/5 範圍）：帳戶名稱、幣別、目前餘額（大字）＋ 本月支出（一行小字），多幣別依幣別分組，不把不同幣別加總；點卡片跳該帳戶明細。帳戶管理（改名、類型、餘額調整）留在設定的「相關設定」（見[設定分區計畫](settings-restructure-plan.md)），概覽只做快速新增與檢視。

### 4.2 專區（Phase 5，已定案：先空著）

底部導覽列保留「專區」tab，但**不掛任何內容**，顯示空狀態佔位頁（「此區尚未開放」）。

未來候選內容（暫不決定）：餐點記錄、照片、掃描來源集中成 feed。等內容有共識後再填入，不影響其餘四個 tab。

## 5. 影響範圍（Phase 1 + Phase 5）

| 檔案 | 預期變動 |
|---|---|
| `src/types.ts` | `AppRoute` 新增 `zone`；`NavItem.label` 改為中文標籤（概覽/明細/新增/專區/設定） |
| `src/App.tsx` | `navItems` 重排（概覽/明細/新增/專區/設定）；`Sidebar` 改為 `BottomNav`（含中央 + 圓鈕）；`/account` 移出導覽（保留 route，從設定進入）；新增 `ZonePage` 占位頁 |
| `src/styles.css` | 移除側邊欄樣式；新增固定底部導覽列 + 中央凸起圓鈕；內容區底部留 padding |
| `src/App.test.tsx`、`src/App.auth.test.tsx`、`tests/e2e/app-shell.spec.ts` | 導覽按鈕名稱全部更新（中文標籤）；帳戶頁改經設定進入 |

## 6. 已定案（本分支範圍）

- 「專區」先空著（空狀態佔位頁，不掛內容）。
- 導覽五 tab：概覽、明細、新增（中央 + 圓鈕）、專區、設定；`/account` 移出導覽但保留 route。

## 7. 驗證

每階段：`npm run typecheck`、`npm test`、`npm run build`、`npm run test:e2e`。Phase 1 完成時 351 單測、11 e2e 全綠，並以瀏覽器實測底部導覽與專區頁。
