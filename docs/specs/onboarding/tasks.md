# Onboarding Tasks

## Task 1: Define Onboarding State

Define how the app detects new users and incomplete setup.

Expected verification:

- User with no account enters onboarding.
- User with at least one account can reach Overview.

## Task 2: Build First Account Step

Create first account form with name, type, currency, negative-balance option, and starting balance choice.

Expected verification:

- Required account fields validate.

## Task 3: Add Initial Funds Explanation

Add UI copy that distinguishes initial funds from income.

Expected verification:

- Starting balance creates fund-addition behavior, not income behavior.

## Task 4: Add Default Taxonomy Step

Offer default taxonomy setup.

Expected verification:

- Categories, tags, and aliases can be applied once.

## Task 5: Add Optional Import Entry

Add optional spreadsheet import entry point.

Expected verification:

- User can skip import and continue.

## Task 6: Add Sync Guidance

Add local-only and persistent-storage warning copy.

Expected verification:

- Persistent storage denied state has clear guidance.

## Task 7: Final Smoke Test

Run final onboarding smoke test.

Expected verification:

- onboarding completes to Overview
- skipped onboarding can be reopened from Settings
- mobile layout has no overlapping text
