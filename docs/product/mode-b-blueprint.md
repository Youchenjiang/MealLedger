# 模式 B 逐步口說 — 實作藍圖

狀態：**分支 `feature/voice-capture` 的實作藍圖**。上游決策見
[voice-capture-plan](voice-capture-plan.md)、[ADR 0009](../decisions/0009-voice-capture-two-modes.md)、
[ADR 0010](../decisions/0010-mode-b-defaults-to-ai-correction.md)、
[ADR 0012](../decisions/0012-ai-capture-entity-policy-configurable.md)、
[ADR 0013](../decisions/0013-direct-audio-parse-coexists-with-browser-asr.md)。

---

## 1. 目標與範圍

把 `/capture` 的 AI 補帳區擴充為兩種口說模式（頁內切換）：

- **模式 A（整段口說）**：沿用現有 `AiLedgerPanel`，不動行為。
- **模式 B（逐步口說）**：本次垂直切片。欄位依固定順序
  `日期 → 類型 → 帳戶 → 類別 → 對象 → 品項 → 金額` 一個一個亮起，逐欄
  口說填入、逐欄確認，全部填完後確認存檔。

**本次切片包含：**

- 欄位區塊版面（已填顯示值 / 待填灰底 / 目前欄高亮 + 提示文案）。
- 逐欄 Web Speech API（`zh-TW`）收音 → 填該欄。
- 每欄**預設經 AI 校對**（ADR 0010）：單欄 prompt → `requestAiJson` →
  該欄位格式；無 AI 金鑰時直接寫入原始辨識結果（模式 B 仍可用）。
- 最後確認 → 既有正式記錄邊界寫入（`onSaveRecord`），沿用實體政策
  （ADR 0012）與「確認才算數」邊界（ADR 0003）。

**本次切片不包含（各自獨立，後續再做）：**

- 直接語音 AI 路徑（ADR 0013）——另一條並存輸入路，音檔→JSON。
- 離線 AI 本地模型（offline-ai spec，V2+）。
- `/capture` 頁級版面重構（欄位區塊置頂 + 其他方式收合區）——先做
  面板內的模式切換，版面重構另開步驟。

## 2. 欄位模型（`src/ai/modeB.ts` 新檔）

```ts
export type ModeBField = "date" | "kind" | "account" | "category" | "counterparty" | "itemName" | "amount";
export const MODE_B_FIELDS: ModeBField[] = [...];
```

每個欄位一份**提示文案**（目前欄顯示）與**校對規則**：

| 欄位 | 提示文案範例 | 校對規則（有 AI 時） |
|---|---|---|
| date | 請說日期(例如:七月二十五、7/25、昨天) | → `YYYY-MM-DD`（補今年年份、昨天/前天換算） |
| kind | 請說類型(支出、收入或轉帳) | → `expense` / `income` / `transfer`（模糊比對口語） |
| account | 請說帳戶名稱 | → 現有帳戶精確/模糊比對；政策允許新增時保留所說名稱 |
| category | 請說類別 | → 同上（現有類別清單比對） |
| counterparty | 請說對象或店家 | → 保留所說文字（trim） |
| itemName | 請說品項 | → 保留所說文字（trim） |
| amount | 請說金額(例如:兩百五十、480) | → 阿拉伯數字（兩百五十→250），去逗號/貨幣符號 |

**單欄校對 prompt 合約**（新函式，放 `modeB.ts`，重用它處的
`requestAiJson`）：

- system：欄位定義 + 校對規則 + 「只能回傳 JSON：`{"value":"…"}`」。
- user：目前欄位的原始辨識結果。
- 校對後回傳的 `value` 就是「顯示給使用者確認」的候選值。

**校對結果解析**（`parseFieldCorrection`）：`value` 為字串/數字 → trim 成
字串；缺欄或非物件 → 回退原始辨識結果（不阻斷流程）。

## 3. 逐步狀態機（`src/ai/ModeBPanel.tsx` 新檔）

```
state:
  step        : number            // 0..6，指向 MODE_B_FIELDS
  values      : Partial<Record<ModeBField, string>>   // 已確認欄位的值
  transcript  : string            // 目前欄的原始辨識結果
  corrected   : string | null     // 目前欄的 AI 校對候選（無 AI 時 = transcript）
  correcting  : boolean           // 校對中
  listening   : boolean
  message / error
```

流程：

1. 目前欄區塊高亮 + 提示文案；`用說的` 開始收音。
2. `onresult` → `transcript`；有 AI 金鑰 → 送單欄校對 → `corrected`；
   無 AI → `corrected = transcript`。
3. 輸入框預填 `corrected`，顯示「AI 校對結果」(或「原始辨識結果」)，
   使用者可改寫；`填入此欄` 確認 → `values[step] = 輸入值`，進入下一欄。
4. 提供 `上一步`（重填前一欄）與 `重新說一次`。
5. 全部 7 欄填完 → 組 `DraftForm` → `createTransactionDraft` 驗證 →
   「確認存檔」走既有寫入邊界。

## 4. 最後存檔（沿用實體政策與既有邊界）

組 `DraftForm`：kind/date/amount/category 用校對值，account 用校對值，
currency 取帳戶幣別（未比對到時 TWD）。比照 `parse.ts` 的合成帳戶做法，
`createTransactionDraft(form, id, [...accounts, ...合成帳戶])`。

寫入前處理新實體（ADR 0012），複用 App 已接好的
`onResolveNewEntities` + `onSaveRecord(draft, created)`：

- 帳戶/類別為現有清單外名稱且政策 `existing` → 阻止並顯示原因。
- 政策 `ask` → 顯示與 AiLedgerPanel 相同的「尚不存在,是否新增?」確認。
- 政策 `auto` → 先建立再寫入（帳戶 TWD 比照預設錢包）。
- 建立只發生在使用者確認的那一下（ADR 0003）。

## 5. 檔案變動

| 檔案 | 變動 |
|---|---|
| `src/ai/modeB.ts` | 新檔：欄位定義、提示文案、單欄校對 prompt、`parseFieldCorrection` |
| `src/ai/ModeBPanel.tsx` | 新檔：逐步口說面板（欄位區塊 + 收音 + 校對 + 確認） |
| `src/ai/AiLedgerPanel.tsx` | 頂部加模式切換（模式 A 現況 / 模式 B 切到 ModeBPanel）；抽出共用的收音工具（`speechRecognition`、`SpeechRecognitionLike`） |
| `src/App.tsx` | Capture 的 AI 區塊接上模式切換與 ModeBPanel 的 props（`accounts/categories/entityPolicy/onResolveNewEntities/onSaveRecord` 皆已有） |
| `src/styles.css` | 欄位區塊（`.mode-b-*`）、模式切換、目前欄高亮 |
| 測試 | `modeB.test.ts`（prompt/解析/組 form）、`ModeBPanel.test.tsx`（逐步流程、AI 校對、無 AI 回退、新實體政策） |

## 6. 驗證

`npm run typecheck`、`npm test`、`npm run build`、`npm run test:e2e`；
模式 B 在無 AI 金鑰環境（`isAiConfigured() === false`）可直接用原始
辨識結果完成。
