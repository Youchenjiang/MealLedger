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

## Task 6: Capture-To-Review Handoff

Status: Complete

Capture can hand a local preview draft to Ledger. Ledger displays or discards it; it does not confirm or write official ledger records in this spec. Detailed form fields and validation are accepted under Manual Ledger, not App Shell.

Expected verification:

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
- Playwright opens the local-only workspace, creates a local draft, and shows it in Ledger.
- Playwright asserts no browser console/page errors and no document-level horizontal overflow at desktop and mobile sizes.

## Scope Boundary

Spec 1 ends at local draft review. It deliberately excludes accounting-field acceptance, confirmation, official ledger writes, Supabase persistence, import parsing, image upload, meal entries, AI/OCR, and localization implementation. Those belong to later specs.

## Final Verification Evidence

The original app-shell verification is retained as historical evidence. The current branch's consolidated gate, including later specs and hardening reviews, is recorded in `docs/specs/v1-hardening/test-plan.md`.

## Handoff Note

App Shell stops at navigation, local status visibility, and draft review. The
later `manual-ledger`, `schema-core`, `onboarding`, `capture-media`, and
`v1-hardening` specs extend this shell without changing the historical App
Shell boundary. Current UI closeout also keeps account sign-out in Settings,
not in every page header.
