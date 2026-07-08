# Flows

## 核心原則

MealLedger 以記帳為主。餐點紀錄、照片、發票掃描、AI/OCR 都是資料來源或輔助脈絡，不應直接取代正式帳本。

- 帳本可以沒有照片。
- 餐點可以沒有交易。
- 照片在產品語意上維持單一用途：發票/收據掃描、餐點記錄、或一般附件。
- 發票/收據掃描圖是暫存輸入，使用者確認或捨棄草稿後不長期保存在系統中。
- 匯入與 AI/OCR 先產生草稿，使用者確認後才寫入正式交易。

## 拍照入口

拍照或匯入圖片時，使用者需要先選擇意圖：

1. 掃描發票或收據：建立記帳草稿。
2. 紀錄餐點：建立餐點草稿，可包含多張照片。
3. 附加照片：連到既有交易、餐點、發票或草稿。

同一張圖片不跨用途。如果同一餐需要餐點照片與發票證明，使用者應拍攝或匯入兩張不同圖片。

## 掃描發票或收據

1. 使用者在 app 內拍照或匯入一批發票/收據圖片。
2. 前端上傳圖片作為 temporary scan input，送出 `contentType`、`capturedAt`、`kind = invoice_scan` 或 `receipt_scan`。
3. Edge Function 建立暫存 upload row，回傳 R2 presigned PUT URL。
4. 前端直接 PUT 圖片到暫存 object key。
5. OCR 或匯入流程建立 `ai_imports` 或 invoice import 草稿。
6. 使用者確認後才建立或更新正式 `transactions`。
7. 使用者確認或捨棄草稿後，原始掃描圖片刪除或到期，不進入長期媒體庫。

## 紀錄餐點並可選連動帳本

1. 使用者在 app 內拍餐點照、匯入餐點照片，或手動新增餐點。
2. 一餐可以連到多張圖片。
3. 前端呼叫 `create-r2-upload-url`，送出 `contentType`、`capturedAt`、`kind = meal_photo`。
4. Edge Function 建立 `media_assets` draft row，回傳 R2 presigned PUT URL。
5. 前端直接 PUT 圖片到 R2。
6. 前端建立或更新 `meal_entries`，並寫入 `meal_media_links`。
7. 背景 AI function 讀取圖片，更新 `ai_description`、`ai_labels`，並建立 `ai_imports` 草稿。
8. 如果使用者想連動帳本，前端呼叫 `find_transaction_candidates_for_meal(meal_id)` 顯示候選交易。
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
3. 每張圖片維持單一用途。
4. 使用者可以把多張餐點圖片合併到同一餐，或把多張掃描圖片合併到同一張發票/收據草稿。
5. 正式帳本只在使用者確認後更新。
6. 發票/收據掃描圖片在確認或捨棄後清除，餐點照片與一般附件才進入長期媒體庫。

## 從照片找帳本

1. 搜尋文字先查 `media_assets.ai_labels`、`media_assets.ai_description`、`meal_entries.foods`、`merchants.name`。
2. 從 media link tables 找到餐點或交易附件。
3. 從 `meal_transaction_links` 或 invoice draft links 找到交易。
4. 顯示照片、餐點、帳戶、金額、分類、付款時間。

發票/收據掃描圖確認後不保留，因此不能作為長期照片搜尋結果；搜尋應使用確認後的發票資料、交易資料、OCR 摘要或使用者筆記。

## 從帳本找照片

1. 使用者打開交易明細。
2. 透過交易附件、發票來源或 `meal_transaction_links` 找相關照片。
3. 用 `object_key` 或短效 signed GET URL 顯示圖片。

## 從餐點找帳本

1. 使用者打開餐點明細。
2. App 顯示已確認交易連結與候選交易。
3. 使用者可以新增交易、連到既有交易、附加照片，或保持餐點與帳本分離。

## 匯出帳本

帳本匯出只查 `ledger_export` view。匯出內容包含：

- transaction id
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
