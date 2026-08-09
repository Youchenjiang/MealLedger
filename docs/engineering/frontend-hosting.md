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
   | `AI_EDGE_FUNCTION_URL` | `https://rolsgcftiqvobdfzsktu.supabase.co/functions/v1/ai-parse` |

   All four are public by design (Vite inlines build-time env). Secrets such
   as `AI_API_KEY` never belong here — they stay server-side on Supabase.

5. Create the Worker. Cloudflare auto-generates an API token scoped to this
   account (Workers Scripts/KV/R2/D1 edit, Workers Routes, etc.); it is stored
   by Cloudflare and never needs to leave the dashboard.

## Post-deploy wiring (Supabase dashboard)

- **Auth redirect URL**: add the deployed Settings URL to Supabase
  Authentication → URL Configuration → Redirect URLs (see
  `docs/specs/auth/provider-setup.md`). With the default Workers domain:
  `https://mealledger.<subdomain>.workers.dev/settings`.
- **CORS hardening (optional)**: the `ai-parse` edge function accepts
  `APP_ORIGIN` (defaults to `*`). Once the frontend URL is live, tighten it:
  `npx supabase secrets set APP_ORIGIN=https://mealledger.<subdomain>.workers.dev`.

## Verification

1. Open the deployed URL, sign in, and confirm the session lands on Settings.
2. AI: open the AI ledger panel and parse a receipt — the request should reach
   `ai-parse` (bearer auth) and the provider key must never appear in
   DevTools network/console.
3. Deep links: load `https://mealledger.<subdomain>.workers.dev/settings`
   directly (fresh reload) — `single-page-application` mode must serve
   `index.html` (no 404).
4. Media: upload a photo from the Capture screen and confirm it reaches R2.

## Local checks

```sh
npm run build
npx wrangler deploy --dry-run   # validates assets + SPA config without deploying
```
