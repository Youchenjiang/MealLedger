# App Shell Test Plan

The app shell is low accounting risk, so verification focuses on build, routing, smoke tests, layout, and state visibility.

## Build

Test `npm run build` succeeds.

Test generated artifacts such as `dist/` are not committed.

## Routing

Test app loads at `http://127.0.0.1:5173/`.

Test Overview route renders.

Test Ledger route renders.

Test Capture route renders.

Test Meals route renders.

Test Imports route renders.

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

Test local-only indicator can render.

Test review queue entry can show zero and non-zero counts.

## Empty States

Test each V1 section has a useful empty state.

Test empty states do not claim that fake balances or fake records are real.

Test Capture page shows manual entry, scan, meal photo, and attachment actions.

## Browser Smoke

Test browser console has no errors on initial load.

Test desktop layout has no obvious overlapping text.

Test mobile layout has no obvious overlapping text.

Test UI remains readable with longer Traditional Chinese labels.
