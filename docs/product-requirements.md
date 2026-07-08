# Product Requirements Notes

These notes capture current product decisions and unresolved questions before the app shell and schema become too specific. They are intentionally working notes, not a final specification.

## Confirmed Direction

- MealLedger is accounting-first. The main product job is to keep a clean personal ledger.
- Meal records are optional context, not the primary record type.
- Photos are optional evidence or memory. A transaction can exist without photos, and a meal can exist without a linked transaction.
- Capture should support multiple entry intents:
  - add a manual transaction
  - scan a receipt or invoice as a ledger source
  - record a meal
  - attach photos to an existing or draft record
- Imported images can be reused across contexts without re-uploading the same file. Each media link should still have one clear product intent, such as ledger source, meal photo, or attachment.
- A meal can have more than one photo.
- Receipt and invoice scan images are temporary capture inputs by default. After the user confirms ledger fields or abandons the draft, the app should clear raw scan files and OCR/AI working data unless the user explicitly chooses to keep a file as an attachment or evidence.
- AI and OCR output should create drafts and suggestions only. Official transactions require user confirmation.
- Ledger export must stay small and independent from image file size. Export rows may include media ids or linked record ids, but never image bytes or base64 content.

## Core Concepts

### Spreadsheet Baseline

The app must not provide less accounting coverage than the user's existing spreadsheet. The baseline spreadsheet has these views:

- Cash summary by account: account, total income, transfers, total expenses, and current cash balance.
- Budget or fund additions: date, account, amount, and source. These are not always earned income.
- Transfers: date, source account, amount, and destination account. Transfer history must be retained and reviewable.
- Unrecorded or unresolved expenses: date, account, amount, and pending note/status. These count as spending even when merchant/category details are missing.
- Cash expenses: date, merchant, item name, category, amount, and account.

The app should improve this baseline by making these views derived from one consistent ledger model instead of requiring duplicate manual tables. Account balances, transfer history, unresolved expenses, and expense lists should be computed from confirmed ledger records.

Summary views are useful only when they answer a concrete question. They should be optional derived views, not the primary value of the app. A well-formatted ledger should remain useful even without the cash summary.

`現金餘額` means the current amount in that account.

Minimum ledger capabilities:

- Multiple accounts, including cash wallets, bank accounts, stored-value cards, and digital wallets.
- Accounts should have a currency, such as TWD or JPY. Transactions normally use the currency of the selected account.
- Opening balances, fund additions, and later balance adjustments with an explicit source or reason. These should not be forced into earned income.
- Income records require date, account, amount, category, and source.
- Expense and refund records require date, merchant, item name or description, category, amount, and account.
- Expense entry can explicitly mark merchant missing or item/name missing. The system should then fill a fixed missing-value label or a user-approved suggestion, not invent arbitrary data.
- Transfers between accounts without counting the transfer as spending, while retaining a clear transfer record.
- Low-information expense records for amounts that are known but not yet fully identified.
- Optional account summary that separates income, fund additions, transfer movement, expenses, refunds, unresolved expenses, and resulting balance.
- Clean export that can reproduce the spreadsheet-level tables without media bytes.
- Export mode choice: one normalized ledger table, or multiple spreadsheet-style tables such as summary, fund additions, transfers, expenses, refunds, unresolved expenses, and adjustments.

Currency and cross-currency rules:

- Multi-currency support means supporting accounts with different currencies, not requiring exchange rates on every foreign-currency purchase.
- Currency exchange should be recorded at the moment money is exchanged or moved between currencies, such as TWD cash to JPY cash.
- Same-currency transfers can use one `amount`.
- Cross-currency transfers require both `source_amount` with source currency and `destination_amount` with destination currency. Example: source account decreases by TWD 10000 and destination cash account increases by JPY 46000.
- Cross-currency transfer records do not need a live exchange-rate lookup, but they must preserve both sides so account balances remain correct.
- Transfer fees should be represented as a separate `expense`, usually categorized as `手續費`, rather than silently inferred from transfer differences.
- The transfer entry UI may offer an inline fee field for convenience, but saving should still create a transfer record plus a fee expense record so reports remain explicit.
- V1 cross-currency transfer entry should include an optional fee section. The user experiences one exchange/transfer flow, while the app persists normalized records behind the scenes.
- After exchange, spending from a foreign-currency cash account reduces that account's balance in its own currency.
- First version does not need live exchange rates, automatic foreign-exchange gains/losses, or automatic conversion of every foreign purchase back to TWD.
- Reports should avoid adding different currencies into one misleading total. They can show account balances and spending by currency, with TWD as the default base view for TWD accounts.
- First version should show assets grouped by currency instead of a single cross-currency net-worth number.
- A future net-worth view may use user-entered valuation rates or an exchange-rate provider, but that should not force every foreign-currency spending record to store an exchange rate.

Additional official-record requirements:

