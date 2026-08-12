# 模式 A 整段口說 — 實作藍圖

狀態：**分支 `feature/voice-capture` 的實作藍圖**。上游決策見
[voice-capture-plan](voice-capture-plan.md)、[ADR 0009](../decisions/0009-voice-capture-two-modes.md)、
[ADR 0010](../decisions/0010-mode-b-defaults-to-ai-correction.md)、
[ADR 0012](../decisions/0012-ai-capture-entity-policy-configurable.md)、
[ADR 0003](../decisions/0003-draft-first-ai-and-import-suggestions.md)。
模式 B 的藍圖見 [mode-b-blueprint](mode-b-blueprint.md)。

---

## 1. 現況 vs 目標

模式 A 的「一次念完整筆」功能已上線（PR #20）：輸入 → AI 解析 → **建議卡**
（`SuggestionCard`，一行式摘要 + 確認寫入/存草稿/填入表單）。但
voice-capture-plan §3 定義的模式 A 面貌是「**自動填入對應欄位區塊 → 使用者
逐欄確認後存檔**」——現況的卡片不是欄位區塊，逐欄確認也未做。

本藍圖：把模式 A 的**呈現層**從建議卡改為**欄位區塊逐欄確認**，與模式 B
共用同一套欄位區塊視覺與確認流程。**輸入、解析、確認邊界、實體政策全部
不動**——只換「草稿長什麼樣、怎麼確認」。

## 2. 共用欄位區塊元件（新檔 `src/ai/fieldBlocks.tsx`）

模式 B 已在 `ModeBPanel` 內建欄位區塊（`.mode-b-fields`）。模式 A 需要
同樣的視覺語言，因此把區塊抽成共用元件，兩個面板都用：

```tsx
// 每筆草稿的欄位區塊群
<FieldBlockGroup
  fields={[{ field, label, value, inferred, pending, newEntity }]}
  editField="date"            // 目前編輯中的欄位（可為 null）
  onEdit={(field) => void}    // 點區塊進入編輯
  onFieldChange={(field, value) => void}
/>
```

- 區塊狀態：`filled`（有值）/ `current`（正在編輯）/ `pending`（待填）。
- 每個區塊可**就地編輯**（click 進編輯、改值、blur/Enter 完成）。
- 推論標記（虛線底線）、新實體徽章（帳戶/類別尚不存在）沿用現有
  `InferredSpan` / `NewEntityTag`。
- 轉帳草稿額外顯示 `transferAccount` 區塊（比照模式 B 的動態步驟）。

**樣式**：`.mode-b-fields` 等更名為共用 `.field-blocks`（或保留 `.mode-b-*`
但加上 `.mode-a-*` 共用 alias）；ModeBPanel 一併改用共用元件（小 refactor）。

## 3. 模式 A 流程（改 `src/ai/AiLedgerPanel.tsx` 的呈現）

```
輸入（文字/語音/照片）
  → requestAiJson → parseDraftSuggestions（不動）
  → 每筆 suggestion 渲染為一組欄位區塊（取代 SuggestionCard）
  → 使用者逐欄點擊檢查/修改（「逐欄確認」= 逐欄檢視 + 就地編輯）
  → 確認存檔（沿用 confirmSuggestion / resolveAndPersist / 實體政策）
```

- **單筆或多筆**：每筆 suggestion 一組欄位區塊，各自獨立確認（比照現況
  多張卡片）。多筆時區塊群之間以分隔與標題「第 1 筆 / 第 2 筆」區分。
- **無效草稿**（`draft === null`）：保留現況——issues 清單 + 填入表單，
  不顯示欄位區塊（無從填入）。
- **確認按鈕**：每一組欄位區塊底部「確認存檔」（沿用 `confirmSuggestion`）
  + 「存草稿」「填入表單」輔助動作（現況行為保留）。
- **ask 政策對話**：沿用 `AskNewEntitiesDialog`（新實體確認）與
  `resolveAndPersist` 的建立+寫入順序（ADR 0012 / ADR 0003）。

## 4. 保留的行為（不變）

- 確認邊界：AI 只產草稿、確認才算數（ADR 0003）。
- 實體政策：existing / ask / auto，確認寫入時才建立（ADR 0012）。
- 推論標記（explicit 欄位清單）、年份單獨標記、失敗卡顯示認到的欄位。
- 填入表單、存草稿、多筆批次、無 AI 金鑰時的設定提示。
- 直接語音路徑（ADR 0013）與離線 AI 仍是另一條獨立輸入路，不在此藍圖。

## 5. 檔案變動

| 檔案 | 變動 |
|---|---|
| `src/ai/fieldBlocks.tsx` | 新檔：共用欄位區塊元件（區塊群、狀態、就地編輯） |
| `src/ai/AiLedgerPanel.tsx` | 有效草稿的卡片呈現改為 `FieldBlockGroup`；`SuggestionCard`/`SuggestionDetails`/`statusSuffixFor` 拆除或降為區塊的輔助 |
| `src/ai/ModeBPanel.tsx` | 改用共用 `FieldBlockGroup`（移除重複的區塊 JSX） |
| `src/styles.css` | `.mode-b-*` → 共用 `.field-blocks` 樣式（兩面板共用） |
| `src/ai/AiLedgerPanel.test.tsx` | 新增：自動填入區塊、逐欄編輯後存檔、轉帳區塊、多筆、無效草稿維持 issues |
| `src/ai/ModeBPanel.test.tsx` | 隨共用元件調整（行為不變） |

## 6. 驗證

`npm run typecheck`、`npm test`、`npm run build`、`npm run test:e2e`；
模式 A 在無 AI 金鑰環境維持現況提示，既有確認/實體政策測試全數保留。
