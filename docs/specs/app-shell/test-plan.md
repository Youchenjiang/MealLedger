# App Shell Test Plan

The app shell is low accounting risk, so verification focuses on build, routing, smoke tests, layout, and state visibility.

## Automated Gate

Test `npm run test` succeeds.

Test `npm run test:coverage` succeeds before committing app-shell behavior changes.

The initial app-shell coverage threshold is 70% lines, 70% functions, 70% statements, and 60% branches. Raise the thresholds as logic moves out of the shell into domain modules.

Automated tests must cover the minimal signed-out to signed-in navigation path, manual draft creation, transfer draft validation, draft review visibility, draft discard, and the rule that draft creation does not create confirmed ledger records.

## Test Layers

### Unit Tests

Run `npm run test`.

Vitest covers the pure manual-draft helper in `src/appShell/drafts.ts`:

- trim and required-field validation
- transfer destination validation
- non-transfer draft kinds without a transfer destination
- draft-only output shape with no confirmed-record fields

### React Integration Tests

Run `npm run test`.

React Testing Library covers the signed-out entry point, all core navigation, safe unknown-route recovery, offline/online state, zero/non-zero draft counts, Capture availability states, draft kinds, draft creation, and discard behavior.

### Browser Smoke

Run `npm run test:e2e`.

Playwright uses a dedicated local Vite server on `127.0.0.1:4174`, so it does not reuse the regular development server. It covers the signed-out-to-Ledger draft flow, console/page errors, and document-level horizontal overflow at 1440px desktop, 720px compact, and 390px mobile viewports.

Playwright HTML reports and failed-test artifacts remain ignored by git.

### Independent Review

Before closing the spec, use three read-only reviews:

- UX: first-use clarity and whether Capture/Ledger communicate the ledger-first workflow.
- QA: requirements and test-plan coverage against the implementation.
- Responsive: mobile and desktop layout stability, overflow, and touch-target concerns.

Blocking review findings must be fixed before the final verification run. Non-blocking findings are documented as later-spec follow-ups.

## Verification Evidence

Final verification is recorded on 2026-07-11:

- `npm run test`: 21 Vitest and React Testing Library tests passed.
- `npm run test:coverage`: passed. Statements 91.86%, branches 87.05%, functions 85.45%, and lines 92.03% exceed the initial thresholds.
- `npm run test:e2e`: 4 Playwright tests passed for the signed-out-to-Ledger draft flow, 1440px desktop, 720px compact, and 390px mobile.
- `npm run build`: passed.

Read-only reviews were performed for UX, QA, and responsive behavior. UX and QA blocking findings were fixed before final verification:

- Copy now makes clear that Spec 1 stops at local draft review; it does not advertise an unavailable confirmation action.
- Local-only status appears while local drafts exist and disappears after the final draft is discarded.
- Tests cover native incomplete-form validation, offline navigation, and the active navigation state.

The responsive review found no blocking issue. It confirmed that the Ledger table deliberately scrolls inside its own `.table-card` container; Playwright asserts this containment at mobile width.

Later-spec follow-ups include dynamic field labels by transaction kind, a plain-language explanation of adjustments, localization implementation, and fully actionable import/export tools.

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

Test expense, income, transfer, refund, and adjustment draft kinds can be selected.

Test transfer draft submission requires a transfer account.

Test submitted manual draft appears in the Capture review summary.

Test submitted manual draft appears in the Ledger review queue.

Test a submitted manual draft can be discarded from the Ledger review queue.

Test confirmed ledger records remain empty after draft creation.

## Browser Smoke

Test browser console has no errors on initial load.

Test browser console has no errors after creating a manual draft.

Test desktop layout has no obvious overlapping text.

Test mobile layout has no obvious overlapping text.

Test UI remains readable with longer Traditional Chinese labels.

## Scope Boundary

The browser and integration suites must not claim that a draft can be confirmed in Spec 1. This spec intentionally stops at local draft creation, review visibility, and discard; official ledger writes belong to the later ledger spec.
