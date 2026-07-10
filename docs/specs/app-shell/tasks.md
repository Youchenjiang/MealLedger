# App Shell Tasks

## Task 1: Project Shell

Create the Vite + React + TypeScript app structure if it does not already exist.

Expected verification:

- `npm run build`

## Task 2: Route Layout

Add routes for Overview, Ledger, Capture, and Settings.

Expected verification:

- Browser smoke test confirms each route renders.

## Task 3: Responsive Navigation

Implement primary navigation for mobile and desktop.

Expected verification:

- Desktop and mobile viewport screenshots or manual notes.
- Current route is visually indicated.

## Task 4: Empty States

Add empty states and placeholders for each section.

Expected verification:

- Each section has meaningful content and no broken links.

## Task 5: Status Indicators

Add offline, sync-not-enabled, and draft review count UI.

Expected verification:

- Local draft creation updates the review count.

## Task 6: Minimal Manual Draft Flow

Add a local manual transaction draft form to Capture.

Expected verification:

- User can enter date, account, type, category, merchant/source, amount, currency, and optional note.
- User can create initial expense, income, transfer, refund, and adjustment draft kinds.
- Transfer drafts require a transfer account.
- Submitted draft appears in the Ledger review queue.
- User can discard a submitted draft from the Ledger review queue.
- Confirmed ledger records remain empty.

## Task 7: Final Smoke Test

Run final verification before PR.

Expected verification:

- `npm run build`
- app loads at a local Vite URL
- signed-out state opens the workspace
- Overview navigates to Capture
- Capture creates a local draft
- Ledger shows the local draft in the review queue
- console has no errors
- desktop and mobile layouts have no overlapping text