- Transfer records require date, source account, source amount, destination account, and destination amount when account currencies differ. Same-currency transfers can display as one amount.
- Fund-addition records require date, account, amount, and source.
- Adjustment records require date, account, amount, and reason.
- Refund records follow expense-like required fields and report as negative spending.
- Expense item/name is separate from merchant and category.

### Ledger Records

`transactions` are the official accounting records. They hold amount, account, category, merchant, time, note, and transfer relationships. These records are the source of truth for ledger export and reports.

Time fields should preserve both absolute and local context:

- Store an absolute timestamp for ordering and sync, such as UTC.
- Preserve the user's local date/time and timezone or offset at capture/import time.
- Meal-period inference, invoice matching, and travel workflows should use local context, not only UTC.
- Imported external records should preserve provider time fields and timezone assumptions when known.
- If timezone is unknown, the app should mark it as inferred and avoid high-confidence automatic matching based only on time.

Transaction-like ledger records need distinct kinds so the app does not mislabel money movement:

- `income`: earned or received income.
- `fund_addition`: money added to an account for setup, original savings, budget refill, unknown source, or other non-income funding sources.
- `expense`: normal spending.
- `refund`: money returned under the original expense category. Reports should treat refunds as negative spending, not income.
- `unresolved_expense`: spending with limited details that still reduces account balance. Requires statistical period/time, amount, and account before it can be saved as this kind.
- `transfer`: movement between two accounts, retained as its own history and excluded from spending totals.
- `adjustment`: explicit correction when the account balance needs to be fixed with a reason.

### Naming And Reporting Semantics

Internal kind names should stay stable and normalized. Traditional Chinese UI labels can be refined, but they should map to one consistent internal vocabulary.

Suggested internal-to-UI mapping:

- `income`: `收入`
- `fund_addition`: `初始資金`
- `expense`: `支出`
- `refund`: `退款`
- `unresolved_expense`: `缺漏支出`
- `transfer`: `轉帳`
- `adjustment`: `餘額調整`

Reporting rules:

- `fund_addition` changes account balance but does not count as income, especially for original balances, unknown source money, or setup funding. The preferred Traditional Chinese UI label is `初始資金`.
- `refund` belongs under its own transaction kind and the relevant expense category. Spending reports subtract refunds from expenses.
- Cross-period refunds should default to the period when the refund actually happened. A refund can link back to the original expense for drilldown, but the app should not silently rewrite old monthly reports.
- Reports may offer an alternate "original purchase period" view later, but cash-flow and normal monthly spending views use the refund date.
- Refunds can flow into an account different from the original expense account. The refund account should reflect where money actually returned, while category and original-transaction links explain what spending area was reduced.
- A refund can be greater or smaller than the linked original expense. For cross-currency card refunds, fee differences, discounts, or exchange-rate drift, the app should show the difference and let the user categorize or adjust it instead of silently creating an adjustment.
- Refunds can carry an `exchange_difference` or similar subfield for exchange-rate drift, fee differences, discounts, or rounding. Reports should keep this difference separate from normal spending categories such as food or transportation unless the user chooses otherwise.
- `transfer` changes account balances and remains reviewable as transfer history, but does not count as income or expense.
- `unresolved_expense` counts as spending even when merchant, item name, or category is incomplete. The preferred Traditional Chinese UI label is `缺漏支出`.
- In category reports, unresolved expenses should roll up under a visible placeholder such as `未分類支出` or `缺漏支出` so category totals still reconcile with total spending.
- `adjustment` should be visible in audit/export views so balance corrections are not hidden.

Shared payment and payback rules:

- First version does not need a full debt or receivable system.
- When the user pays for others, the ledger should prioritize actual account cash flow. If the user paid 1000 from a wallet, the account balance should decrease by 1000.
- Payback from friends should be recorded like a refund or return under the relevant category, not as earned income.
- Paybacks should be linkable to the original shared expense when known.
- The app should provide a lightweight pending-payback review surface for shared expenses that the user has marked as waiting for repayment.
- Reports should support a filter or view that excludes or nets marked payback-related spending and refunds when the user wants a cleaner monthly personal-spending view.
- Reports should distinguish cash-flow view from personal net-spending view. Cash-flow uses the actual payment and payback dates; personal net-spending can exclude or net marked payback items for easier monthly review.
- Shared context, people, and split notes can be stored as event, tag, or link metadata, but they should not replace the confirmed cash-flow records.
- Reports should subtract friend paybacks from spending in the same way they subtract refunds.

### Recurring Records

Recurring transactions need explicit user intent when entered. Recurrence can apply to expenses, income, and transfers. For subscription-like expenses such as `訂閱 > AI`, repeated income, or repeated account transfers, the app should ask whether the entry applies only to the current cycle, should prompt the user again next cycle, or should be recorded automatically next cycle.

Recurring options:

- Current cycle only: save one record and do not schedule a future reminder.
- Prompt next cycle: create a recurrence reminder that asks the user before posting.
- Auto-record next cycle: create a recurrence rule that posts future records automatically.

