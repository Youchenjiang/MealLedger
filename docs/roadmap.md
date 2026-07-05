# MealLedger Long-Term Roadmap

MealLedger uses lightweight agile planning with risk-driven testing. The long-term product direction is a unified personal finance timeline that connects manual ledger entries, meal photos, AI drafts, official cloud invoices, and account transactions.

## Phase 0: Development Workflow

- Define the project workflow before continuing feature UI work.
- Keep `main` deployable and use short-lived `feature/*`, `fix/*`, `docs/*`, and `chore/*` branches.
- Document frontend build, verification, ignored artifacts, and PR expectations.
- Preserve current app-shell work until this workflow is merged.

## Phase 1: App Shell + Auth

- Build a Vite + React + TypeScript PWA.
- Add Supabase Auth login.
- Provide core navigation: Overview, Ledger, Meals, Photos, Imports.
- Verify with production build, browser smoke test, and clean console logs.

## Phase 2: Manual Ledger + Clean Export

- Add CRUD for accounts, categories, merchants, transactions, and transfers.
- Export `ledger_export` as CSV and JSON.
- Keep exports free of image bytes and base64 media.
- Test amount handling, transfers, export shape, and row-level security.

## Phase 3: Meal Photo Linking

- Upload original photos to Cloudflare R2.
- Store meal records, media metadata, and transaction candidate links in Supabase.
- Support photo-to-ledger and ledger-to-photo navigation.
- Keep AI output as draft or suggestion data until the user confirms it.

## Phase 4: Taiwan Cloud Invoice Import

- Run a spike against official Ministry of Finance e-invoice documentation and access requirements.
- Design an invoice import adapter so the core ledger is not tightly coupled to one provider.
- Add invoice import domains:
  - `invoice_import_accounts`
  - `invoice_import_runs`
  - `invoice_records`
  - `invoice_line_items`
- Start with scheduled sync. Upgrade to push or webhook-style import only if the official service supports it.
- Convert imported invoices into transaction drafts, not final ledger transactions.

## Phase 5: Reconciliation Timeline

- Combine invoices, meal photos, manual transactions, and account payment records in one timeline.
- Match invoices to transactions by merchant, amount, time, and account.
- Allow one meal to link to photos, invoices, and payment records.
- Handle duplicate imports, refunds, missing line items, and cross-day purchases.

## Phase 6: AI Collaboration

- Add receipt/photo OCR.
- Add natural-language expense capture.
- Suggest missing entries, duplicate entries, and unusual categories.
- Require explicit user confirmation before AI-generated drafts become official ledger records.

## Phase 7: Analytics + Maintenance

- Add monthly reports, dining spend, merchant rankings, and foreign-currency summaries.
- Add backup and restore workflows.
- Keep ledger export separate from media backup.
- Keep media storage replaceable across R2, Supabase Storage, and S3-compatible providers.

## Roadmap Rules

- Prefer small PRs aligned to one phase or one vertical slice.
- For ledger, invoice, export, and RLS work, define acceptance cases before implementation.
- For UI shell and navigation work, use build checks and browser smoke tests.
- For invoice import, use fake fixtures only; never commit real invoice data.
- Backend ownership and provider boundaries are defined in [Backend Architecture](backend-architecture.md).
