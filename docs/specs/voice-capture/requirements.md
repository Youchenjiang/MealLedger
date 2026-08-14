# Voice Capture Requirements

## Purpose

Make the Capture page (`/capture`, the bottom-nav center 新增 button) a
voice-first flow with two in-page modes plus a coexisting direct-audio input
path. Voice capture is the primary capture surface; manual form, scan, meal,
and attachment tools moved to the 專區 (Zone) page when `/capture` became
the voice flow.

This spec is the behavior home for [ADR 0009](../../decisions/0009-voice-capture-two-modes.md)
(two modes), [ADR 0010](../../decisions/0010-mode-b-defaults-to-ai-correction.md)
(Mode B per-field AI correction), and [ADR 0013](../../decisions/0013-direct-audio-parse-coexists-with-browser-asr.md)
(direct audio-to-ledger parsing). The parse semantics of AI output into ledger
drafts stay in the [AI ledger drafts spec](../ai-ledger-drafts/requirements.md);
this spec covers the capture surface and the audio mechanics around them.

## Field Blocks

Ledger fields render as blocks in the fixed order
`日期 → 類型 → 帳戶 → 類別 → 對象 → 品項 → 金額`, each block displaying its
state: filled (shows the value) or pending (grey, empty). Mode B lights the
blocks up one at a time; Mode A renders a full block group per parsed draft.

WHEN a field value is inferred by AI rather than typed verbatim
THE SYSTEM SHALL mark it visibly as inferred.

WHEN a suggestion names an account or category that does not yet exist
THE SYSTEM SHALL mark that block with a not-yet-existing badge and treat the
value according to the entity policy ([ADR 0012](../../decisions/0012-ai-capture-entity-policy-configurable.md)),
which is user-configurable per entity type and defaults to existing-only.

## Mode A (整段口說)

WHEN the user is in Mode A and speaks or types a whole entry description
(browser speech recognition is available for speech)
THE SYSTEM SHALL parse the description into prefilled ledger drafts (see the
AI ledger drafts spec) and render each draft as a group of field blocks.

WHEN a Mode A draft is rendered as field blocks
THE SYSTEM SHALL let the user review and adjust each field in place before
saving (per-field confirmation), and keep the existing save-draft and
apply-to-form actions available.

WHEN the user confirms a Mode A draft
THE SYSTEM SHALL write an official ledger record only through the existing
confirmed-record boundary, resolving new entities per the entity policy
([ADR 0003](../../decisions/0003-draft-first-ai-and-import-suggestions.md),
[ADR 0012](../../decisions/0012-ai-capture-entity-policy-configurable.md)).

## Mode B (逐步口說)

WHEN the user is in Mode B
THE SYSTEM SHALL light up one field at a time in the fixed order
`日期 → 類型 → 帳戶 → 類別 → 對象 → 品項 → 金額`, showing a per-field prompt
(e.g. 請說金額) for the current field.

WHEN the user speaks the current field (browser speech recognition is
available)
THE SYSTEM SHALL transcribe it and, when AI is configured, normalize the
transcript into the field's required format through a per-field AI correction
(date to `YYYY-MM-DD`, amount words like 兩百五十 to `250`, account/category
fuzzy match) per [ADR 0010](../../decisions/0010-mode-b-defaults-to-ai-correction.md).

WHEN AI is not configured or the correction fails
THE SYSTEM SHALL keep the raw transcript as the value so Mode B still
completes without AI.

WHEN a per-field correction is shown
THE SYSTEM SHALL display it for the user to confirm or edit before it is
written into the field (correction is never a silent write).

WHEN the user is in Mode B
THE SYSTEM SHALL provide 上一步 (re-fill the previous field) and 重新說一次
(re-record the current field) actions.

WHEN all seven Mode B fields are filled and the user confirms
THE SYSTEM SHALL write an official ledger record only through the existing
confirmed-record boundary, resolving new entities per the entity policy.

## Direct Audio Path (ADR 0013)

WHEN the user chooses the direct audio path for a single utterance and AI is
configured
THE SYSTEM SHALL record the utterance (MediaRecorder) and send the audio bytes
to the configured AI provider, which transcribes and field-parses it into the
same prefilled draft suggestions (see the [AI ledger drafts spec](../ai-ledger-drafts/requirements.md)
for the parse contract).

WHEN the provider accepts audio inline (e.g. Gemini `inline_data`)
THE SYSTEM SHALL perform the audio → JSON step in one call; when the provider
does not accept audio
THE SYSTEM SHALL hide the difference behind the client interface using
transcription-then-parse.

WHEN the direct audio call fails (recording failure, provider rejects audio,
timeout, network error)
THE SYSTEM SHALL show a readable failure state and keep the browser
transcription path available as a fallback for the same utterance.

WHEN the user records audio for the direct path
THE SYSTEM SHALL request microphone permission only when the direct path is
used, and show a readable explanation when permission is denied.

WHEN the user's browser or provider cannot support the direct audio path
THE SYSTEM SHALL keep the direct path unavailable (or hidden) without
breaking the transcript path.

WHEN audio is sent through the edge-function proxy
THE SYSTEM SHALL forward audio alongside text and photo inputs with a size cap
and client-side downsampling so payloads stay within the edge-function body
limit.

## Offline And Degraded Environments

WHEN the app is offline
THE SYSTEM SHALL keep browser transcription and field blocks usable where the
browser supports speech recognition; the direct audio path depends on AI and
is unavailable offline until [offline AI](../offline-ai/requirements.md) (V2+)
adds a local audio model.

WHEN AI credentials are not configured
THE SYSTEM SHALL show a setup message and keep manual entry and Mode B's raw
transcript usable.

## Boundaries

- AI output is draft/suggestion data only; official records are written only
  on the user's confirmed write (ADR 0003).
- The direct audio path is an opt-in choice per utterance, never the default;
  browser transcription remains the default because it is free, instant,
  on-device, and sends no audio bytes off the device.
- Audio bytes leave the device only on the direct path and only through the
  same auth-gated edge-function proxy (or the local direct-provider fallback)
  as text and photos.
- Receipt/meal photos keep their existing entry points; this spec does not
  change [capture media](../capture-media/requirements.md) behavior.
