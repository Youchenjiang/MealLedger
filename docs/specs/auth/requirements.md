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
mismatches locally before calling Supabase.

WHEN the user types a password into any Account page password field
THE SYSTEM SHALL mask the value by default and provide a per-field visibility
toggle button that reveals or hides it.

WHEN the user activates the visibility toggle
THE SYSTEM SHALL switch only that field between masked and revealed, update
the toggle's accessible label to match the state, and never log or persist the
revealed value.

WHEN the user leaves and returns to the Account page
THE SYSTEM SHALL reset all password fields to their masked default.
