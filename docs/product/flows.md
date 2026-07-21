# Flows

## 核心原則

MealLedger 以記帳為主。餐點紀錄、照片、發票掃描、AI/OCR 都是資料來源或輔助脈絡，不應直接取代正式帳本。

- 帳本可以沒有照片。
- 餐點可以沒有交易。
- 照片的每個連結在產品語意上維持單一用途：發票/收據掃描、餐點記錄、或一般附件。底層同一份檔案可以被多個連結使用，不需要重複上傳 bytes。
- 發票/收據掃描圖是暫存輸入，使用者確認或捨棄草稿後不長期保存在系統中。
- 匯入與 AI/OCR 先產生草稿，使用者確認後才寫入正式交易。

## 目前 V1 邊界

本文件同時描述已完成的本地流程與後續雲端流程。現行 V1 已支援本地
記帳、草稿、餐點/媒體 metadata 與同步佇列；尚未啟用 R2 bytes、signed
URL、雲端 OCR/AI 或財政部/銀行 provider sync。以下標示為「未來雲端
slice」的步驟不可視為目前已完成的功能。

## 拍照入口

拍照或匯入圖片時，使用者需要先選擇意圖：

1. 掃描發票或收據：建立記帳草稿。
2. 紀錄餐點：建立餐點草稿，可包含多張照片。
3. 附加照片：連到既有交易、餐點、發票或草稿。

同一個媒體連結不跨用途。如果同一張圖片同時可作為餐點照片與帳務證明，系統可以共用同一份底層檔案，但要建立不同的 link intent，讓使用者清楚知道每個用途。

## 掃描發票或收據（本地優先，可設定雲端上傳）

1. 使用者在 app 內拍照或匯入一批發票/收據圖片。
2. 前端先建立本地 temporary scan 與 byte queue；未登入或離線時仍可保存。
3. 雲端上傳已設定時，前端呼叫 `create-r2-upload-url`，送出
   `contentType`、`capturedAt`、`kind = invoice-scan` 或 `receipt-scan`。
4. Edge Function 驗證使用者並回傳 R2 presigned PUT URL，不預先建立
   `media_assets` row。
5. PUT 成功後，cloud queue 才建立 media/source/draft metadata；未來 OCR
   也只能更新草稿建議。
6. 使用者確認後才建立或更新正式 `ledger_records`。
7. 使用者可保留或捨棄來源；本地生命週期立即反映選擇，R2 實體物件
   刪除與到期清理由後續 cleanup job 完成。

## 紀錄餐點並可選連動帳本

1. 使用者在 app 內拍餐點照、匯入餐點照片，或手動新增餐點。
2. 一餐可以連到多張圖片。
3. 已登入且雲端上傳已設定時，前端呼叫 `create-r2-upload-url`，送出
   `contentType`、`capturedAt`、`kind = meal-photo`。
4. Edge Function 驗證使用者並回傳 R2 presigned PUT URL；此時不先建立
   `media_assets`，避免上傳失敗卻留下假的同步資料。
5. 前端直接 PUT 圖片到 R2，成功後才由 cloud queue 寫入 media metadata；
   離線或缺少本地 bytes 時維持待同步或待重新選取狀態。
6. 前端建立或更新 `meal_entries`，並以 `media_links` 的 `target_type = 'meal'` 建立照片連結。
7. 未來啟用 AI/OCR 時，背景 function 只能在 `source_payloads` 與 `drafts` 邊界產生建議，不能直接改寫正式欄位。
8. 如果使用者想連動帳本，應用層查詢 `ledger_records` 顯示候選交易；候選配對服務不屬於目前 V1 cloud persistence 的已實作 RPC。
9. 使用者確認後寫入 `meal_transaction_links`：
   - `time_match`: 用餐時間前後 2 小時。
   - `merchant_match`: 餐食店家與交易店家相同或近似。
   - `ai_suggested`: AI 推測但未人工確認。
   - `ai_confirmed`: 使用者確認。

## 手動新增交易

1. 使用者輸入金額、帳戶、分類、商家、時間與備註。
2. 交易可直接成為正式帳本記錄。
3. 使用者可選擇附加照片、掃描來源、發票記錄或餐點記錄。
4. 沒有照片或餐點連結時，交易仍然是完整記帳資料。

## 匯入多張圖片

1. 使用者匯入多張發票、收據或餐點圖片。
2. App 依使用者選擇或 AI/OCR 建議建立多個草稿。
3. 每個圖片連結維持單一用途；同一份底層檔案可在需要時建立多個用途明確的連結。
4. 使用者可以把多張餐點圖片合併到同一餐，或把多張掃描圖片合併到同一張發票/收據草稿。
5. 正式帳本只在使用者確認後更新。
6. 發票/收據掃描圖片在確認或捨棄後清除，餐點照片與一般附件才進入長期媒體庫。

## 從照片找帳本

1. V1 先查 `media_assets` metadata、`meal_entries` 結構化欄位與 `merchants.name`；AI/OCR 全文索引仍屬後續功能。
2. 從 `media_links` 找到餐點或交易附件。
3. 從 `meal_transaction_links` 或 invoice draft links 找到交易。
4. 顯示照片、餐點、帳戶、金額、分類、付款時間。

發票/收據掃描圖確認後不保留，因此不能作為長期照片搜尋結果；搜尋應使用確認後的發票資料、交易資料、OCR 摘要或使用者筆記。

## 從帳本找照片

1. 使用者打開交易明細。
2. 透過交易附件、發票來源或 `meal_transaction_links` 找相關照片。
3. 雲端 media slice 啟用後才用 `object_key` 或短效 signed GET URL 顯示圖片；目前使用本地媒體狀態。

## 從餐點找帳本

1. 使用者打開餐點明細。
2. App 顯示已確認交易連結與候選交易。
3. 使用者可以新增交易、連到既有交易、附加照片，或保持餐點與帳本分離。

## 匯出帳本

帳本匯出由匯出 adapter 讀取 canonical ledger rows。對外的試算表欄位可以沿用 `transaction` 命名，但資料來源是 `ledger_records`。匯出內容包含：

- ledger record id
- occurred_at
- kind
- account
- transfer account
- category
- merchant
- amount
- currency
- note
- linked meal ids
- linked media ids

匯出不包含：

- R2 object bytes
- base64 圖片
- 縮圖檔案
- 發票/收據掃描原圖

若要完整備份圖片，另外跑 R2 bucket export 或 object list，不和日常帳本匯出混在一起。
