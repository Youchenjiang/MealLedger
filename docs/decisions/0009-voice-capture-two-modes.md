# ADR 0009: Voice Capture As The Primary Capture Flow With Two Modes

## Status

Accepted

## Context

The Capture page (`/capture`) is the app's main entry point (ADR 0006 makes it
the center "＋" action), and the product direction makes voice the primary
capture flow. V1 ships only a single AI panel that parses one whole utterance
into prefilled drafts; step-by-step field capture and the field-block layout
are planned but not decided.

Two interaction styles compete: reading a whole sentence at once versus being
led field by field. They differ in how much the user must trust the AI, how
much hand-holding the flow gives, and whether capture works at all without AI.

## Decision

Make voice capture the primary `/capture` flow with two in-page modes, keeping
other methods (manual form, scan, photos) as a collapsed "其他方式" area:

- **Mode A (整段口說):** the user speaks the whole entry; the AI parses it into
  prefilled field blocks that the user confirms field by field before saving.
- **Mode B (逐步口說):** fields light up one at a time in the fixed order
  `日期 → 類型 → 帳戶 → 類別 → 對象 → 品項 → 金額`; the user speaks each field
  and fills it, then confirms before saving.

Both modes keep AI output draft-only per ADR 0003; only user confirmation
writes an official record.

## Consequences

Becomes easier:

- One capture surface with a consistent field-block layout for both modes.
- Mode B works without AI (raw transcript) and can later adopt offline AI,
  so voice capture never depends on the cloud.
- The fixed field order gives the UI a stable state model.

Becomes harder:

- The AI panel must be split/extended to support per-field state and the
  step-by-step flow.
- Speech input availability depends on the browser (Web Speech API is
  provider-dependent and absent in some browsers).
- More UI surface to test on the Capture page.

## References

- [Voice capture plan](../product/voice-capture-plan.md)
- [AI ledger drafts spec](../specs/ai-ledger-drafts/requirements.md)
- [ADR 0003: Draft-first AI and import suggestions](0003-draft-first-ai-and-import-suggestions.md)
- [ADR 0006: Unified bottom navigation bar](0006-unified-bottom-navigation.md)
