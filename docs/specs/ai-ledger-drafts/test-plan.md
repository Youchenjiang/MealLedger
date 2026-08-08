# AI Ledger Drafts Test Plan

## Unit Tests

- Parsing maps AI JSON to expense, income, and transfer drafts, defaulting
  missing optional fields and using the existing draft validator as the gate.
- Unknown accounts, unknown categories, bad amounts, and unsupported kinds
  produce human-readable issues and no confirmable draft.
- The AI client sends provider-shaped requests (OpenAI chat-completions,
  Gemini generateContent) and parses JSON responses; errors surface as
  messages.

## Panel Tests

- Typed text produces suggestions and confirming one creates an official
  record through the existing boundary.
- Saving a suggestion as a draft pushes it into the local review queue.
- Unconfigured AI shows a setup message without breaking manual entry.

## Gates

- `npm run test`
- `npm run build`
- `npm run test:e2e`
- `git diff --check`
