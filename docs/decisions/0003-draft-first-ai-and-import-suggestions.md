# ADR 0003: Draft-First AI And Import Suggestions

## Status

Accepted

## Context

AI/OCR, receipt scans, spreadsheet imports, and future provider sync can infer ledger fields. These automations are useful, but incorrect official records can corrupt balances, reports, and user trust.

The project needs automation without giving it unchecked authority over official accounting records.

## Decision

AI/OCR, imports, receipt/invoice scans, and future provider sync create drafts, source payloads, candidates, or suggestions before they create official ledger records.

Official ledger records require user confirmation unless a future approved rule explicitly permits auto-recording.

Auto-recording is limited to safe, fully known recurrence cases in V1.

## Consequences

The app should invest in good review queues, draft grouping, and bulk actions.

Background AI/OCR results must not overwrite user-edited fields.

Testing should validate schemas, draft flows, confirmation flows, idempotency, and duplicate handling instead of fixed natural-language answers.

This decision reduces automation risk but may add review work for the user.

## References

- [Import export spec](../specs/import-export/requirements.md)
- [Capture media spec](../specs/capture-media/requirements.md)
- [Manual ledger spec](../specs/manual-ledger/requirements.md)
- [Technical operations](../v1/technical-ops.md)
