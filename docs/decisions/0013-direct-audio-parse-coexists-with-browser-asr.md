# ADR 0013: Direct Audio-To-Ledger Parsing Coexists With Browser Transcription

## Status

Accepted

## Decision

Voice capture gets a **second, coexisting input path**: besides the current
browser speech recognition (Web Speech API) that transcribes first and then
field-parses the text, the AI panel can send the **audio itself** to the AI
provider, which transcribes and splits the fields in one call
(audio → JSON).

The two paths are:

1. **Browser transcription (current, default):** Web Speech API turns speech
   into text locally, then the text goes through the existing
   `requestAiJson` field parser.
2. **Direct audio parsing (new, opt-in):** the panel records the utterance
   (MediaRecorder) and sends the audio bytes to the provider as a third input
   type beside text and photos. Providers that accept audio inline (e.g.
   Gemini `inline_data`) return the ledger JSON in a single call; providers
   that do not (e.g. OpenAI chat models) use transcription-then-parse behind
   the same client interface.

Both paths produce the same JSON draft suggestions, flow through the same
parser (`parseDraftSuggestions`), and obey the same confirmation boundary:
AI output is draft/suggestion data only, official records are written only on
the user's confirmed write (ADR 0003).

Browser transcription remains the default because it is free, instant, runs
on-device, and sends no bytes off the device. Direct audio is an **opt-in
choice per utterance** on the AI panel; it is only available when AI is
configured. Audio bytes travel through the same auth-gated edge-function
proxy (or the local direct-provider fallback) as text and photos. If the
direct audio call fails, the transcript path remains available, and vice
versa. Offline, only browser transcription is available until offline AI
(V2+) adds local audio models.

## Context

Browser speech recognition is the weakest link in the voice flow: its zh-TW
transcription is error-prone, and a garbled transcript poisons everything
downstream — a mangled transcription of 「7/25 中午和同事吃便當」 produced a
draft with a hallucinated amount and none of the real fields. Audio-native
models transcribe zh-TW substantially better, and multimodal providers accept
audio inline so the whole "hear it, split it" step can happen in one AI call
instead of two lossy stages. The trade-off is real — audio bytes leave the
device and the call costs money — so the direct path is an option, not a
replacement.

## Consequences

Becomes easier:

- Better zh-TW accuracy for users who opt in, with one audio → JSON call where
  the provider supports audio.
- The direct path reuses the existing system prompt, JSON schema, parser,
  draft card, and confirmation boundary; no second ledger pipeline.

Becomes harder:

- The panel needs MediaRecorder capture, microphone permission, and a
  path toggle with degradation states (recording failure, provider rejects
  audio, timeout).
- Audio payloads are larger than text; size caps/downsampling rules are
  needed, and the edge function must forward audio alongside text/photo.
- Provider differences must be hidden behind the client interface
  (Gemini single-call vs. OpenAI transcription-then-parse).

Follow-up work:

- The capture half of the direct audio path (recording, permission,
  degradation states, payload caps) is specified in the
  [voice capture spec](../specs/voice-capture/requirements.md); the parse
  half stays in the [AI ledger drafts spec](../specs/ai-ledger-drafts/requirements.md).

## References

- [Voice capture requirements](../specs/voice-capture/requirements.md)
- [Voice capture design](../specs/voice-capture/design.md)
- [Voice capture plan](../product/voice-capture-plan.md)
- [AI ledger drafts requirements](../specs/ai-ledger-drafts/requirements.md)
- [Offline AI requirements](../specs/offline-ai/requirements.md)
- [ADR 0003: Draft-first AI and import suggestions](0003-draft-first-ai-and-import-suggestions.md)
- [ADR 0009: Voice capture two modes](0009-voice-capture-two-modes.md)
- [ADR 0012: AI capture entity policy is configurable per type](0012-ai-capture-entity-policy-configurable.md)
