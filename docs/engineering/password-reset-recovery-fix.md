# 密碼重設（Password Reset）修復紀錄

狀態：**已修復**（2026-08-11，分支 `fix/password-reset-recovery`）。修復內容與驗證見下方「修復結果」；根因分析保留原文供回溯。

## 症狀

點擊重設密碼信中的連結後：

- 畫面直接顯示「已登入」的帳戶頁（Optional cloud sync / Confirm cloud handoff / Sign out），
  **完全沒有**出現「Set new password」表單，使用者無法設定新密碼。
- 寄出的重設信連結，`redirect_to` 指向 app 當下的 origin。使用者實際收到的一封是
  `http://127.0.0.1:5174/account`——那不是任何 dev script 的 port（4173/5200/4174），
  也不在 `supabase/config.toml` 允許清單內；origin 沒在聽時連結直接死。

## 診斷（端到端實測）

用本機 Supabase（GoTrue v2.192.0）+ Mailpit（54324）實際走完整流程：

1. `POST /auth/v1/signup` 建立測試帳號 → 成功（`enable_confirmations = false`，自動確認）。
2. `POST /auth/v1/recover?redirect_to=http://127.0.0.1:5200/account` → 回 200，Mailpit 收到信，
   連結帶 `redirect_to=http://127.0.0.1:5200/account`（本機 GoTrue 沒有擋未註冊的 redirect）。
3. 開啟信的 verify 連結 → GoTrue `303 See Other` → 正確 303 到
   `http://127.0.0.1:5200/account#access_token=...&refresh_token=...&type=recovery`。
4. 在 app（`npm run dev:5200`）實際開啟該 URL（實測兩次）→ 畫面是「已登入」的帳戶頁，
   **沒有**「Set new password」表單；URL hash 被清成 `/account#`。
5. console/network：看到 3 次 `GET /auth/v1/user`（走的是登入驗證路徑，不是 recovery 路徑）。

### 根因

`src/auth/authActions.ts` 的 `restoreOAuthCallbackSession()` 把**任何**帶有
`access_token` + `refresh_token` 的 URL hash 都當成 OAuth callback 處理：

1. recovery 連結（Supabase implicit grant，hash 長相與 OAuth callback 相同，只是多 `type=recovery`）
   被 `restoreOAuthCallbackSession` 攔截；
2. `src/auth/AuthProvider.tsx` 的 `restoreSession()` 接著手動 `setSession`、
   `handleSession("SIGNED_IN", ...)` 標記已登入、`clearAuthCallbackHash()` 清掉 hash；
3. supabase-js 自己排程的 `PASSWORD_RECOVERY` 事件（`_initialize()` 偵測到 URL 後以
   `setTimeout(0)` 通知，見 `node_modules/@supabase/auth-js` 的 `GoTrueClient.js`）與
   app 手動的 `SIGNED_IN` 處理互相競態，最後狀態都被覆蓋成「已登入」→ 表單永遠不出現。

這是「app 自行攔截 recovery 連結」與「supabase-js 內建 recovery 處理」之間的衝突；
recovery 落地沒有真正依賴 `PASSWORD_RECOVERY` 事件。

### 為什麼單元測試沒抓到

`src/App.auth.test.tsx`、`src/auth/*.test.ts*` 全部 mock 掉 supabase client（`vi.fn()`），
recovery 測試是直接 `authListener("PASSWORD_RECOVERY", ...)` 手動觸發事件，
沒有走「真連結 → verify 303 → 落地 hash → 被當 OAuth 攔截」這條路。

## 次要問題

- `supabase/config.toml`：`site_url = "http://127.0.0.1:3000"`、
  `additional_redirect_urls = ["https://127.0.0.1:3000"]`，dev server 實際跑在 4173/5200/4174
  （見 `package.json` scripts），全都不在允許清單。
- `docs/engineering/setup.md`：寫「Password reset and provider callbacks return to
  `http://127.0.0.1:5200/settings`」——與程式碼實際回呼 `origin + /account` 不符（過時）。

## 修法（原始計畫）

原計畫是「app 不攔截 recovery 連結、讓 supabase-js 的 `PASSWORD_RECOVERY` 事件自然處理」。
實作前查閱 `node_modules/@supabase/auth-js` 原始碼後發現該路徑有競態，改為下方
「修復結果」的確定性做法（見「為何不採用原計畫」）。

1. `restoreOAuthCallbackSession` 判斷 hash 的 `type=recovery`：
   - recovery 連結**不要**走 OAuth callback 路徑（不要手動 `setSession`、不要
     `clearAuthCallbackHash`、不要標記 `SIGNED_IN`），
   - 讓 supabase-js 的 `PASSWORD_RECOVERY` 事件自然處理——`AuthProvider.handleSession`
     已正確把該事件對應到 `password-recovery` 狀態 → 顯示「Set new password」表單；
   - 也就是只有 `type=recovery` 以外的 callback 才走現有 OAuth 路徑。
