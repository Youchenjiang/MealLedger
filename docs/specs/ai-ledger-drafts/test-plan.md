# AI Ledger Drafts Test Plan

## Unit Tests

- Parsing maps AI JSON to expense, income, and transfer drafts, defaulting
  missing optional fields and using the existing draft validator as the gate.
- Unknown accounts, unknown categories, bad amounts, and unsupported kinds
  produce human-readable issues and no confirmable draft.
- Prefill fills only the fields the model provided, matches accounts and
  categories, leaves unknown account/category blank, and resolves transfer
  destination accounts to matched names.
- The AI client sends provider-shaped requests (OpenAI chat-completions,
  Gemini generateContent) and parses JSON responses; errors surface as
  messages.
- The AI client routes text to `AI_MODEL` and images to `AI_VISION_MODEL`,
  and signs edge-proxy requests with the gateway key and session token;
  proxy 401 responses explain the login requirement.

## Edge Function Resilience And CORS

- Transient provider failures (529, 429, 5xx, network/timeout exception)
  retry with exponential backoff plus jitter and succeed on a later attempt.
- All attempts failing returns the last status as `ai_request_failed:<status>`
  with HTTP 502; a 4xx failure does not retry.
- A single attempt exceeding the per-attempt timeout aborts and is treated as
  transient.
- CORS: preflight OPTIONS answers 204 with `apikey` in allow-headers;
  `access-control-allow-origin` echoes a matching origin from the
  comma-separated list and is absent for a disallowed origin; non-POST
  methods answer 405.
- The auth gate rejects a request without a valid session with 401, and is
  bypassable when `AI_REQUIRE_AUTH=false`; oversized bodies answer 413.

## Panel Tests

- Typed text produces suggestions and confirming one creates an official
  record through the existing boundary.
- Saving a suggestion as a draft pushes it into the local review queue.
- The apply-to-form action is offered for valid and invalid suggestions and
  forwards the suggestion.
- Unconfigured AI shows a setup message without breaking manual entry.
- Speech input (when browser speech recognition is available) starts and stops
  a recognition session, transcribes results into the same text-input path,
  and resets the recording state on end or error; an unsupported browser
  shows a readable message instead of starting a session.
- Photo input reads a selected file, shows its name, and submits image-only
  entries through the receipt prompt.
- Receipt photos are downscaled before sending to keep payloads within the
  edge-function body limit.
- An empty submission asks for input without calling the AI.
- A pending request shows loading and disables submit until it finishes.
- An AI failure shows the returned error message and leaves the panel usable.
- A zero-result response shows an explanation and offers no confirm actions.

## App Integration

- Applying a suggestion opens the manual ledger form with the identified
  fields filled; unknown account/category stay blank and the user can
  complete and save the record through the manual boundary.

## Gates

- `npm run test`
- `npm run build`
- `npm run test:e2e`
- `git diff --check`
