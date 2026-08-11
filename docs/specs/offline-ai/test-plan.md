# Offline AI Test Plan

Status: **planned (V2+)**. Verification is defined before implementation.

## Provider Routing

Test online with both providers configured uses the cloud provider by default.

Test explicit offline preference routes to the local provider.

Test provider never switches silently.

Test offline with no local provider configured degrades per feature instead of
blocking capture.

## Mode B Offline Normalization

Test Mode B with a local model normalizes an amount transcript (e.g.
「兩百五十」→ `250`) and shows the result for confirmation.

Test Mode B with a local model normalizes a date transcript (e.g.
「七月二十五」→ `YYYY-MM-DD`) and shows the result for confirmation.

Test Mode B with a local model matches account/category names case-insensitively.

Test Mode B without a local model writes the raw transcript unchanged.

Test Mode B normalized values are written only after confirmation (ADR 0003).

## Mode A Offline Parse

Test Mode A with a local model parses a full description into prefilled drafts
using the same validation as cloud AI.

Test Mode A offline without a local model shows a clear message and leaves
manual ledger entry available.

Test Mode A offline never creates an official record without confirmation.

## Offline OCR

Test offline photo capture with a local vision model produces draft suggestions.

Test offline photo capture without a local vision model queues bytes locally
and does not block capture.

## Model Lifecycle

Test model download shows name, size, and progress.

Test a failed download surfaces state and keeps the feature usable in degraded
mode.

Test model delete frees storage and never touches ledger records or drafts.

## Offline Integration

Test offline AI failure, missing model, or timeout never blocks manual ledger
entry.

Test Mode A, Mode B, and offline OCR each work independently offline.

Test local model output is tagged/labeled so its source is auditable.

Test with Playwright in an offline context: Mode B works with no network and no
model; Mode A shows the degradation message; manual entry is unaffected.

## Gates

`npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`.
