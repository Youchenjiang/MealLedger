# Auth Provider Setup

## Email and Password

Enable Email in Supabase Auth. Add every deployed Settings URL to Supabase
Authentication > URL Configuration > Redirect URLs. Local review uses:

```text
http://127.0.0.1:5200/settings
```

Password reset returns to that URL. Registration may require email
confirmation according to the Supabase Email provider setting; routine
email/password sign-in does not use Magic Link.

## Google

1. Configure the Google OAuth consent screen, then create a Web application
   OAuth client.
2. In Google Cloud, add this **Authorized redirect URI**:

   ```text
   https://rolsgcftiqvobdfzsktu.supabase.co/auth/v1/callback
   ```

   This is the Supabase callback, not the local MealLedger URL.
3. In Supabase, enable Google and enter the client ID and client secret.
4. In Supabase Authentication > URL Configuration, add the Settings URL that
   receives the completed session:

   ```text
   http://127.0.0.1:5200/settings
   ```

## Facebook

1. Create a Meta/Facebook application with Facebook Login enabled.
2. Add `https://rolsgcftiqvobdfzsktu.supabase.co/auth/v1/callback` as a valid
   OAuth redirect URL.
3. Request the email permission, then add the app ID and secret in Supabase.
4. Confirm the deployed Settings URL is in Supabase Redirect URLs.

## Verification

Use a new test account for each provider. After provider sign-in returns to
Settings, verify the local-data handoff counts before confirming cloud sync.
Do not place provider client secrets in Vite environment files or the repo.

## Deferred

LINE Login remains out of scope for V1. It needs a separately configured
custom OAuth/OIDC provider before any UI is added.
