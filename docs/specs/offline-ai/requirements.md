# Offline AI Requirements

Status: **planned (V2+)**. V1 ships cloud AI only (`ai-parse` proxy + local-dev
direct fallback); `docs/product/v1-non-goals.md` explicitly defers local/offline
AI models. This spec defines the target behavior so each AI feature can operate
offline independently, the same way each ledger feature (manual entry, capture,
import/export) already has its own offline path.

## Purpose

Give every AI-assisted flow an offline-capable path that works on its own and
degrades gracefully when the offline model is missing:

- **Mode A (整段口說 / whole-sentence parse):** parse a full spoken or typed
  description into prefilled ledger drafts offline.
- **Mode B (逐步口說 / per-field normalization):** normalize each field's speech
  transcript into the field's required format offline.
- **Receipt/invoice OCR:** extract line items from a photo offline.

Each path is independent: running one offline must not depend on another, and
none may block manual ledger entry (existing product rule: AI/OCR failure,
timeout, or offline status must never block manual entry).

This spec follows ADR 0003: offline AI output is draft/suggestion data only.
Official records are created only by the existing confirmed-record boundary.

## Scope

This spec covers:

- the local/offline AI provider as a routing option in the AI client
- per-feature offline paths for Mode A, Mode B, and receipt OCR
- degradation rules when the local model is missing, not downloaded, or failed
- model download and storage lifecycle
- privacy guarantees of the offline path

This spec does not change the V1 cloud path. Cloud AI remains the default when
configured; offline AI is an explicit, optional capability.

## Requirements

WHEN the app is offline and an offline AI provider is configured
THE SYSTEM SHALL route AI requests to the local/offline provider instead of the
cloud.

WHEN the app is offline and no offline AI provider is configured
THE SYSTEM SHALL degrade per feature instead of blocking capture:
Mode B keeps working with the raw speech transcript; Mode A shows a clear
message and leaves manual ledger entry available; receipt photos are queued
locally for later AI processing or reviewed manually.

WHEN Mode B (逐步口說) runs offline with a local model available
THE SYSTEM SHALL normalize the current field's transcript into the field's
required format (amount, date, account/category match) and show the result for
confirmation before it is written.

WHEN Mode B runs offline without a local model
THE SYSTEM SHALL write the raw transcript into the current field, unchanged.

WHEN Mode A (整段口說) runs offline with a local model available
THE SYSTEM SHALL parse the description into validated prefilled ledger drafts
using the same JSON contract and validation as the cloud path.

WHEN any offline AI output is produced
THE SYSTEM SHALL keep it draft/suggestion data only; no official ledger record
is created until the user confirms through the existing boundaries (ADR 0003).

WHEN each offline AI feature is used
THE SYSTEM SHALL not depend on any other offline AI feature; Mode A, Mode B,
and offline OCR each run independently.

WHEN the local model is not downloaded or has failed to load
THE SYSTEM SHALL report the state clearly and follow the per-feature
degradation rules above; a failed model must not hang the UI.

WHEN the user downloads a local model
THE SYSTEM SHALL show progress and expected storage size before download, and
let the user delete the model later.

WHEN the offline AI provider is used
THE SYSTEM SHALL not send the user's text, transcript, or photo bytes off the
device; the offline path is a privacy option.

WHEN the app is online and both cloud and offline providers are configured
THE SYSTEM SHALL use an explicit, user-visible preference (default cloud) and
never silently switch providers.

## Non-Functional Requirements

The offline AI layer must not block manual ledger entry under any condition.

The offline AI layer must not change stored ledger data formats.

The offline AI layer must respect a bounded storage budget for model files and
must not claim durable multi-day offline guarantees beyond the existing PWA
offline posture (`docs/decisions/0002-pwa-first-v1-delivery.md`).

## Related

- [Design](design.md)
- [Tasks](tasks.md)
- [Test plan](test-plan.md)
- [Voice capture plan](../../product/voice-capture-plan.md)
- [ADR 0003: Draft-first AI and import suggestions](../../decisions/0003-draft-first-ai-and-import-suggestions.md)
