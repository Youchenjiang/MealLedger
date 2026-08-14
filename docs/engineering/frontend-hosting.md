# Frontend Hosting (Cloudflare Workers)

## Decision

The web app is a pure static SPA (Vite + React, History-API routing). All
dynamic features live server-side at Supabase (DB, Auth, Edge Functions) and
Cloudflare R2 (media uploads). The frontend host therefore only needs to serve
static files and rewrite unknown routes to `index.html`.

**Cloudflare Workers (static assets)** was chosen because the project already
runs on Cloudflare R2 (`create-r2-upload-url` edge function,
`src/captureMedia/upload.ts`), so no new vendor or account is introduced: one
dashboard, one set of credentials, and the free tier covers this single-user
app. An assets-only Worker (no `main` script) serves the build output directly
and costs zero billable invocations; SPA fallback is handled by
`assets.not_found_handling = "single-page-application"` in `wrangler.jsonc`.

Alternatives, kept in mind:

- **Cloudflare Pages** — equally capable; the repo was previously wired for
  Pages via `public/_redirects`, but that file was removed: Workers static
  assets reject its catch-all `/* /index.html 200` rule (infinite-loop error,
  code 100324), which failed the Git-integration build. SPA fallback is
  handled solely by `assets.not_found_handling = "single-page-application"`
  in `wrangler.jsonc`.
- **Vercel** — equally capable for this app; the only cost is a second account
  and a `vercel.json` rewrites block. Switch is a five-minute change if ever
  wanted.
- **Self-host (VPS + Caddy/nginx)** — full control but requires server
  maintenance, TLS, and uptime for a single-user app; not justified when
  managed hosting is free.

## Pipeline

Cloudflare **Workers Git integration** (dashboard, not GitHub Actions): every
push to `main` triggers a production deploy; non-production branches get
version-preview deploys. This matches the repo's minimal-CI convention: GitHub
Actions is reserved for the commit-policy and unit-test workflows, with no
deploy workflow. Do not add a `.github/workflows/deploy.yml` while the
dashboard integration is enabled, or every push deploys twice.

Dashboard setup (one-time, needs your Cloudflare account):

1. Cloudflare dashboard → **Workers & Pages → Create → Worker → Connect to Git**.
2. Select the `MealLedger` repo, production branch `main`.
3. Build settings (defaults shown match `wrangler.jsonc`):
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`
   - Non-production branch deploy command: `npx wrangler versions upload`
4. Environment variables (see the "Frontend production build" section in
   `.env.example`):

   | Variable | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://rolsgcftiqvobdfzsktu.supabase.co` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | publishable key from Supabase dashboard → Settings → API |
   | `VITE_LOCAL_DEVELOPMENT_MODE` | `false` |
   | `VITE_AUTH_REDIRECT_URL` | `https://mealledger.g1014308.workers.dev` |
   | `AI_EDGE_FUNCTION_URL` | `https://rolsgcftiqvobdfzsktu.supabase.co/functions/v1/ai-parse` |

   All five are public by design (Vite inlines build-time env). Secrets such
   as `AI_API_KEY` never belong here — they stay server-side on Supabase.
   `VITE_AUTH_REDIRECT_URL` makes password-reset emails link to the deployed
   `/account` regardless of the dashboard Site URL; it must match the Site URL
   and stay in the Redirect URLs allow-list below.

5. Create the Worker. Cloudflare auto-generates an API token scoped to this
   account (Workers Scripts/KV/R2/D1 edit, Workers Routes, etc.); it is stored
   by Cloudflare and never needs to leave the dashboard.

## Post-deploy wiring (Supabase dashboard)

### Auth URL Configuration

Supabase **Authentication → URL Configuration** decides where auth emails and
OAuth callbacks point. This is the setting that determines whether
password-reset and confirmation links land on the deployed app or on a local
dev server, so fix it before sending any auth email to real users.

**Site URL** — the base URL Supabase uses to build links inside auth emails
(reset, confirmation, OTP) when the app does not pass an explicit redirect.
Set it to the deployed app:

```text
https://mealledger.g1014308.workers.dev
```

The production deployment sets `VITE_AUTH_REDIRECT_URL` (see the environment
table above), so password-reset emails link to
`https://mealledger.g1014308.workers.dev/account` even if the dashboard Site
URL drifts. The Site URL still governs confirmation/OTP emails (sign-up does
not pass an explicit redirect) and is the fallback for reset links, so keep it
on the same production domain. Current live values (last `npm run
test:auth-config` run) are **out of spec**: Site URL is `http://localhost:3000`
and the allow-list only has `http://127.0.0.1:5200/settings` plus the
production root — every `/account` URL is missing. That is why auth emails
point at a local dev server instead of the deployed app.

**Redirect URLs** — an exact-match allow-list for where OAuth popups and
recovery callbacks may land. The app's auth callback route is `/account` (see
`src/App.tsx`), so whitelist the deployed URL plus every local review origin:

| URL | Purpose |
|---|---|
| `https://mealledger.g1014308.workers.dev/account` | production sign-in / reset callback |
| `http://127.0.0.1:5200/account` | local review (`npm run dev:5200`) |
| `http://127.0.0.1:4173/account`, `http://127.0.0.1:4174/account` | other local dev / e2e ports |

`http://127.0.0.1:3000/account` is only needed when running the local
`supabase start` stack — the same list lives in `supabase/config.toml` under
`additional_redirect_urls`. The hosted project's allow-list is managed in the
dashboard and is independent of that file. `VITE_AUTH_REDIRECT_URL` is set in
production, so `https://mealledger.g1014308.workers.dev/account` must stay
whitelisted.

Verify the live configuration against this spec with
`npm run test:auth-config` (needs a Supabase access token; see
`scripts/check-auth-config.mjs`).

- **CORS hardening (optional)**: the `ai-parse` edge function accepts
  `APP_ORIGIN` (defaults to `*`). Once the frontend URL is live, tighten it:
  `npx supabase secrets set APP_ORIGIN=https://mealledger.g1014308.workers.dev`.

## Verification

1. Open the deployed URL, sign in, and confirm the session lands on Settings.
2. AI: open the AI ledger panel and parse a receipt — the request should reach
   `ai-parse` (bearer auth) and the provider key must never appear in
   DevTools network/console.
3. Deep links: load `https://mealledger.g1014308.workers.dev/account`
   directly (fresh reload) — `single-page-application` mode must serve
   `index.html` (no 404).
4. Media: upload a photo from the Capture screen and confirm it reaches R2.

## Local checks

```sh
npm run build
npx wrangler deploy --dry-run   # validates assets + SPA config without deploying
```

`wrangler` is intentionally **not** a repository dependency: it is fetched on
demand via `npx` (deploy command in the dashboard integration, dry-run above).
Keeping it out of `devDependencies` avoids pulling `sharp`/`@img/sharp-*`
(LGPL-3.0-or-later) into `package-lock.json`, which the license scan flags.
Pin the deploy tool when reproducibility matters with
`npx wrangler@<version> deploy`.
