# Auth Requirements

## Goal

Define the optional cloud-account verification boundary without making account
verification a prerequisite for local ledger use.

## Scope

This spec covers:

- user identity and session states
- the local-only entry path
- the explicit cloud-account verification path
- provider selection and provider-neutral auth boundaries
- sign-out, session expiry, and authentication errors
- explicit local-data handoff into an authenticated cloud workspace

This spec does not cover ledger accounts such as wallets or bank accounts,
Supabase table persistence, RLS policy design, provider invoice authorization,
or media upload authorization.

## Decisions

- The app SHALL open in a usable local-only workspace when no authenticated
  session exists.
- Authentication SHALL be required only for cloud sync, cloud-backed recovery,
  and other protected cloud features.
- Magic Link SHALL NOT be part of the V1 provider surface.
- V1 SHALL support ordinary email/password accounts, password reset, Google
  OAuth, and Facebook OAuth behind the same adapter boundary.
- Magic Link and LINE Login remain deferred. LINE Login SHALL NOT appear in
  the V1 UI until its custom OAuth/OIDC provider is configured and tested.
- Anonymous cloud accounts, shared ledgers, organization accounts, and
  multi-user collaboration remain out of scope.
- Provider-specific code SHALL stay behind an auth adapter so changing the
  provider does not change ledger or local-storage code.

## Requirements

WHEN the user opens the app without an authenticated session
THE SYSTEM SHALL show the local-only workspace directly.

WHEN the user chooses to verify an account
THE SYSTEM SHALL explain that verification enables cloud sync and does not
change the meaning of existing ledger records.

WHEN an authenticated session is established
THE SYSTEM SHALL show the authenticated cloud status only after the session is
validated by Supabase Auth.

WHEN local-only data exists before verification
THE SYSTEM SHALL require explicit user confirmation before associating it with
the authenticated cloud account.

WHEN the user signs out or the session expires
THE SYSTEM SHALL keep local data available, mark new writes local-only, and
stop cloud writes.

WHEN authentication fails or the provider is unavailable
THE SYSTEM SHALL keep the local workspace usable and show an actionable error
without presenting the workspace as synced.

WHEN a user forgets an email/password account password
THE SYSTEM SHALL send a password-reset link and require a new password before
the account can sign in again.

WHEN a password-reset email is sent
THE SYSTEM SHALL link it to a stable public page — `VITE_AUTH_REDIRECT_URL`
plus `/account` when configured, otherwise the Supabase Site URL — so the
link works on any device and never points at the instance that sent the
request.

WHEN the user opens a recovery link on the app
THE SYSTEM SHALL restore the recovery session — an implicit-grant link
(`#access_token=...&type=recovery`) through setSession and a PKCE link
(`?token_hash=...&type=recovery`) through verifyOtp — and show the
new-password form instead of signing in.

WHEN the recovery token is invalid or expired
THE SYSTEM SHALL show an auth error with the provider's message and never
present a sign-in as if recovery had succeeded.

WHEN a recovery link has been redeemed
THE SYSTEM SHALL strip the callback tokens from the URL so a reload does not
try to redeem the single-use token again.

WHEN a late session event fires after a recovery link has already switched the
view to the new-password form
THE SYSTEM SHALL keep the recovery form instead of overriding it back to
sign-in.

WHEN the reset email cannot be sent because of the provider rate limit
THE SYSTEM SHALL explain the platform limit (Supabase's default email service
allows 2 emails per hour) and mention the Custom SMTP option instead of
showing a bare error string.

WHEN the user opens the forgot-password view
THE SYSTEM SHALL keep the paste-a-reset-link rescue collapsed by default so it
does not compete with the primary send-link action.

WHEN the user pastes a full recovery or OAuth callback link into the
forgot-password view
THE SYSTEM SHALL restore the session through the same callback parser so the
flow finishes on this device (embedded webviews where the email opens in the
OS browser).

WHEN a user chooses Google or Facebook sign-in
THE SYSTEM SHALL complete the provider redirect, validate the resulting
Supabase session, and apply the same local-data handoff rule as email/password
sign-in.

WHEN the provider is changed
THE SYSTEM SHALL preserve the same user-owned ledger boundary and must not
create a second local copy silently.

WHEN the user opens the Account page signed out
THE SYSTEM SHALL show distinct Sign in, Create account, and Forgot password
views so the active flow is always identifiable.

WHEN the user registers with email/password
THE SYSTEM SHALL require a matching confirm-password entry and reject
mismatches locally before calling Supabase. If the email already belongs to
an account, THE SYSTEM SHALL switch to the Sign in view with the email kept
and show an existing-account message instead of a raw provider error.

WHEN the user types a password into any Account page password field
THE SYSTEM SHALL mask the value by default and provide a per-field visibility
toggle button that reveals or hides it.

WHEN the user activates the visibility toggle
THE SYSTEM SHALL switch only that field between masked and revealed, update
the toggle's accessible label to match the state, and never log or persist the
revealed value.

WHEN the user leaves and returns to the Account page
THE SYSTEM SHALL reset all password fields to their masked default.

WHEN the user signs in to a workspace
THE SYSTEM SHALL show the linked sign-in methods and allow Google or Facebook
to be linked or unlinked without leaving the signed-in state.

WHEN the user links a provider
THE SYSTEM SHALL start that provider's OAuth flow and, on success, attach the
provider identity to the current account so later provider sign-in reaches
the same workspace.

WHEN the user unlinks a provider
THE SYSTEM SHALL remove only that provider identity, keep the workspace
intact, and report Supabase rejection when it is the last remaining
sign-in method.