2. `supabase/config.toml`：把 dev port（至少 5200、4173）加進 `additional_redirect_urls`。
3. 更新 `docs/engineering/setup.md` 的回呼 URL 說明（實際是 `origin + /account`）。
4. 補一條整合測試：真實 recovery 連結 → verify 303 → 落地 hash → 驗證出現
   「Set new password」表單；避免只靠手動觸發事件的單元測試。

## 為何不採用原計畫

`@supabase/auth-js` 的 `GoTrueClient._initialize()` 在**客戶端建構（模組載入）時**就會：

1. `_getSessionFromURL()` 解析 hash 並在網路往返（`GET /auth/v1/user`）後
   `window.location.hash = ''` 把 token 從 URL 清掉；
2. `setTimeout(0)` 排程 `PASSWORD_RECOVERY` / `SIGNED_IN` 通知。

因此 recovery 事件與 app 的 `onAuthStateChange` 訂閱存在**網路計時競態**：網路快時事件在
app 訂閱前就已觸發且 hash 已被清掉，app 端 `getSession()` 拿到已存的 session 後照樣
`INITIAL_SESSION → signed-in`，表單仍不出現。只「不攔截」無法可靠落地。

## 修復結果（實際實作）

確定性修法：**app 是 callback 的唯一處理者**，不依賴 supabase-js 的 URL 自動處理。

1. `src/lib/supabase.ts`：`createClient(..., { auth: { detectSessionInUrl: false } })`，
   關閉 supabase-js 的 URL 自動處理（不再清 hash、不再排程競態事件）。OAuth 與 recovery
   都由 app 自己處理；app 目前只用 implicit grant（`flowType` 未設定，預設 `implicit`），
   `restoreOAuthCallbackSession` 本就負責 OAuth callback，行為不變。
2. `src/auth/authActions.ts`：`restoreOAuthCallbackSession` 回傳結果加上 `recovery` 旗標
   （hash 帶 `type=recovery` 時為 `true`）。recovery 仍需 `setSession` 建立 session，
   `updateUser({ password })` 才有權限；只是 caller 不再把它當成登入。
3. `src/auth/AuthProvider.tsx`：`restoreSession` 收到 `recovery: true` 時
   `handleSession("PASSWORD_RECOVERY", session)` → `password-recovery` 狀態 →
   「Set new password」表單出現，不會標記成已登入。
4. `supabase/config.toml`：`additional_redirect_urls` 加入 dev port
   `http://127.0.0.1:4173`、`http://127.0.0.1:4174`、`http://127.0.0.1:5200`。
5. `docs/engineering/setup.md`：回呼 URL 說明改為實際的 `origin + /account`。
6. 競態加固：recovery 落地後，supabase-js 仍可能把已存 session 以 `INITIAL_SESSION` /
   `SIGNED_IN` 補發（`onAuthStateChange` 訂閱後的一次性事件、`setSession` 內部事件），
   可能覆蓋 `password-recovery` 狀態。`AuthProvider` 以 `recoveryStartup` ref 在 recovery
   流程中忽略這兩種事件，直到完成改密或登出/登入才清除。
7. 測試：
   - `authActions.test.ts`：recovery URL → `{ handled: true, recovery: true }` 且 `setSession`
     被呼叫；OAuth URL 維持 `recovery: false`；失敗/無 session 也保留 `recovery: true`。
   - `AuthProvider.test.tsx`：落地 recovery hash → 狀態為 `password-recovery`、hash 被清；
     失敗的 recovery 連結 → `auth-error`；遲到的 `INITIAL_SESSION`/`SIGNED_IN` 不會覆蓋。
   - `App.auth.test.tsx`：落地 `/account#...type=recovery` → 出現「New password」表單、
     不會出現 `Confirm cloud handoff`（未誤登入）；送出後 `updateUser` 被呼叫並回到已登入。

驗證：`npx vitest run src/App.auth.test.tsx src/auth` 44/44 通過；完整 `npm test`
347 通過；`npm run typecheck`、`npm run build`、`npm run test:e2e` 通過。

## 驗證方式

修復後：

1. 本機 Supabase（`npx supabase start`）有在跑；`npm run dev:5200` 啟動 app。
2. 對測試帳號觸發 recover（`redirect_to` 指向 5200），開啟 Mailpit 的信件連結。
3. 預期：落地 `/account` 後顯示「Set a new password to finish resetting your account.」
   表單；送出後 `updateUser({ password })` 成功回到已登入。
4. `npm run typecheck && npm test` 全綠。

## 備註

- 診斷時在本機 local Supabase 建立過測試帳號 `reset-test-20260811@example.com`
  （Mailpit 留有測試信），可用 supabase 管理介面刪除。
