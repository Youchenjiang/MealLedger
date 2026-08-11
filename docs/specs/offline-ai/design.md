# Offline AI Design

Status: **planned (V2+)**. V1 AI is cloud-only: `requestAiJson` routes to the
`ai-parse` Supabase Edge Function proxy in production, with a direct-provider
fallback for local development. The V1 product boundary (ADR 0003) is unchanged:
AI output is draft/suggestion data only.

## Positioning

Today each ledger feature already degrades to a usable offline path:

- manual entry saves local-only records queued for sync
- capture media queues local bytes
- Mode B voice capture falls back to the raw transcript when AI is unavailable

Offline AI extends the same posture to the AI layer: the cloud stays the
default, and a local/offline provider becomes an optional capability with the
same draft-only boundary.

## Provider Routing

The AI client gains a third route beside the edge-function proxy and the direct
cloud call:

1. cloud proxy (`AI_EDGE_FUNCTION_URL`) — production default
2. direct cloud provider — local-development fallback
3. local/offline provider — optional, selected explicitly

The local provider is a candidate implementation, not a committed dependency.
Options to spike (choose one that stays small):

- **WebLLM / Transformers.js in-browser:** WASM/WebGPU inference, no install,
  download-on-demand; constrained by device memory and the PWA storage budget.
- **Local server endpoint (Ollama / llama.cpp):** no browser runtime cost, but
  requires the user to run a separate process; only viable for self-hosters.

Routing decision follows the requirements: offline + configured → local;
offline + not configured → per-feature degradation; online → preference
(default cloud), never a silent switch.

## Per-Feature Offline Paths

Each feature has an independent offline path and its own degradation rule.
There is no cross-feature dependency.

### Mode B (逐步口說) — default AI correction, offline fallback

- With AI available (cloud or local), the current field's transcript is
  normalized **by default** through a per-field prompt (amount, date,
  account/category match) reusing the existing `requestAiJson`-style contract;
  the normalized value is shown for confirmation before it is written.
- Offline, the user chooses: enable offline AI (local model) to keep
  normalizing, or write the raw transcript unchanged — no network, no AI.
- The raw-transcript path is the fallback only, never the default when AI is
  available.

### Mode A (整段口說) — offline parse

- When a local model is available, the description is parsed with the same
  system/user prompt shape and the same `parseDraftSuggestions` validation as
  the cloud path, producing prefilled drafts for confirmation.
- When no local model is available, show a clear message; manual ledger entry
  remains available. No silent partial parse.

### Receipt OCR — deferral

- When a local vision model is available, photos are processed offline with the
  same line-item prompt and draft-only boundary.
- When not available offline, photos are queued locally (existing capture-media
  byte queue) for later AI processing or manual review; capture is never
  blocked.

## Model Lifecycle

- Model selection and download are explicit user actions: show model name,
  size, and storage cost before downloading, with progress.
- Downloaded models are cached in browser storage with a version pin; the user
  can delete a model to free space.
- Failed downloads and failed inference surface as state, not hangs; the
  feature degrades per the rules above.
- Storage stays within the PWA offline posture (ADR 0002): no durable multi-day
  offline guarantee is promised by the offline AI layer.

## Privacy And Data

- The offline path never transmits text, transcripts, or photo bytes off the
  device; this is its product value over cloud AI.
- Offline AI outputs follow the same draft-only rule and the same
  tags/source labeling as cloud AI so records are auditable.
- Model files are app code, not user data; deletion of a model never touches
  ledger records or drafts.

## Known Constraints

- In-browser local models are memory- and speed-constrained; the smallest
  reliable zh-TW model must be proven before committing (follow the pattern of
  the verified-model notes in the AI ledger drafts spec).
- Browser storage can be evicted (ADR 0002); model cache is best-effort.
- Web Speech API transcription itself may need connectivity (Chrome/Edge);
  offline AI corrects/normalizes text but does not fix STT unavailability —
  per-feature degradation already covers that.

## Rejected Alternatives

- **Bundle a model into the app**: bloats the install and fights the PWA
  storage budget; download-on-demand wins.
- **Make offline AI the default**: cloud accuracy beats local for V1 and the
  cloud path already exists; offline stays opt-in.
- **One shared offline runtime for all features**: rejected because the
  requirement is independent per-feature operation; a shared runtime would
  couple Mode A, Mode B, and OCR availability.

## References

- [Requirements](requirements.md)
- [Tasks](tasks.md)
- [Test plan](test-plan.md)
- [Voice capture plan](../../product/voice-capture-plan.md)
- [AI ledger drafts design](../ai-ledger-drafts/design.md)
- [ADR 0002: PWA-first V1 delivery](../../decisions/0002-pwa-first-v1-delivery.md)
- [ADR 0003: Draft-first AI and import suggestions](../../decisions/0003-draft-first-ai-and-import-suggestions.md)
