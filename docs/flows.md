# Flows

## 拍餐點並連動帳本

1. 使用者在 app 內拍餐點照。
2. 前端呼叫 `create-r2-upload-url`，送出 `contentType`、`capturedAt`、`kind = meal_photo`。
3. Edge Function 建立 `media_assets` draft row，回傳 R2 presigned PUT URL。
4. 前端直接 PUT 圖片到 R2。
5. 前端建立或更新 `meal_entries`，並寫入 `meal_media_links`。
6. 背景 AI function 讀取圖片，更新 `ai_description`、`ai_labels`，並建立 `ai_imports` 草稿。
7. 前端呼叫 `find_transaction_candidates_for_meal(meal_id)` 顯示候選交易。
8. 使用者確認後寫入 `meal_transaction_links`：
   - `time_match`: 用餐時間前後 2 小時。
   - `merchant_match`: 餐食店家與交易店家相同或近似。
   - `ai_suggested`: AI 推測但未人工確認。
   - `ai_confirmed`: 使用者確認。

## 從照片找帳本

1. 搜尋文字先查 `media_assets.ai_labels`、`media_assets.ai_description`、`meal_entries.foods`、`merchants.name`。
2. 從 `meal_media_links` 找到餐食。
3. 從 `meal_transaction_links` 找到交易。
4. 顯示照片、餐點、帳戶、金額、分類、付款時間。

## 從帳本找照片

1. 使用者打開交易明細。
2. 透過 `meal_transaction_links` 找餐食。
3. 透過 `meal_media_links` 找照片 metadata。
4. 用 `object_key` 或短效 signed GET URL 顯示圖片。

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

若要完整備份圖片，另外跑 R2 bucket export 或 object list，不和日常帳本匯出混在一起。
