# AI Ledger Drafts Design

## Current V1 Boundary

The V1 branch ships an AI capture panel that turns typed text, spoken
descriptions, or receipt/invoice photos into prefilled ledger drafts that the
user confirms before anything becomes an official record. AI output is
draft/suggestion data only, per ADR 0003. The feature adds no database tables:
suggestions live in panel state, saved drafts go through the existing local
review queue, and confirmed records go through the existing
official-record boundary.

## Entry And Navigation

- The Capture page offers an `AI 補帳` intent that opens the AI panel.
- The panel accepts three input paths that all converge on the same
  parse-and-confirm flow:
  - typed text in a textarea
  - speech through the browser Web Speech API (`SpeechRecognition` /
    `webkitSpeechRecognition`, `zh-TW`)
  - a receipt/invoice photo picked from disk

## Input Pipeline

1. The user submits text, a photo, or both.
2. The client builds the system prompt from the current accounts, categories,
   and local calendar date, and the user prompt from the text (or a dedicated
   line-item prompt when only a photo is provided).
3. `requestAiJson` sends the request: the production route posts to the
   `ai-parse` Supabase Edge Function proxy; the local-development fallback
   calls the provider directly (OpenAI chat-completions or Gemini
   generateContent shape).
4. The response is parsed into validated draft suggestions with
   human-readable issues for unparseable fields.

## AI Client Routing

- `AI_EDGE_FUNCTION_URL` selects the edge-function proxy: the key stays
  server-side, CORS is handled, the model is server-controlled, bodies are
  capped at 4 MB, and the caller must present a valid auth token by default.
  Local development can disable the auth gate with `AI_REQUIRE_AUTH=false`.
- Without a proxy URL, the client calls the provider directly. Text requests
  use `AI_MODEL`; image requests use `AI_VISION_MODEL` when set and fall back
  to `AI_MODEL`. Direct calls carry a 90-second client timeout.
- Receipt photos are downscaled to 1600 px on the client before sending so
  base64 payloads stay under the edge-function body limit.

## Provider Resilience And CORS

The `ai-parse` proxy retries transient provider failures instead of exposing
them as hard errors:

- Each attempt is bounded by `AI_PROVIDER_TIMEOUT_MS` (default 20s) via an
  AbortController; a hung endpoint aborts and counts as transient.
- Retryable statuses are 429, 500, 502, 503, and 529 (Anthropic overload),
  plus network/timeout exceptions; 4xx failures are permanent and fail
  immediately.
- Retries use exponential backoff from `AI_PROVIDER_BACKOFF_MS` (default
  300ms) doubling up to `AI_PROVIDER_BACKOFF_MAX_MS` (default 2s), with up to
  half-backoff jitter, for up to `AI_PROVIDER_MAX_ATTEMPTS` (default 3). The
  worst case (~60s plus backoff) stays under the client's 90s request
  timeout, so the user sees one bounded answer rather than a hung call.
- After the budget is exhausted the last failure status is returned as
  `ai_request_failed:<status>` with HTTP 502; every parameter is tunable via
  function secrets.

CORS is handled server-side so any allowed frontend works:

- `APP_ORIGIN` is a comma-separated allow-list (default `*`; auth is enforced
  by the bearer token, so an open origin does not weaken the endpoint). The
  response echoes the matching request origin instead of a fixed header.
- `access-control-allow-headers` lists `authorization, apikey, content-type`;
  `apikey` is required because the app sends the publishable anon key on
  every call, and a missing allow-header blocks the browser even when the
  origin matches.
- OPTIONS answers 204; other non-POST methods answer 405.

The client maps a network-layer failure of the proxy request to a message
covering both provider overload and connectivity, because the browser cannot
read the proxy's error response (CORS) and cannot distinguish the two causes.

## Parsing And Validation

- Kinds are restricted to expense, income, and simple same-currency transfer;
  unknown kinds are rejected, not defaulted.
- Dates normalize to `YYYY-MM-DD` (accepts `M/D`, `YYYY/M/D`); missing dates
  default to today. Amounts strip commas, currency symbols, and spaces.
- Accounts and categories match case-insensitively against the user's actual
  lists; unknown accounts or categories produce issues and no confirmable
  draft, but stay available for manual completion through apply-to-form.
- Transfers resolve the destination to the matched account name and reject
  same-account transfers.
- Every suggestion passes the existing draft validator before it can be
  confirmed or saved.

## Confirmation Boundaries

- `確認寫入` creates an official record through the existing
  official-record boundary, tagging it with `AI`.
- `存草稿` pushes the suggestion into the local draft review queue.
- `填入表單` prefills the manual ledger form with the fields the model
  identified, leaving unknown accounts and categories blank; it never writes
  an official record or draft by itself.
- Failed suggestions never create drafts or records; issues are shown with
  the suggestion so the user can complete fields manually.

## Privacy And Data

- Provider keys are never committed; the production proxy keeps them
  server-side, while the local-development direct path reads them from
  environment variables (a deployed build would expose them, so the proxy is
  the production route).
- Photo bytes are used for the AI call only and are not retained as media;
  image bytes stay outside clean ledger exports.
- Speech is transcribed in the browser and only the resulting text is sent;
  audio is never uploaded.

## Known Constraints

- OpenAI does not permit browser CORS, and NVIDIA NIM also rejects browser
  calls; browser direct calls therefore require the edge-function proxy.
- Browser speech recognition is provider-dependent: it needs connectivity in
  Chrome/Edge and is unavailable in some browsers (for example Firefox).
  Transcribed text is inserted verbatim; there is no STT correction layer, so
  spoken-form numbers rely on the model and the user's review.
- Verified live (2026-08): `meta/llama-3.1-8b-instruct` parses text reliably;
  `meta/llama-3.2-11b-vision-instruct` splits synthetic receipts but remains
  unreliable on dense small-text receipts.

## Rejected Alternatives

- **Direct browser calls in production**: keys would be exposed in the bundle
  and OpenAI/NVIDIA reject CORS, so the edge-function proxy is the production
  route.
- **Self-hosted or local ASR**: V1 delegates speech-to-text to the browser API
  instead of running an audio model; offline speech capture is deferred.
- **QR-based e-invoice lookup**: electronic invoice vouchers are not an OCR
  problem (their QR code links to the authoritative Ministry of Finance
  data), so that flow is tracked separately from AI OCR.
- **Auto-recording AI output**: rejected by ADR 0003; AI output stays
  draft-only until the user confirms.

## References

- [Requirements](requirements.md)
- [Test plan](test-plan.md)
- [ADR 0003: Draft-first AI and import suggestions](../../decisions/0003-draft-first-ai-and-import-suggestions.md)
- [Technical operations](../../v1/technical-ops.md)