Recurring rules:

- The first occurrence must still satisfy normal required fields.
- Auto-record should be clearly marked and easy to pause or cancel.
- Prompted recurrence should create a draft/reminder, not an official ledger record, until the user confirms.
- Future recurrence changes should not rewrite historical confirmed records unless the user explicitly chooses a retroactive edit.
- Interest can be recurring income when the account provides it periodically, but the recurrence cadence and calculation method may need user review or later provider-specific rules.
- Recurrence must support both fixed amount and variable amount records.
- V1 variable-amount recurrence should create a draft or reminder with amount pending, not an auto-posted official ledger record.
- Later versions may support estimated amount, maximum amount, due date, bill-pool linking, or cash-flow forecast treatment for variable bills such as utilities and credit cards.
- If external bills or statement records arrive later, they can fill in or suggest the actual amount before user confirmation.
- Auto-record is allowed only when all required fields, including amount, are known for that cycle.
- For recurring transfers, both source and destination accounts must be known before auto-recording.

### Original Labels And Notes

Imported spreadsheet text should be preserved without forcing it into user-facing notes. The app should distinguish:

- `source_label`: the original imported text from the spreadsheet row when it helps audit import mapping.
- `note`: optional user-written explanation, such as why an expense was marked wasteful.
- `system_suggestion`: AI or import assistant guesses that require user confirmation.

Notes are not a substitute for structured fields. When a label can be structured into category, source, event, period, or item name, the app should suggest that split while preserving the original `source_label`.

Income official fields remain fixed: date, account, amount, category, and source. During import, the app may suggest mapping old combined text into those fixed fields. For example, `紅包(母)` can be suggested as category `紅包` and source `母`, but the user can keep or change the mapping.

### Category Taxonomy

Categories should support at least two levels: parent category and child category. The old spreadsheet has many useful labels, but some labels are broad domains while others are meal periods, sources, people, or unresolved placeholders.

Expense category examples from the existing spreadsheet:

- Daily life: `日用`, `清潔`, `文具`, `郵費`, `禮物`
- Food: `早餐`, `午餐`, `晚餐`, `早午餐`, `宵夜`, `點心`, `水果`
- Transport and travel: `交通`
- Event spending: `登山`
- Shopping and belongings: `電子`, `服飾`, `鞋襪`, `收藏`, `園藝`
- Personal and activities: `學習`, `醫藥`, `娛樂`, `租賃`, `特殊`, `浪費`
- Temporary or unresolved labels: `0`, `?`
- Subscription examples: `AI`

Income and funding labels from the old spreadsheet should not all become flat income categories. They often include source, person, month, employer, scholarship name, reimbursement reason, or one-time event. The app should preserve the original row text during import, then optionally suggest values for the fixed income fields.

Suggested income import mapping:

- Category examples: allowance, salary, scholarship, red envelope, reward, reimbursement, interest, subsidy, government payment, original balance, unknown.
- Source examples: parent, relative, school, employer, bank, government, platform, unknown.
- Extra imported words such as month, contest, trip, certificate, or reimbursement target should be suggested as event or note only when useful.

Category requirements:

- Categories are user-editable.
- Parent and child categories can be different by transaction kind.
- The original imported label should be retained as `source_label` or import metadata when it helps audit mapping.
- Ambiguous labels such as `0` and `?` should map to unresolved or review-needed categories instead of being silently deleted.
- Refunds should keep an expense-related category so reports can subtract them from the matching spending area.
- Reports should support parent-category rollups and child-category drilldown.
- Meal-period labels such as `早餐`, `午餐`, `晚餐`, `早午餐`, `宵夜`, and `點心` can be used both as expense child categories and meal tags.
- The app should support category mapping suggestions during import, but the user must be able to keep the original label.

Recommended category cleanup:

- Merge narrow food labels under a parent like `飲食`, while keeping meal periods as child categories or meal tags.
- Keep `水果` under `飲食` unless the user wants a separate health or grocery grouping.
- Split broad labels such as `特殊` into more descriptive children instead of using it as a permanent catch-all. Existing examples suggest children such as fees, fines, deposits, tickets, gifts, treating others, religious/custom spending, and reimbursement preparation.
- Treat `浪費` as a personal review category or tag. It is useful emotionally, but reports may also need the actual spending domain.
- Treat `0` and `?` as unresolved/import-review states, not long-term report categories.
- Keep `登山` as a valid event category because the existing ledger uses it for hiking gear, clothing, food supplies, hydration, and small outdoor-use items. The app can still suggest child categories such as gear, clothing, food supply, hydration, and small tools.
- Preserve old labels as aliases so historical exports can still match the spreadsheet.

Category and tag distinction:

