# Voice Capture Design

## Current State

Mode A and Mode B are implemented on branch `feature/voice-capture`:

- The Capture page shows the two-mode header (整段口說 / 逐欄口說), Mode B
  defaulting, and a collapsed "其他方式" area for manual form, scan, and
  photos.
- Mode A reuses `AiLedgerPanel`: Web Speech API (`zh-TW`) or typed text →
  `requestAiJson` → `parseDraftSuggestions` → field-block group per draft →
  per-field review → confirmed write.
- Mode B uses `ModeBPanel` plus `src/ai/modeB.ts`: fixed field order, per-field
  Web Speech capture, per-field AI correction via the same `requestAiJson`
  pipeline with a single-field prompt, raw-transcript fallback without AI, and
  a final confirm through the existing write boundary.
- Field blocks, inferred marks, and new-entity badges are shared between the
  panels.

The direct audio path (ADR 0013) is **planned, not implemented**.

## Shared Field Blocks

One `FieldBlockGroup` component renders a draft's fields with per-block state:

- `filled` — a value is present and shown.
- `current` — the block is being edited.
- `pending` — empty, waiting to be filled.

Editing is in place: click a block to edit, change the value, blur/Enter to
finish. Transfer drafts additionally show a `transferAccount` block. Inferred
values and not-yet-existing entities reuse `InferredSpan` and `NewEntityTag`.

## Mode A

Flow:

```
input (text / browser speech / photo)
  → requestAiJson → parseDraftSuggestions (unchanged)
  → each suggestion renders as a field-block group (replaces the
    one-line SuggestionCard as the primary presentation)
  → user reviews and edits fields in place
  → confirm → confirmSuggestion / resolveAndPersist with the entity policy
```

- Multiple suggestions render as separate block groups (第 1 筆 / 第 2 筆),
  each confirmed independently.
- Invalid drafts (`draft === null`) keep the issues list + apply-to-form
  actions; there are no fields to render.
- The ask policy dialog (`AskNewEntitiesDialog`) and the
  create-then-write order are reused unchanged (ADR 0012 / ADR 0003).

## Mode B

Field model (`src/ai/modeB.ts`):

```ts
type ModeBField = "date" | "kind" | "account" | "category" | "counterparty"
                | "itemName" | "amount";
const MODE_B_FIELDS: ModeBField[] = [ ... fixed order ... ];
```

Per-field prompts and correction rules:

| field | prompt example | correction (when AI is configured) |
|---|---|---|
| date | 請說日期(例如:七月二十五、7/25、昨天) | `YYYY-MM-DD`, fills the current year, resolves 昨天/前天 |
| kind | 請說類型(支出、收入或轉帳) | `expense` / `income` / `transfer` via fuzzy match |
| account | 請說帳戶名稱 | match existing accounts; keep the spoken name when the policy allows new entities |
| category | 請說類別 | match existing categories; same policy rule as account |
| counterparty | 請說對象或店家 | trimmed spoken text |
| itemName | 請說品項 | trimmed spoken text |
| amount | 請說金額(例如:兩百五十、480) | arabic numerals (兩百五十 → 250), strip commas/currency symbols |

Single-field correction contract: one prompt per field built from the field
definition + correction rule + "only return JSON `{"value":"…"}`"; the user
message is the current field's raw transcript. `parseFieldCorrection` trims
the returned value into a string and falls back to the raw transcript on
missing/malformed output without blocking the flow.

State machine (`ModeBPanel`):

```
step        — 0..6, indexes MODE_B_FIELDS
values      — confirmed values per field
transcript  — current field's raw recognition result
corrected   — current field's AI correction candidate (or transcript when no AI)
correcting  — correction in flight
listening   — Web Speech session active
message/error
```

Flow: current block highlights with its prompt → speak → `onresult` sets
`transcript` → correction when AI is configured → the input is prefilled with
the candidate labelled 已校對/原始辨識結果, editable → 填入此欄 confirms and
advances → 上一步 / 重新說一次 available → after all seven fields, a
`DraftForm` is assembled and validated (`createTransactionDraft`), then 確認存檔
writes through the existing boundary.

