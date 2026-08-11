# ADR 0010: Mode B Defaults To AI Field Correction With An Offline Fallback

## Status

Accepted

## Decision

In Mode B (逐步口說), AI field correction is the **default** whenever AI is
available (cloud or local): the current field's speech transcript is normalized
into the field's required format (amount, date, account/category match) through
a per-field prompt, and the corrected value is shown for confirmation before it
is written.

The raw transcript is written unchanged only when the app is offline and no
offline AI is enabled. Offline, the user chooses between enabling offline AI
(local model) or writing the raw result.

Correction is never a gate: without AI, Mode B still completes with the raw
transcript. All corrected values remain draft/suggestion data until the user
confirms, per ADR 0003.

## Context

Mode B was originally planned as AI-free: the speech transcript would go
straight into the current field. During design review, the expectation flipped:
users speaking an entry field by field still expect "兩百五十" to land as `250`
and "七月二十五" as `2026-07-25`, so correcting the transcript is the normal
case, not an enhancement. The flip is easy to question again because it changes
the default behavior users see, so it is pinned here.

## Consequences

Becomes easier:

- Field values arrive in the format the ledger form expects, in both modes.
- One AI pipeline (`requestAiJson` + a per-field prompt) serves Mode B with
  cloud or offline AI.
- Offline behavior has a clear rule: no AI available → raw transcript.

Becomes harder:

- Mode B needs a per-field prompt contract and a confirmation step per field.
- The AI dependency becomes visible in Mode B, so degradation states (no key,
  offline, model missing) must be surfaced.
- Offline AI choice adds a user-facing decision when offline.

## References

- [Voice capture plan](../product/voice-capture-plan.md)
- [Offline AI requirements](../specs/offline-ai/requirements.md)
- [ADR 0003: Draft-first AI and import suggestions](0003-draft-first-ai-and-import-suggestions.md)
- [ADR 0009: Voice capture two modes](0009-voice-capture-two-modes.md)