- A transaction can have one reporting category for accounting rollups.
- A transaction can have multiple tags for context such as activity, emotion, trip, meal period, reimbursement status, or review state.
- Event-like labels such as `登山` can use a separate event field and may also appear as category or tag when useful.
- Review-like labels such as `浪費` are better as tags unless the user explicitly wants a spending bucket named `浪費`.

Events are optional grouping concepts for records that cross normal categories. An event can group expenses, income, funding, and transfers related to the same real-world purpose, such as hiking purchases, a trip, a certification exam, a competition, or reimbursable work. Unlike category, it does not need to be the reporting bucket; it can group equipment, food, transport, deposits, fees, reimbursements, and funding under one real-world event.

Import cleanup examples:

- `登山`: keep as an event grouping; optionally suggest children like `登山 > 裝備`, `登山 > 服飾`, `登山 > 補給`, `登山 > 工具`.
- `特殊`: suggest migration into clearer categories such as `手續費`, `罰款`, `訂金`, `門票`, `禮物`, `請客`, `宗教習俗`, `報銷準備`, or `其他`.
- `AI`: use a normal category such as `訂閱 > AI` for clear AI tools or subscription transactions.
- `浪費`: keep the note explaining why it was wasteful, and optionally add a normal category so spending reports remain useful.

### Meal Records

`meal_entries` are optional food or dining records. They can describe what was eaten, where, when, and with whom. A meal may link to zero, one, or many transactions depending on the real-world case.

### Media Assets

`media_assets` store metadata for images and other files. The actual file bytes live in object storage such as Cloudflare R2. Media can be attached to meals, transaction drafts, invoice scans, or confirmed ledger records through link tables.

Product intent is single-purpose at the link/usage layer, not at the physical file layer. A single stored file can be reused for multiple purposes without re-uploading the same bytes, as long as each link states its intent clearly.

The first version should prefer capture speed and clear usage metadata. If a photo contains both a meal and receipt evidence, the UI can create one `meal_photo` link and one `receipt_evidence` link to the same underlying file. The user should not need to upload the same file twice. Storage deduplication can happen below the product model using checksum/object metadata.

Receipt and invoice scan images are short-lived working files by default. They support OCR/AI parsing and user confirmation, but they are not long-term system evidence unless the user explicitly keeps them as media attachments or receipt evidence. The app should surface storage and privacy choices when users scan or import these files.

OCR text, AI labels, extracted features, prompts, and model traces are also working data by default. After confirmation, the official ledger should store only user-confirmed structured fields and minimal audit data unless the user chooses to retain source evidence. If the user abandons a scan or draft, the working data should be deleted according to the temporary retention policy.

Performance requirements:

- Ledger list views should not load original image bytes, base64 data, full media link graphs, or signed URLs.
- List views may use cached metadata such as media count, primary thumbnail metadata, captured time, media intent, and latest linked media timestamp.
- Detail views should load full media links lazily and request signed URLs only when the user opens the relevant media.
- V1 offline media browsing is limited to media already stored locally, recently cached thumbnails, or unsynced local captures. Already-synced cloud media is not guaranteed to be viewable offline after its signed URL expires.
- If complete offline media browsing becomes a launch requirement, the app needs an explicit local media cache policy and likely Capacitor/native filesystem support.
- Exports should never join or embed image bytes. Clean ledger exports should remain small even when records have many linked photos.
- Media link tables should be indexed by owner, linked record id, media intent, and captured/created time so photo-to-ledger and ledger-to-photo lookup stays fast as the database grows.
- Uploaded images should support server-side or client-side resizing, thumbnail generation, and metadata extraction so normal UI views do not depend on full-resolution originals.
- The app should not auto-delete user-retained meal photos, attachments, or explicitly kept evidence by surprise. Temporary receipt/invoice scan working files should expire through a clear TTL policy.

Data portability requirements:

- Clean ledger export remains separate from media-heavy backup export.
- Full backup export should support a ZIP-like package containing structured CSV/JSON metadata, media files, and a manifest mapping ledger ids, media ids, link ids, and file paths.
- Backup export should preserve enough source/link metadata to restore or inspect relationships outside the app.

Long ledger performance requirements:

- Ledger views should use cursor pagination or bounded date windows rather than loading every historical transaction.
- The default ledger view should be recent-first, with quick jumps by month, year, account, category, and event.
- Large reports should use indexed filters and, when needed, derived summaries instead of scanning every row on each page load.
- The primary read path for Overview, Ledger, and reports should use confirmed official records or a flattened read model, not the full AI/OCR/import/source graph.
- Source, draft, invoice, statement, media, and lineage tables should be treated as review/detail data unless the user explicitly opens related evidence.
- Future implementation can use materialized views, summary tables, or trigger-maintained read models in Supabase to keep report reads fast.
- The UI should support incremental loading so multi-year ledgers remain usable with tens of thousands of records.

### Data Lineage And AI/OCR Pipeline

AI/OCR data must preserve lineage from source input to draft to confirmed ledger record. The app should not collapse raw evidence, OCR text, AI suggestions, user edits, and official ledger records into one table.

