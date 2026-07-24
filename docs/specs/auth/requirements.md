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
- V1 SHALL use an ordinary email/password account. Google OAuth remains a
  deferred provider option behind the same adapter boundary.
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

WHEN the provider is changed
THE SYSTEM SHALL preserve the same user-owned ledger boundary and must not
create a second local copy silently.
