# Voice Capture Tasks

Status key: `[x]` implemented on `feature/voice-capture`, `[ ]` planned.

## Mode B (逐步口說)

- [x] Add the fixed field model and prompts (`src/ai/modeB.ts`).
- [x] Add the step-by-step panel (`ModeBPanel`): field blocks, per-field Web
      Speech capture, 上一步 / 重新說一次.
- [x] Add per-field AI correction via the shared `requestAiJson` pipeline with
      a single-field prompt; raw-transcript fallback without AI.
- [x] Assemble and validate the final draft, then confirm through the existing
      write boundary with the entity policy (ADR 0012).
- [x] Add the mode switcher (整段口說 / 逐欄口說) on the Capture page and move
      shared speech utilities out of `AiLedgerPanel`.
- [x] Cover the step flow, correction, no-AI fallback, and entity policy in
      unit tests and e2e (voice-capture spec).
- [x] Run typecheck, full tests, build, and e2e gates.

## Mode A (整段口說) Field-Block Presentation

- [x] Extract shared field-block components (`src/ai/fieldBlocks.tsx`) and
      switch `ModeBPanel` to them.
- [x] Render valid Mode A drafts as field-block groups with per-field review
      and in-place editing, replacing the one-line card as the primary
      presentation.
- [x] Keep invalid-draft issues, save-draft, apply-to-form, multi-draft, and
      entity-policy dialogs unchanged.
- [x] Cover field-block rendering, per-field edits, transfer blocks,
      multi-draft, and invalid drafts in unit tests.

## Direct Audio Path (ADR 0013)

- [ ] Spike audio capture: container/codec, duration caps, downsampling
      parameters and their effect on zh-TW accuracy.
- [ ] Add MediaRecorder capture and microphone permission to the panel as an
      opt-in per-utterance path with recording-failure and
      permission-denied states.
- [ ] Extend the AI client to accept audio bytes as a third input type
      (Gemini `inline_data` single call; transcription-then-parse for other
      providers behind the same interface).
- [ ] Forward audio in the `ai-parse` edge function with size caps and
      client-side downsampling.
- [ ] Add degradation states (provider rejects audio, timeout) and the
      fallback to the transcript path for the same utterance.
- [ ] Add unit tests for capture states, provider differences, payload caps,
      and fallback; extend e2e with a stubbed provider.
- [ ] Run typecheck, full tests, build, and e2e gates.

## References

- [Voice capture requirements](requirements.md)
- [Voice capture design](design.md)
- [Voice capture test plan](test-plan.md)