Pipeline stages:

- `raw_source`: original media, imported spreadsheet row, invoice record, statement row, or other external evidence.
- `interim_extraction`: OCR text, parsed table rows, detected merchant text, detected totals, or other machine-readable extraction output.
- `processed_suggestion`: AI/OCR suggested fields such as transaction kind, merchant, item/name, category, amount, account, source, event, links, or duplicate candidates.
- `user_decision`: accepted, edited, rejected, ignored, merged, split, or left unresolved.
- `official_record`: confirmed ledger record written only after explicit user confirmation or an enabled auto-record rule.

Lineage requirements:

- Drafts and suggestions reference their source records.
- AI/OCR suggestions should record model provider, model name, model version when available, prompt/template version, parser version, and run timestamp.
- Suggestions should record which extracted features were used, such as detected amount, merchant text, invoice number, date/time, account hint, keywords, location hint, or prior-record match.
- Feature-to-suggestion mapping should be inspectable enough to debug why a category, merchant, account, duplicate, or link was suggested.
- For receipt and invoice scans, raw scan files, OCR text, prompt text, and detailed model traces are temporary working data unless the user explicitly retains them.
- Official ledger records can reference retained source records through link tables, but confirming a ledger record should not require keeping raw scan images or full OCR/AI traces.
- Temporary scan working data should have a TTL. The exact duration can be configurable, but the product rule is that scans are input workflow artifacts, not permanent ledger content.
- External-source domains such as official cloud invoices and account statement rows can remain as synchronized source records because they are provider-derived records, not raw scan working files.
- V1 should avoid over-normalizing AI/OCR traces. Temporary extraction, feature, and model-trace data can be stored as a compact `JSONB` payload on the draft or import job rather than split into many relational tables.
- V1 should define a maximum size for `extraction_payload`. Oversized trace data should be stored as a temporary object-storage file with a database pointer instead of bloating Postgres rows.
- V1 should define a small schema for `extraction_payload`, including required keys, allowed source types, parser/model identifiers, candidate fields, confidence hints, and error state. It should not be an unbounded dump of arbitrary provider output.
- Edge Functions should validate and sanitize `extraction_payload` before writing it. Invalid candidate values should be dropped, downgraded, or marked for `manual_review`.
- Candidate amounts must be non-negative for expenses and refunds, currencies must be allowed values, and implausible dates or extreme deviations from related history should lower confidence instead of silently producing high-confidence drafts.
- Oversized payload objects should use compensating cleanup instead of assuming atomic transactions across Postgres and object storage. If pointer creation fails, the object should be deleted or marked orphaned; if draft confirmation/deletion/expiry happens, the object should be queued for cleanup.
- Temporary payload objects should carry owner, draft/import job id, status, and expiry metadata when possible.
- Full prompts, raw model outputs, screenshots, and verbose traces should not be stored by default unless debug mode, explicit user retention, or a support workflow requires them.
- After confirmation, the app should discard that working payload according to TTL unless the user explicitly retains source evidence or a future debugging/retention setting says otherwise.
- User edits and rejections of suggestions should be logged as decision events for audit and future assistant improvement.
- Suggestion feedback can be used for future ranking or classification only as user-owned product data; it should not silently train an external model without a separate consent decision.

AI/OCR degradation and model-choice requirements:

- AI/OCR failure, timeout, offline status, or queue delay must not block manual ledger entry.
- The frontend must not call external AI/OCR providers directly with provider API keys.
- Cloud AI/OCR requests should go through a server-controlled boundary such as Supabase Edge Functions, where the app can enforce authentication, rate limits, file limits, queueing, and cost controls.
- Public AI/OCR endpoints should also be deployable behind platform abuse controls such as WAF rules, IP/request throttling, bot mitigation, or provider-level quota alerts when the hosting stack supports them.
- A scan or import draft can remain in `pending_ai`, `ai_failed`, or `manual_review` state while the user edits fields manually.
- If AI/OCR finishes after the user has confirmed or edited fields, it may add suggestions but must not overwrite user-confirmed fields.
- The app can offer cloud AI/OCR for better accuracy and optional local/offline model processing for weak-network or privacy-first situations.
- Cloud and local model suggestions should be labeled by source, such as `cloud_model`, `local_model`, or `manual`, and both remain draft-only until confirmed.

AI governance requirements:

- Suggestion outcome statistics should be attributable by model/provider version, prompt/template version, source kind, merchant, account, category, and decision outcome when applicable.
- The first version only needs to store enough outcome data for later review. A full AI accuracy dashboard can be deferred.
- A future settings panel should be able to show accept/edit/reject patterns and let the user reset, disable, or clear learned suggestions for a merchant, category, account, or source type.
- User-owned learned mappings and preferences should be deletable without deleting official ledger records.

### Invoice Records

