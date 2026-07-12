# Onboarding Test Plan

## Entry Conditions

Test signed-in user with no accounts sees onboarding.

Test signed-in user with an account sees Overview.

Test signed-out user sees signed-out app shell, not onboarding.

## First Account

Test account name is required.

Test account currency is required.

Test account type is required.

Test start-from-zero creates account without income.

Test current balance creates initial funds behavior without income.

Test account currency cannot be changed after official records exist.

## Default Taxonomy

Test applying default taxonomy creates expense categories.

Test applying default taxonomy creates income categories.

Test applying default taxonomy creates tags.

Test applying default taxonomy creates legacy aliases.

Test applying default taxonomy twice does not create duplicates.

## Import Entry

Test user can skip import.

Test import entry explains review-first behavior.

Test import entry links to the import flow or placeholder.

## Sync Guidance

Test local-only warning appears when cloud backup is not complete.

Test persistent-storage denied copy appears when the browser denies persistence.

Test onboarding remains usable offline with local-only warning.

## Completion

Test completed onboarding routes to Overview.

Test skipped onboarding can be reopened from Settings.

Test onboarding does not create fake sample records.

Test mobile layout has no overlapping text.

## Implemented V1 Coverage

- Local development mode is explicit and does not claim cloud sync when Supabase is not configured.
- New users see first-account setup; setup can be skipped and reopened from Settings.
- Current balance is posted as `fund-addition`, never `income`.
- Default categories, income labels, tags, and aliases are merged case-insensitively and idempotently.
- Magic Link request behavior is covered by `src/auth/authActions.test.ts`; configured Supabase session integration remains environment-dependent.
