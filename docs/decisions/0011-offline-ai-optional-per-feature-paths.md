# ADR 0011: Offline AI As An Optional Capability With Independent Per-Feature Paths

## Status

Accepted

## Context

V1 AI is cloud-only: `requestAiJson` routes to the `ai-parse` Supabase Edge
Function proxy in production, with a direct-provider fallback for local
development. `v1-non-goals.md` defers local/offline AI models, and ADR 0002
commits the app to a PWA offline posture without a durable multi-day guarantee.

Every ledger feature already has its own offline path: manual entry saves
local-only records queued for sync, capture media queues local bytes, and Mode
B voice capture falls back to the raw transcript. The product direction is that
AI-assisted flows should be able to operate offline the same way — each one
independently, without depending on the others, and without blocking manual
entry.

## Decision

Offline AI is an **optional V2+ capability**, not a V1 requirement and not the
default:

- The AI client gains a local/offline provider route beside the cloud proxy and
  the direct-cloud fallback (in-browser WASM/WebGPU inference or a local
  endpoint; the exact runtime is chosen by a spike).
- Each AI feature has its own independent offline path: Mode A offline parsing,
  Mode B offline field normalization, and receipt OCR (queued locally when no
  offline vision model is available). No feature depends on another offline
  path, and none may block manual ledger entry.
- Offline AI output stays draft/suggestion data only, per ADR 0003.
- Cloud AI remains the default when both are configured; the provider is never
  switched silently.
- Model download and deletion are explicit user actions with storage size and
  progress shown; model files are app code, not user data.
- The offline AI layer does not promise durable multi-day offline guarantees
  beyond the ADR 0002 PWA posture.

## Consequences

Becomes easier:

- Capture parity in weak-network or privacy-first situations without sending
  text, transcripts, or photo bytes off the device.
- Mode B's "no AI available → raw transcript" rule slots into the offline
  fallback.

Becomes harder:

- In-browser local models are memory- and speed-constrained; the smallest
  reliable zh-TW model must be proven before committing.
- Each feature needs its own degradation state and tests (missing model, failed
  download, no network).
- Model lifecycle (download, cache, delete) is new UI and new storage surface.

## References

- [Offline AI spec](../specs/offline-ai/requirements.md)
- [Voice capture plan](../product/voice-capture-plan.md)
- [V1 non-goals](../product/v1-non-goals.md)
- [ADR 0002: PWA-first V1 delivery](0002-pwa-first-v1-delivery.md)
- [ADR 0003: Draft-first AI and import suggestions](0003-draft-first-ai-and-import-suggestions.md)
- [ADR 0010: Mode B defaults to AI field correction](0010-mode-b-defaults-to-ai-correction.md)