The date step uses a native date input; a typed date is resolved locally to
`YYYY-MM-DD` before the field is confirmed, so the correction prompt and the
final draft agree on the value format.

Final assembly: kind/date/amount/category/account use the corrected values;
currency comes from the matched account (TWD when unmatched); synthetic
accounts are merged like `parse.ts` does.

## Direct Audio Path (Planned)

Not yet implemented. Design intent from
[ADR 0013](../../decisions/0013-direct-audio-parse-coexists-with-browser-asr.md):

- Opt-in per utterance on the AI panel (a toggle or separate action), only
  when AI is configured.
- MediaRecorder capture with microphone permission; recording-failure and
  permission-denied states are readable and do not break the transcript path.
- Audio bytes become a third input type beside text and photos in the same
  client interface: providers that accept audio inline (Gemini
  `inline_data`) do audio → JSON in one call; others do
  transcription-then-parse behind the same interface.
- Payload rules: size caps and client-side downsampling so base64 audio stays
  under the edge-function body limit; the `ai-parse` edge function forwards
  audio alongside text/photo.
- Degradation states: recording failure, provider rejects audio, timeout.
  Any failure leaves the transcript path available for the same utterance.
- Offline: unavailable until offline AI (V2+) adds a local audio model; the
  browser transcript path remains the offline voice capture.

Open implementation questions to resolve in the spike before coding:

- Audio container/codec and target duration limits per utterance.
- Downsampling parameters (sample rate, channels) and their effect on zh-TW
  accuracy.
- How the toggle is presented per utterance without adding cognitive load to
  the default transcript flow.

## Edge Function

Text today; must forward audio when the direct path lands. Reuses the
existing `ai-parse` auth-gated proxy (CORS, server-side key, body cap, auth
gate). Local development keeps the direct-provider fallback with
`AI_REQUIRE_AUTH=false`.

## Rejected Alternatives

- **Audio vectors/embeddings as the LLM input.** Feeding the LLM the audio
  encoder's embeddings (Pengi/LLaVA-style audio-LLMs such as SALMONN, LTU,
  GAMA; see the PAL study, arXiv:2506.10423) is a research architecture:
  the model must be trained on millions of audio-text pairs, and no hosted
  API exposes the embedding path. Embeddings are lossy semantic
  representations, so exact lexical fields — amounts (480 vs 48), account
  and category names — survive poorly, which is exactly what ledger parsing
  depends on. Rejected for both training cost and accuracy.
- **Server-side ASR only, without an audio-native path.** Whisper-class
  transcription plus the existing text parse is the industry-default cascade
  and roughly 10–50x cheaper than audio tokens, but it reintroduces a lossy
  transcript stage and a second provider. ADR 0013's motivation was precisely
  that a garbled zh-TW transcript poisons everything downstream, so the
  direct path keeps both options: audio → JSON in one call when the provider
  accepts audio inline (Gemini), transcription-then-parse behind the same
  interface otherwise.
- **Browser ASR as the only voice input.** The browser transcript path stays
  the default (free, on-device, no bytes off the device), but its zh-TW
  accuracy is the weak link that motivated the direct path; it is not
  upgraded or replaced, only coexisted with.

## References

- [Voice capture plan](../../product/voice-capture-plan.md)
- [Mode A blueprint](../../product/mode-a-blueprint.md)
- [Mode B blueprint](../../product/mode-b-blueprint.md)
- [ADR 0009](../../decisions/0009-voice-capture-two-modes.md)
- [ADR 0010](../../decisions/0010-mode-b-defaults-to-ai-correction.md)
- [ADR 0013](../../decisions/0013-direct-audio-parse-coexists-with-browser-asr.md)
- [ADR 0012](../../decisions/0012-ai-capture-entity-policy-configurable.md)
- [AI ledger drafts spec](../ai-ledger-drafts/requirements.md)
- [Offline AI spec](../offline-ai/requirements.md)
