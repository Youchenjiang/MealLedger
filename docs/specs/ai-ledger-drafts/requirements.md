# AI Ledger Drafts Requirements

## Purpose

Let the user record transactions quickly by describing them (typed or spoken)
or by photographing a receipt, with the app turning the input into prefilled
ledger drafts that the user confirms before anything becomes an official
record.

This follows ADR 0003: AI output is draft/suggestion data only. Official
ledger records are created only by the existing confirmed-record boundary.

## Requirements

WHEN a user enters text that describes one or more transactions
THE SYSTEM SHALL parse it into prefilled ledger drafts for confirmation.

WHEN a user speaks a description (browser speech recognition is available)
THE SYSTEM SHALL transcribe it into the same text-input path.

WHEN a user selects a receipt or invoice photo
THE SYSTEM SHALL send the image to the configured AI provider and produce the
same prefilled draft suggestions.

WHEN a suggestion cannot be validated (unknown account, unknown category,
unparseable amount, or unsupported kind)
THE SYSTEM SHALL show the item with a clear reason and keep it out of the
confirmed records.

WHEN the user confirms a valid suggestion
THE SYSTEM SHALL create an official ledger record through the existing
official-record boundary.

WHEN a suggestion is valid but the user does not want to confirm it yet
THE SYSTEM SHALL let the user save it into the local draft review queue.

WHEN the user applies a suggestion to the ledger form
THE SYSTEM SHALL fill the manual ledger form with the fields the model
identified (date, kind, amount, currency, counterparty, item name, note, and
any matched account, category, or transfer account), leaving unknown accounts
and categories blank for manual completion.

WHEN the user applies a suggestion to the ledger form
THE SYSTEM SHALL not create an official record or draft by itself; the record
is written only when the user saves through the manual ledger form.

WHEN the user applies a valid suggestion to the ledger form
THE SYSTEM SHALL let the user review and adjust the prefilled fields before
saving.

WHEN AI credentials are not configured
THE SYSTEM SHALL show a setup message and keep the entry usable for manual
input.

## Apply to Form Design Notes

Every suggestion card offers an apply-to-form action alongside confirm and
save-draft, so the user can complete an AI suggestion in the manual ledger
form whether or not it passed validation.

- Account, category, and transfer destination are filled only when they
  match an existing account or category; the manual form's account selectors
  otherwise stay blank so the user chooses explicitly.
- Date is normalized to `YYYY-MM-DD`, amounts to a decimal string, and the
  currency defaults from the matched account (TWD when unknown).
- Applying switches the capture view to the manual ledger form and never
  writes an official record or draft by itself; saving goes through the
  manual ledger form boundary. The AI panel is left behind, so unconfirmed
  suggestions from the current AI session are not carried over.

## Boundaries

- AI supports expense, income, and simple same-currency transfer kinds in V1.
- AI never edits or overwrites an existing official record.
- Receipt photos are used for the AI call only; image bytes stay outside clean
  ledger exports.
- Provider API keys are read from environment variables, never committed.

## Production Constraints (Known)

- The V1 client calls the provider directly from the browser. Keys are bundled
  with the app at build time, so a deployed build exposes the key to anyone who
  can read the bundle.
- OpenAI does not permit browser CORS; the OpenAI provider path only works when
  the call is proxied server-side. Gemini accepts browser calls.
- Verified live (2026-08): NVIDIA NIM (`integrate.api.nvidia.com`) also rejects
  browser CORS (`Failed to fetch` in Chromium). Browser direct calls therefore
  require the edge-function proxy.- Production route is the `ai-parse` Supabase Edge Function proxy: the key
  stays server-side, CORS is handled, the model is server-controlled, bodies
  are capped at 4 MB, and the caller must present a valid auth token by
  default. The client posts to `AI_EDGE_FUNCTION_URL` when set; direct calls
  remain only as a local-development fallback. Local development can disable
  the auth gate with `AI_REQUIRE_AUTH=false` so signed-out (local-only)
  workspaces can still use the AI panel; production keeps the gate on.
- Receipt photos are downscaled to 1600 px on the client before sending to
  keep base64 payloads under the edge-function body limit.
- Text parsing uses `AI_MODEL`; image requests use `AI_VISION_MODEL` when set.
  Verified with NVIDIA: `deepseek-ai/deepseek-v4-flash-0731` parses text
  reliably; `meta/llama-3.2-11b-vision-instruct` splits a synthetic receipt into
  line items summing to the 總計 (small-text OCR errors remain, so confirmation
  matters). The 90b vision model times out on the free tier.
- Verified live with a real two-receipt photo: `meta/llama-3.2-11b-vision-
  instruct` is unreliable on dense small-text receipts (repetition loops and
  fabricated amounts), even upscaled 3x. Taiwan invoices come in two forms:
  paper receipts with printed line items (AI OCR path) and electronic invoice
  vouchers whose QR code is the only link to line items (the Ministry of
  Finance API path). The voucher form is not an OCR problem: the correct flow
  is decode the QR (invoice number, random number, seller ID) and query the
  Ministry of Finance e-invoice API, which is authoritative and error-free.
- The Ministry of Finance e-invoice API (`einvoice.nat.gov.tw`) requires a
  free `appID`/`appKey`; without credentials it returns the login page. QR
  decoding of vouchers and the e-invoice query are a follow-up feature tracked
  separately from AI OCR.
