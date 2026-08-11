# Offline AI Tasks

Status: **planned (V2+)**. Ordered so the project can stop safely between PRs;
each task lists its expected verification.

## Task 1: Provider Routing Abstraction

Extend the AI client so requests route to cloud proxy, direct cloud, or a
local/offline provider, with an explicit preference (default cloud) and never a
silent switch.

Expected verification:

- `npm run typecheck`, `npm test`
- Routing unit tests cover online→cloud and offline→local/fallback.

## Task 2: Local Model Spike

Prove the smallest reliable zh-TW-capable local model (in-browser WASM/WebGPU
or local endpoint) that can parse a ledger description and normalize a field.

Expected verification:

- Spike notes recorded in the design spec with model name, size, speed, and
  accuracy on the existing AI ledger fixtures.

## Task 3: Mode B Offline Normalization

When a local model is available, normalize the current field's transcript
(amount, date, account/category match) with a per-field prompt and show the
result for confirmation; without a model, write the raw transcript unchanged.

Expected verification:

- `npm run typecheck`, `npm test`
- Unit tests cover normalized and raw-transcript paths and the confirmation
  step.

## Task 4: Mode A Offline Parse

When a local model is available, parse a full description offline through the
existing `parseDraftSuggestions` validation into prefilled drafts; without a
model, show a clear message and keep manual entry available.

Expected verification:

- `npm run typecheck`, `npm test`
- Unit tests cover offline parse and no-model degradation.

## Task 5: Offline Receipt OCR Deferral

Offline photos with no local vision model queue locally (existing byte queue)
for later AI processing or manual review; capture is never blocked.

Expected verification:

- `npm run typecheck`, `npm test`
- Capture-media tests cover the offline queued state.

## Task 6: Model Lifecycle UI

Explicit model download with size/progress, version pin, cache, and delete.

Expected verification:

- `npm run typecheck`, `npm test`
- Tests cover download progress, delete, and storage-failure messaging.

## Task 7: Full Gates

Run the complete verification set for the feature.

Expected verification:

- `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`
- Playwright offline-context smoke test: Mode B works with no network and no
  model; Mode A shows the degradation message; manual entry unaffected.
