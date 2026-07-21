# Auth Tasks

## Specification

- [x] Separate user identity from ledger accounts.
- [x] Define local-only use without an authenticated session.
- [x] Exclude Magic Link from the default app entry flow.
- [x] Define provider-neutral verification and session states.
- [x] Define explicit local-data handoff rules.
- [x] Select email/password as the V1 provider; keep Google OAuth deferred.

## Implementation

- [x] Add an explicit account-verification action outside the primary capture
      flow.
- [x] Implement the Supabase email/password provider adapter.
- [ ] Add callback, session-expiry, sign-out, and auth-error handling.
- [ ] Add an explicit local-data handoff review before cloud claiming.
- [x] Remove the temporary Magic Link UI and action.

## Out Of Scope

- Anonymous cloud accounts.
- Shared or organization accounts.
- Provider invoice or bank authorization.
- Passwordless email as a routine sign-in requirement.