`invoice_records` and `invoice_line_items` represent structured invoice data from scans, imports, or official Ministry of Finance cloud invoice sync. Imported invoices should create transaction drafts first, then become official ledger transactions only after review.

V1 scope note: V1 should treat invoice data as scan/import draft source metadata. It should not implement the full provider-sync invoice domain unless the scope is explicitly reopened.

Invoice records are external-source records, not the same as the app's official ledger records. They should be stored in their own invoice domain, stay synchronized with the official source when available, and link to app ledger records through explicit matching/link tables.

Invoice linking rules:

- One invoice can link to multiple app ledger records.
- Invoice line items do not need to match the user's ledger split exactly.
- Example: one invoice containing face wash and bananas can link to two app records, one for face wash and one for bananas.
- Shared or multi-person purchases may only be partially represented in the user's ledger because the app records the user's own spending.
- The app can automatically link an invoice to an already recorded ledger entry, suggest missing ledger entries, or let the user manually link an invoice to existing records.

Invoice deduplication rules:

- Official cloud invoice sync, manual invoice scan, and imported invoice data should deduplicate by stable invoice identifiers when available, such as invoice number, period, seller, random code, total amount, and invoice date.
- API-synced invoice data should not overwrite user-confirmed ledger records automatically.
- High-confidence matches between an external source and an existing confirmed ledger record can auto-link as a non-blocking notice when stable identifiers, amount, date, and merchant evidence agree.
- Auto-linking existing records is different from auto-creating official ledger records. New official ledger records still require confirmation unless covered by an explicit trusted auto-record rule.
- If a scanned invoice already produced a ledger draft or confirmed ledger record, a later official cloud invoice sync should create or update the external invoice record and suggest a link or merge.
- Deduplication conflicts should become review tasks showing the scanned source, synced invoice, existing ledger records, and suggested action.
- User choices should include link to existing, merge duplicate external records, create missing ledger draft, ignore, or keep separate.

### Account Statement Records

Bank account, digital wallet, and credit card statement data should be stored in a separate external-source domain. These records represent electronic passbook or statement output from providers and then link to the app's ledger records.

V1 scope note: V1 should only support statement-like data as manual import or CSV/spreadsheet source metadata if implemented at all. Provider API sync, full statement domain automation, and complex reconciliation UI are V2/spike work.

Statement sync rules:

- Synced statement records can only increase through provider sync.
- Synced statement records should not be removed by sync if the provider stops returning older rows.
- Manual adjustment can hide, correct, or mark statement records, but provider sync itself should not silently delete them.
- The app can automatically link statement records to already recorded ledger entries, suggest missing ledger entries, or let the user manually link a statement row to existing records.
- Statement records are evidence/source records; official ledger entries remain the app's confirmed accounting records.

Statement deduplication rules:

- Statement rows should deduplicate by provider account, transaction time/date, amount, direction, counterparty/description, and provider transaction id when available.
- Synced statement rows should never silently create official ledger records. They create suggested matches or drafts until confirmed, unless the user has enabled an explicit auto-record rule.
- High-confidence statement-to-ledger matches can auto-link as a non-blocking notice when amount, date/time, account, and counterparty evidence agree.
- If a statement row matches a manual ledger record, the system should suggest a link rather than duplicate the ledger entry.
- If a statement row matches an auto-recorded ledger record by date, merchant, or provider hint but the amount differs, the app should create a review task instead of ignoring the mismatch.
- If an imported statement row conflicts with existing records, the conflict remains in review until the user resolves it.

### Security And Access Control

Sensitive files and source records, including receipt images, invoice images, OCR text, invoice records, and statement rows, must be protected at the storage and API layer, not only by frontend UI warnings.

Security requirements:

- Object storage keys must be scoped by user or tenant ownership and should not be guessable.
- Direct public reads are not allowed for receipt, invoice, meal, or statement evidence files.
- File access should use short-lived signed URLs generated only after server-side authorization. First version should target minute-scale validity, such as 5 to 15 minutes.
- Signed URL requests must verify the current user's ownership or explicit sharing permission.
- Deleting or hiding a source file should immediately block future signed URL generation. Already-issued signed URLs may remain valid until expiry.
- V1 should not use proxy-read for ordinary media because routing every image through the backend would hurt CDN caching and app responsiveness. Proxy-read can remain a future option for explicitly high-sensitivity evidence.
- V1 accepts eventual invalidation for already-issued signed URLs. The UI should not promise that every previously issued URL becomes unreadable instantly after deletion.
- Media marked as highly sensitive can use stricter cache settings such as `Cache-Control: no-store`, shorter signed URL TTLs, or a future proxy-read path.
- Cache headers for sensitive files should avoid shared public caching. CDN caching must not make deleted or hidden sensitive files available beyond the signed URL/access policy.
- Row-level security must protect structured records in Supabase tables.
- Link tables must also enforce ownership so users cannot link their ledger records to another user's media, invoices, or statements.
- Signed URL issuance must use server-side ownership checks and must be tested for IDOR-style horizontal access attempts, especially before any future sharing or split-bill collaboration features.
- Deleting or hiding sensitive source data should revoke future access links where possible and prevent new signed URLs.
- Temporary receipt and invoice scan files should use `Cache-Control: no-store` or equivalent private non-shared caching by default.
- Audit logs should record security-relevant source access and destructive actions at least enough to debug accidental exposure or deletion.
- Account deletion should have a separate destructive-data workflow from ordinary record deletion. It should include database deletion/anonymization, object-storage deletion, provider credential revocation, and audit/retry visibility.
- R2 or other object-storage files selected for permanent deletion should enter a deletion queue so failures can be retried and audited.
- Once a source file is queued or marked for deletion, new signed URL generation must stop immediately. Already-issued signed URLs may remain usable only until their short expiry.

