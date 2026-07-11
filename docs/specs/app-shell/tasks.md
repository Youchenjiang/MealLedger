# App Shell Tasks

## Task 1: Project Shell

Status: Complete

Vite, React, and TypeScript provide the app shell.

Expected verification:

- `npm run build`

## Task 2: Route Layout

Status: Complete

Overview, Ledger, Capture, and Settings render from the shell. Unknown paths show a recovery page.

Expected verification:

- RTL and Playwright smoke tests confirm core navigation and route rendering.

## Task 3: Responsive Navigation

Status: Complete

Primary navigation adapts from a sidebar to a compact mobile navigation row.

Expected verification:

- Playwright verifies 1440px desktop and 390px mobile viewports have no document-level horizontal overflow.
- Current route is visually indicated.

## Task 4: Empty States

Status: Complete

Each V1 page states what is currently available instead of presenting fake balances, records, or tools.

Expected verification:

- Each section has meaningful content and no broken links.

## Task 5: Status Indicators

Status: Complete

The shell shows offline/local-preview state and zero/non-zero local draft review counts.

Expected verification:

- Local draft creation updates the review count.

## Task 6: Minimal Manual Draft Flow

Status: Complete

Capture creates local transaction drafts. Ledger displays or discards them; it does not confirm or write official ledger records in this spec.

Expected verification:

- User can enter date, account, type, category, merchant/source, amount, currency, and optional note.
- User can create initial expense, income, transfer, refund, and adjustment draft kinds.
- Transfer drafts require a transfer account.
- Submitted draft appears in the Ledger review queue.
- User can discard a submitted draft from the Ledger review queue.
- Confirmed ledger records remain empty.

## Task 7: Final Smoke Test

Status: Complete

Final verification runs before the PR is opened.

Expected verification:

- `npm run test`
- `npm run test:coverage`
- `npm run test:e2e`
- `npm run build`
- Playwright opens the signed-out state, enters the workspace, creates a local draft, and shows it in Ledger.
- Playwright asserts no browser console/page errors and no document-level horizontal overflow at desktop and mobile sizes.

## Scope Boundary

Spec 1 ends at local draft review. It deliberately excludes confirmation, official ledger writes, Supabase persistence, import parsing, image upload, meal entries, AI/OCR, and localization implementation. Those belong to later specs.

## Final Verification Evidence

Verified on 2026-07-11:

- `npm run test`: 20 tests passed.
- `npm run test:coverage`: 91.73% statements, 86.74% branches, 85.45% functions, and 91.89% lines.
- `npm run test:e2e`: 4 Playwright smoke tests passed, including desktop (1440px), compact (720px), and mobile (390px) viewports.
- `npm run build`: production TypeScript and Vite build passed.
- Read-only UX, QA, and responsive review: no remaining blocking finding. The responsive review added a compact-navigation breakpoint check at 720px.
