# Auth Test Plan

## Unit Tests

- Provider-neutral auth state transitions.
- Email/password validation and authenticated-session success.
- Signed-out and expired sessions remain local-only.
- Authentication failures do not clear local data.
- Local-data handoff requires explicit confirmation.
- Handoff failure leaves local records unchanged.

## Integration Tests

- App opens the workspace without an authenticated session.
- Cloud sync remains disabled while local-only.
- Authenticated session enables cloud persistence only after ownership checks.
- Sign-out stops cloud writes while preserving local records.
- Session expiry returns the app to local-only without data loss.
- The normal entry screen contains no Magic Link form.

## Browser Smoke

- Local-only user can create a ledger record and export it.
- Authenticated user can sign in from Settings and enable cloud sync.
- Verification action reaches the selected provider flow.
- Successful callback returns to the workspace.
- Provider cancellation returns to local-only.
- Mobile and desktop layouts keep local-only and verification actions distinct.
- No console or page errors occur in each state.

## Exit Gate

Auth implementation is not complete until the provider decision is recorded,
all provider-specific tests pass, local-only behavior remains available, and
the full project test/build commands pass.
