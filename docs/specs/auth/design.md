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

## Sign-in, Sign-up, and Password Reset Views

The Account page separates sign-in, account creation, and password reset into
distinct views instead of one shared form, so the user always knows which
flow they are in:

- A segmented control switches between **Sign in** and **Create account**;
  each view keeps only the fields and primary action for that flow.
- **Sign-up** adds a **Confirm password** field; mismatched values are
  rejected locally before any Supabase call. If the email already belongs to
  an account, the view switches back to **Sign in** with the email kept, and
  shows an existing-account message instead of a raw provider error.
- **Forgot password** is its own view: email plus **Send reset link**, with
  **Back to sign in** to return. Sign-in itself no longer fires a reset
  email from a background link.
- The recovery view (set new password) is its own flow: the app owns callback
  hash handling (`detectSessionInUrl: false`), maps `type=recovery` links to
  the `password-recovery` state directly, and guards the view against late
  `INITIAL_SESSION` / `SIGNED_IN` emissions from supabase-js so the form is
  not overridden back to a sign-in.

## Recovery Link Handling

Recovery links arrive in two shapes and are redeemed by the same callback
parser (`restoreOAuthCallbackSession`):

- **Implicit-grant** links carry `access_token` / `refresh_token` in the URL
  fragment with `type=recovery`; they are redeemed with `setSession`.
- **PKCE** links carry `token_hash` in the query string with `type=recovery`;
  the single-use hash is redeemed with `verifyOtp({ type: "recovery",
  token_hash })`. When the client has no `verifyOtp` capability the hash path
  is ignored.

Either redemption maps to the `password-recovery` state; a failed or expired
token maps to `auth-error` with the provider's message, never a silent
sign-in. After redemption `clearAuthCallbackHash` strips the fragment and the
`token_hash` / `type` query parameters so a reload cannot re-redeem the
single-use token. `recoveryStartup` suppresses late `INITIAL_SESSION` /
`SIGNED_IN` emissions that would otherwise override the form.

The email's link target is chosen by `passwordResetRedirect()`: when
`VITE_AUTH_REDIRECT_URL` is configured it returns
`<VITE_AUTH_REDIRECT_URL>/account` (stable across devices); when it is unset
`redirectTo` is omitted so Supabase links the email to its Site URL — the
link never points at the instance that sent the request.

Embedded webviews (desktop shell, in-app browsers) can strand the callback in
the OS browser instead of the app. The forgot-password view therefore offers a
collapsed quiet action, **Reset link opened in another browser? Paste it
here**, that expands to a URL field and **Use reset link**; pasting any
recovery or OAuth callback link runs it through the same parser
(`recoverPasswordFromLink`). The rescue stays collapsed by default so it does
not compete with the primary **Send reset link** action.

Supabase's default email service caps sends at 2 per hour. `requestPasswordReset`
maps rate-limit errors to an explanatory message that names the cap and
mentions configuring Custom SMTP to remove it.

## Password Visibility Toggle

Every password input on the Account page — `account-password` (sign-in),
`account-confirm-password` (sign-up), and `account-new-password` (recovery) —
renders inside a `password-field` wrapper with an eye toggle button
(`Eye` / `EyeOff` from lucide-react) positioned at the field's right edge.

- All fields start masked (`type="password"`); activating the toggle flips
  only that field to `type="text"` and back.
- The toggle is a `type="button"` with an accessible label that follows the
  state: `Show password` when masked, `Hide password` when revealed. The icon
  is `aria-hidden`; the label is the accessible name.
- Visibility state is per-field component state (`passwordVisible`,
  `confirmPasswordVisible`, `newPasswordVisible`) and resets whenever the
  Account page remounts or the user switches auth views, so a revealed field
  never persists across navigation.
- Revealing a password changes only the input's presentation; it never alters
  the auth boundary, the values submitted to `signIn`/`signUp`/`updatePassword`,
  or what is logged or stored.

## Linked Sign-in Methods

A signed-in account can attach Google or Facebook identities so any linked
provider opens the same workspace. The signed-in view lists **Sign-in
methods**: the email/password identity (when present) is marked **Primary**,
and Google and Facebook each show a **Link** or **Unlink** action based on
the session's `identities`.

- Linking starts the provider OAuth flow through `linkIdentity` and redirects
  back to the Account page; the returned session carries the new identity.
- Unlinking removes only that provider identity and never deletes the
  workspace. Supabase rejects unlinking the last remaining identity, and that
  error surfaces in the account message without logging the user out.
- The visible list reflects `session.user.identities`, so signing in with a
  linked provider shows that provider as linked.

## Security Boundary

- Browser code never receives service-role credentials.
- Session state comes from Supabase Auth, not a local boolean.
- A signed-out or expired session cannot issue cloud writes.
- Auth errors must not erase local data.
- The visibility toggle is presentation-only and must never log, store, or
  submit the revealed value in plaintext anywhere except the input itself.