External provider credentials require stricter handling than ordinary app data:

- Ministry of Finance identifiers, bank tokens, wallet tokens, and credit card sync credentials must be encrypted at rest.
- Provider credentials should be stored separately from normal ledger records and never exposed to the browser after setup.
- Server-side sync jobs should access provider credentials through a narrow service boundary.
- Credentials should be scoped per user and provider account.
- Revoking a provider connection should stop future sync jobs without deleting already imported source records unless the user separately deletes them.
- Expired, revoked, or invalid provider credentials should mark the connection as `reauth_required` or `auth_expired`, stop pretending the sync is current, and surface a user-visible notification.
- Sync status should show last successful sync time, last failed sync time, failure reason category, and whether user action is required.
- Sync jobs should use retry limits and exponential backoff for transient failures.
- Jobs that require expired or revoked credentials should pause until the user re-authenticates rather than repeatedly calling provider APIs.
- Logs must not include raw provider tokens, authorization codes, or secrets.

### Drafts And Suggestions

Import, OCR, and AI workflows should produce draft records. Drafts can suggest transaction fields, meal fields, links, categories, and duplicate warnings without changing the official ledger until the user confirms them.

Import review must handle incomplete spreadsheet rows. The user may import rows that only have date, merchant, amount, account, or a partial note. The app should keep the partial row as a draft, show missing fields, and suggest matches from nearby records, merchants, accounts, invoices, photos, or repeated patterns. Incomplete imported rows may be stored before confirmation, but they must not enter the official ledger until the user confirms them.

Import review requirements:

- Preserve the original row values even when the parsed transaction is incomplete.
- Mark missing required fields clearly.
- Let the user search old records while reviewing a draft.
- Suggest likely account, amount, merchant, category, and linked records when enough evidence exists.
- Allow the user to confirm, edit, merge with another draft, ignore, or leave unresolved.
- Keep guessed fields visually distinct from user-confirmed fields.
- Block incomplete or unconfirmed import drafts from official ledger exports and reports.
- Support undo for recent import-review actions.
- Support reverting a whole time range of imported or edited records.
- Keep enough local and database backup/audit data to recover from incorrect imports or bulk edits.
- Log suggestion decisions, including accept, edit, reject, ignore, merge, split, and undo.

Idempotency requirements:

- Manual create, batch confirm, import confirm, and auto-record APIs should accept or generate an idempotency key.
- Idempotency keys should be generated when a draft/action is created or when work enters the offline queue, not only at request-send time.
- Queued work should persist the same idempotency key across reloads, reconnects, and retries.
- Batch confirmation should have stable per-batch and per-draft item keys so partial retries do not duplicate completed rows.
- Repeating the same request with the same idempotency key must not create duplicate official ledger records.
- Batch confirmation should record per-draft results so a retry can complete only unfinished items.
- Official ledger records created from drafts should retain a reference to the source draft or recurrence occurrence to prevent duplicate confirmation.
- Client UI should still disable repeated submit actions, but backend idempotency is required.

Auto-record recovery requirements:

- Every scheduled sync, recurrence, or auto-record job should have a run id.
- Official ledger records created by a job must reference the originating run id and source records.
- The user should be able to review and revert an auto-record run as a batch if it created incorrect or duplicate records.
- Reverting an auto-record run should preserve audit history. The first version can archive, void, or reversal-mark generated records instead of hard-deleting them.
- Auto-record jobs should use safety thresholds. If a run would create an unexpectedly large number of official records, it should stop and ask for review.

Draft lifecycle requirements:

