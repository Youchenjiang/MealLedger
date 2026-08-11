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

## Panel Tests

- Typed text produces suggestions and confirming one creates an official
  record through the existing boundary.
- Saving a suggestion as a draft pushes it into the local review queue.
- The apply-to-form action is offered for valid and invalid suggestions and
  forwards the suggestion.
- Unconfigured AI shows a setup message without breaking manual entry.

## App Integration

- Applying a suggestion opens the manual ledger form with the identified
  fields filled; unknown account/category stay blank and the user can
  complete and save the record through the manual boundary.

## Gates

- `npm run test`
- `npm run build`
- `npm run test:e2e`
- `git diff --check`
