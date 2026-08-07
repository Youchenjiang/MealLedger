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

WHEN AI credentials are not configured
THE SYSTEM SHALL show a setup message and keep the entry usable for manual
input.

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
- Before production rollout, route AI calls through a Supabase Edge Function
  (same pattern as `create-r2-upload-url`) so the key stays server-side and the
  OpenAI path works in the browser.
