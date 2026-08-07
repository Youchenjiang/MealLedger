# Auth Design

## State Model

```text
local-only
    ├─ user chooses account verification ─> authenticating
    └─ user continues recording          ─> local-only

authenticating
    ├─ verified session ─> authenticated
    ├─ cancelled        ─> local-only
    └─ failure          ─> auth-error -> local-only

authenticated
    ├─ sign out/session expiry ─> local-only
    └─ explicit local-data handoff -> cloud sync enabled
```

## Entry Experience

The default first screen is the workspace, not an authentication form. The
user can record a transaction, create a meal, retain a draft, and export local
data without an account.

Cloud verification is an explicit secondary action. Its copy must say that the
account is for backup and synchronization. It must not imply that local ledger
use is unavailable.

## Provider Boundary

The UI depends on provider-neutral operations:

- `signIn(email, password)`
- `signUp(email, password)`
- `requestPasswordReset(email)`
- `signInWithOAuth(provider)`
- `getSession()`
- `signOut()`
- `getVerificationState()`

The V1 provider adapter implements email/password sign-in and sign-up,
password-reset email, Google OAuth, and Facebook OAuth. Routine sign-in must
not require opening an email. Magic Link is not a V1 routine. LINE Login is a
later custom OAuth/OIDC provider, so it has no V1 UI or configuration path.

OAuth and password-reset callback screens validate the Supabase session or
recovery token, then return to Settings for the same explicit local-data
handoff review.

## Local Data Handoff

Local records remain owned by the local workspace until the user confirms a
handoff. The handoff must show counts for accounts, official records, drafts,
meals, and media metadata. A failed handoff leaves the local data unchanged.

Automatic claiming of another user's local data is forbidden. Cloud
persistence, RLS, and idempotency remain governed by the cloud-persistence
spec after authentication succeeds.

## Security Boundary

- Browser code never receives service-role credentials.
- Session state comes from Supabase Auth, not a local boolean.
- A signed-out or expired session cannot issue cloud writes.
- Auth errors must not erase local data.
