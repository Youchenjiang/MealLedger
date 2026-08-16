# Voice Capture Test Plan

Status: mode A/B implemented (branch `feature/voice-capture`, merged to main);
direct audio path cases are marked planned and must not be reported as
implemented.

## Unit Tests

- The Mode B field model exposes the fixed order and one prompt per field.
- The single-field correction prompt is built per field and returns only
  `{"value":"…"}`; `parseFieldCorrection` trims string/number values and
  falls back to the raw transcript on missing or malformed output.
- Mode B assembles the final draft with corrected values, matches
  account/category fuzzy names, defaults currency to TWD when unmatched, and
  validates through `createTransactionDraft` (invalid drafts are rejected with
  a readable message).

## Panel Tests

- Mode A renders each valid draft as a field-block group (第 1 筆 / 第 2 筆 for
  multiple drafts), shows inferred and not-yet-existing marks, supports
  in-place per-field edits, and writes only on confirm (ADR 0003).
- Invalid Mode A drafts keep the issues list and apply-to-form actions.
- Mode B lights up one field at a time with its prompt, fills the current
  field from the corrected (or raw) value after 填入此欄, and advances; 上一步
  reopens the previous field and 重新說一次 re-records the current one.
- Mode B with AI configured normalizes an amount transcript (兩百五十 → 250)
  and a date transcript (七月二十五 → `YYYY-MM-DD`); without AI it writes the
  raw transcript.
- The Mode B date step offers a native date picker, and a typed date resolves
  to `YYYY-MM-DD` locally before the field is confirmed.
- Mode B resolves new entities per policy: existing-only rejects with a
  reason, ask shows the creation dialog, auto creates then writes; creation
  happens only on the confirmed write.
- Mode A/B with unconfigured AI shows the setup message without breaking
  manual entry.
- Browser speech unavailable shows a readable message instead of starting a
  session.

## Direct Audio Path (when implemented)

- Recording starts only on the opt-in action and requests microphone
  permission; denial shows an explanation and leaves the transcript path
  usable.
- Audio bytes are sent as a third input type: provider with inline audio gets
  one audio → JSON call; provider without audio goes through
  transcription-then-parse behind the same interface.
- Payloads are capped and downsampled client-side so base64 audio stays under
  the edge-function body limit.
- Recording failure, provider rejects audio, and timeout each show a readable
  state and offer the transcript path for the same utterance.
- Unsupported browser/offline keeps the direct path unavailable without
  breaking Mode A/B.

## App Integration

- The Capture page shows the two-mode switcher with Mode B default and the
  fixed field-block order; the manual/scan/meal/attachment tools are not on
  the Capture page (they live on 專區); the mode is preserved across
  navigation within the session.
- Confirming either mode creates exactly one official record through the
  existing boundary; the record appears in the Ledger.

## Gates

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run test:e2e`
- `git diff --check`
