# Auth Provider Setup

## Email and Password

Enable Email in Supabase Auth. The auth callback route is `/account`; add the
deployed URL and every local review origin to Supabase Authentication > URL
Configuration > Redirect URLs, and set the Site URL to the deployed app — see
[Auth URL
Configuration](../../engineering/frontend-hosting.md#auth-url-configuration)
for the exact allow-list. Local review uses:

```text
http://127.0.0.1:5200/account
```

Password reset returns to that URL, and the Site URL decides where reset and
confirmation emails link (never a local address in production). Registration
may require email confirmation according to the Supabase Email provider
setting; routine email/password sign-in does not use Magic Link. Sending those
emails in production uses Resend as custom SMTP — see
[Email delivery](../../engineering/email-delivery.md).

## Google

1. Configure the Google OAuth consent screen, then create a Web application
   OAuth client.
2. In Google Cloud, add this **Authorized redirect URI**:

   ```text
   https://rolsgcftiqvobdfzsktu.supabase.co/auth/v1/callback
   ```

   This is the Supabase callback, not the local MealLedger URL.
3. In Supabase, enable Google and enter the client ID and client secret.
4. In Supabase Authentication > URL Configuration, add the URL that
   receives the completed session (the `/account` callback route):

   ```text
   http://127.0.0.1:5200/account
   ```

## Facebook

1. Create a Meta/Facebook application with Facebook Login enabled.
2. Add `https://rolsgcftiqvobdfzsktu.supabase.co/auth/v1/callback` as a valid
   OAuth redirect URL.
3. Request the email permission, then add the app ID and secret in Supabase.
4. Confirm the deployed `/account` URL is in Supabase Redirect URLs.

## Verification

Use a new test account for each provider. After provider sign-in returns to
Settings, verify the local-data handoff counts before confirming cloud sync.
Do not place provider client secrets in Vite environment files or the repo.

## Deferred

LINE Login remains out of scope for V1. It needs a separately configured
custom OAuth/OIDC provider before any UI is added.