- Unconfirmed drafts, reminders, and variable-amount recurrence items should remain visible until the user resolves, snoozes, archives, or deletes them.
- Drafts should not silently become official ledger records because they are old.
- The app should support stale-draft states, such as `needs_review`, `snoozed`, `overdue`, `archived`, and `ignored`.
- Recurring variable-amount drafts can accumulate across cycles, but the UI should group and warn instead of leaving an unbounded flat list.
- The first version should surface review pressure when unresolved items exceed a simple default threshold, such as 10 active review items or items older than 14 days. These thresholds can become configurable later.
- Overview, Capture, and Imports should show review counts so `缺漏支出`, failed imports, and old AI/OCR drafts do not disappear into a hidden queue.
- Bulk review tools should support common cleanup actions such as assign category/account/source, snooze, archive, ignore, merge, mark as `缺漏支出`, or confirm selected drafts.
- Bulk approve is allowed only for drafts that satisfy required-field validation and user-visible confidence/source rules. High-risk AI/OCR suggestions should not become official records merely because the model is confident.
- Trusted auto-record rules are allowed when explicitly enabled by the user for narrow cases such as fixed subscriptions or fixed transfers.
- Cleanup should archive or hide only by user action or explicit retention setting, not by surprise deletion.

`unresolved_expense` lifecycle requirements:

- A `缺漏支出` record can remain as low-information spending when the user only knows statistical time/period, amount, and account.
- When merchant, item/name, category, and other required expense fields are later completed, the app should prompt the user to convert it to a normal `expense`.
- Conversion should preserve the same stable record id and existing links when possible, using status/kind changes plus audit history instead of creating a replacement record that breaks references.
- Reports should count unresolved expenses as spending until converted, archived, or explicitly corrected.

### Offline And Sync Conflict Handling

The app should be usable for short weak-network moments such as commuting, brief travel gaps, or quick capture during outdoor activities. V1 does not promise durable multi-day offline operation for hiking or international travel. Offline support should protect capture speed first; server-side AI/OCR and provider sync can wait.

Offline requirements:

- Manual ledger entries, meal records, scan intents, and media capture metadata can be saved locally before upload.
- Offline media files remain local and pending upload until the network is available.
- OCR, AI parsing, invoice sync, and account statement sync should be queued until the device reconnects.
- Local records should have temporary local ids and idempotency keys so server reconciliation can map them to canonical records without duplicating entries.
- The UI should show sync state such as `local only`, `uploading`, `queued for OCR`, `synced`, `conflict`, and `failed`.

Conflict rules:

- Sync must not silently overwrite user-confirmed local changes with server or provider data.
- Drafts, official records, source records, and link records should use optimistic concurrency control, such as a version field or checked `updated_at`, for user edits and background jobs.
- Background sync jobs must check the expected version before updating a user-editable draft or record.
- Version mismatches should become merge/conflict tasks rather than silent overwrites.
- If an offline record later matches an imported invoice, statement row, or existing server record, the app should create a link/merge review task rather than duplicate the official ledger record.
- Non-conflicting offline additions should sync automatically.
- V1 should not promise automatic field-by-field merging for version conflicts. If the same record changed on both local and server, preserve both versions and ask the user to choose or manually merge.
- Field-level merge can be revisited later for narrow safe fields, but tags, media links, relationship links, amounts, accounts, and official/draft status should not be auto-merged in V1.
- If both sides changed the same important field, such as amount, account, date, merchant, category, or official/draft status, the conflict should preserve both versions and ask the user to choose, merge, or keep separate.
- Conflict UI should show human-readable summaries and proposed outcomes, not JSON-level diffs.
- Draft conflicts can offer actions such as keep local, keep cloud, duplicate as separate draft, archive old version, or decide later.
- V1 may model a version conflict as a separate `conflict` draft or review item rather than mutating the original record in place.
- Confirmed official records should not use silent last-write-wins. If an automatic choice is made for a low-risk draft, the overwritten version should remain recoverable in history.
- Large conflict sets should be grouped by source batch, date range, provider, or record type so the user is not overwhelmed by one notification per row.
- Backend idempotency still applies after reconnect, so retrying queued requests does not create duplicate official records.

### Search, Filtering, And History Lookup

Search is a core ledger feature, not an optional reporting add-on.

The ledger should support filters for:

- Date range and statistical period.
- Account and currency.
- Transaction kind, including income, expense, refund, transfer, fund addition, adjustment, and `缺漏支出`.
- Category, child category, tag, event/project/activity, and source.
- Merchant, item/name, note-like source text, and imported source label.
- Amount range.
- Linked evidence, such as invoice, receipt scan, account statement row, meal record, or media.
- Review state, such as confirmed, draft, unresolved, needs review, archived, ignored, or conflict.

History lookup should also power manual entry suggestions, import review, photo-to-ledger lookup, and ledger-to-photo lookup.

### Reference Data Lifecycle

Accounts, categories, merchants, sources, tags, and events are reference data. Historical ledger records should remain understandable after reference data changes.

Lifecycle rules:

- Accounts or categories used by confirmed ledger records should not be hard-deleted by default.
- Deleting in the UI should normally archive or hide the reference value from new entry while preserving historical records.
- Historical records should retain enough display text to remain readable even if the reference value is later renamed or archived.
- Category merge, account rename, and merchant cleanup should create audit events or migration records.
- If a reference value must be permanently deleted for privacy reasons, the app should require explicit confirmation and explain the effect on historical records and reports.

