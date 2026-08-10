# Auth Tasks

## Specification

- [x] Separate user identity from ledger accounts.
- [x] Define local-only use without an authenticated session.
- [x] Exclude Magic Link from the default app entry flow.
- [x] Define provider-neutral verification and session states.
- [x] Define explicit local-data handoff rules.
- [x] Select email/password, Google OAuth, and Facebook OAuth for V1.
- [x] Defer LINE Login until a custom OAuth/OIDC provider is configured.

## Implementation

- [x] Keep user authentication in Settings and ledger-account management in
      Ledger; remove the duplicate sidebar account entry.
- [x] Implement the Supabase email/password provider adapter.
- [x] Add email/password account creation in Settings.
- [x] Keep the local workspace as the default entry without a sign-in gate.
- [x] Add session-expiry, sign-out, and auth-error handling.
- [x] Add an explicit local-data handoff review before cloud claiming.
- [x] Keep first-account setup opt-in from Ledger > Accounts; do not gate the
      workspace.
- [x] Remove the temporary Magic Link UI and action.
- [x] Add `npm run dev:5200` for the review server.
- [x] Add email/password reset and recovery callback flow.
- [x] Separate sign-in, sign-up, and forgot-password into distinct Account
      page views with a segmented mode switch.
- [x] Add confirm-password validation to the sign-up view.
- [x] Add per-field password visibility toggles to the sign-in, sign-up, and
      recovery password fields with stateful accessible labels.
- [x] Add Google OAuth sign-in and callback flow.
- [x] Add Facebook OAuth sign-in and callback flow.
- [x] Add provider configuration and redirect-URL documentation.
- [x] Enable and verify Google and Facebook credentials in the configured
      development Supabase environment.
- [x] Distinguish local-only, signed-in-awaiting-handoff, and sync-enabled
      states in the Settings Account section.
- [x] Keep Settings for user authentication and import/export; keep ledger
      accounts under Ledger > Accounts.
- [x] Link Google and Facebook identities to a signed-in account and list
      them as sign-in methods.
- [x] Unlink a provider identity while keeping the workspace intact.
- [x] Verify the Account page stays within desktop and mobile viewports.

## Verification

- [x] Run the responsive UX, QA, and desktop/mobile review matrix.
- [x] Resolve the narrow-screen auth action wrapping issue.
- [x] Record non-blocking responsive follow-ups and provider boundaries in the
      test plan.
- [x] Run unit/integration tests, coverage, E2E smoke, remote persistence,
      build, and diff checks.
- [x] Re-run local-first entry, handoff, Settings Account layout, and console checks
      after the second-round Auth corrections.

## Out Of Scope

- Anonymous cloud accounts.
- Shared or organization accounts.
- Provider invoice or bank authorization.
- Passwordless email as a routine sign-in requirement.
- LINE Login.
- Production-provider credential rollout beyond the configured development
  Supabase environment.
