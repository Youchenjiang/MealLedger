# App Shell Test Plan

The app shell is low accounting risk, so verification focuses on build, routing, smoke tests, layout, and state visibility.

## Build

Test `npm run build` succeeds.

Test generated artifacts such as `dist/` are not committed.

## Routing

Test app loads at a local Vite URL.

Test Overview route renders.

Test Ledger route renders.

Test Capture route renders.

Test Settings route renders.

Test unknown routes recover to a safe state or not-found page.

## Navigation

Test primary navigation is visible after signed-in state renders.

Test active route indicator updates when navigating.

Test navigation is usable at mobile width.

Test navigation is usable at desktop width.

## State Indicators

Test signed-out state shows sign-in entry point.

Test signed-in state shows primary navigation.

Test offline indicator can render without blocking navigation.

Test sync-not-enabled indicator can render without presenting itself as an error.

Test review queue entry can show zero and non-zero counts.

## Empty States

Test each V1 section has a useful empty state.

Test empty states do not claim that fake balances or fake records are real.

Test Capture page shows a manual transaction draft form.

Test Capture page shows scan, meal photo, and attachment actions as unavailable future entry points.

## Manual Draft Flow

Test Overview Start a record navigates to Capture.

Test required manual draft fields reject an empty submit through native browser validation.

Test a valid manual draft can be submitted with date, account, type, category, merchant/source, amount, currency, and optional note.

Test submitted manual draft appears in the Capture review summary.

Test submitted manual draft appears in the Ledger review queue.

Test confirmed ledger records remain empty after draft creation.

## Browser Smoke

Test browser console has no errors on initial load.

Test browser console has no errors after creating a manual draft.

Test desktop layout has no obvious overlapping text.

Test mobile layout has no obvious overlapping text.

Test UI remains readable with longer Traditional Chinese labels.
