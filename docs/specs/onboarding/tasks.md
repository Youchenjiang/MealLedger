# Onboarding Tasks

## Task 1: Define Onboarding State — Complete

Define how the app detects new users and incomplete setup.

Expected verification:

- User with no account enters onboarding.
- User with at least one account can reach Overview.

## Task 2: Build First Account Step — Complete

Create first account form with name, type, currency, negative-balance option, and starting balance choice.

Expected verification:

- Required account fields validate.

## Task 3: Add Initial Funds Explanation — Complete

Add UI copy that distinguishes initial funds from income.

Expected verification:

- Starting balance creates fund-addition behavior, not income behavior.

## Task 4: Add Default Taxonomy Step — Complete

Offer default taxonomy setup.

Expected verification:

- Categories, tags, and aliases can be applied once.

## Task 5: Add Optional Import Entry — Deferred

Add optional spreadsheet import entry point.

Expected verification:

- User can skip import and continue.

## Task 6: Add Sync Guidance — Partial

Add local-only and persistent-storage warning copy.

Expected verification:

- Persistent storage denied state has clear guidance.

## Task 7: Final Smoke Test — Complete

Run final onboarding smoke test.

Expected verification:

- onboarding completes to Overview
- skipped onboarding can be reopened from Settings
- mobile layout has no overlapping text

## V1 Closeout Evidence

- Unit/domain: `src/onboarding/initialFunding.test.ts`, `src/taxonomy/defaults.test.ts`.
- React integration: `src/App.test.tsx` covers first setup, skip, current-balance fund addition, and taxonomy idempotency.
- Browser smoke: `npm run test:e2e` — 6 tests passed.
- Coverage: `npm run test:coverage` — 85.98% statements, 77.43% branches.
- Build and hygiene: `npm run build`, `git diff --check` passed.

## Explicitly Deferred

- Import entry is available from Settings and remains a separate review-first workflow.
- Persistent-storage permission prompts and cloud account provisioning require the Supabase/runtime integration spec.
