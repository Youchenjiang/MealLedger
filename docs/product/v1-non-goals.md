# V1 Non-Goals And Known Limitations

This document lists what V1 intentionally does not promise. It protects the project from scope creep and sets honest user expectations.

## Non-Goals

### Provider Sync

V1 does not include production Ministry of Finance cloud invoice sync.

V1 does not include production bank, credit-card, or account statement API sync.

V1 may keep schema names and source payloads compatible with future provider sync, but provider credentials, scheduled jobs, and reconciliation dashboards are V2 or spike work.

### Strong Native Offline Guarantee

V1 is PWA-first and does not promise durable multi-day offline capture.

V1 can queue local work and request persistent browser storage, but browser storage may still be evicted by the browser or operating system.

If strong offline capture becomes a launch requirement, Capacitor/native persistence must be promoted before launch.

### Full Debt Tracking

V1 does not implement a full receivable/payable system.

Shared payments are represented through accurate cash flow, refund/payback records, tags, links, and optional event context.

### Budgeting

V1 does not implement envelope budgeting, monthly category limits, remaining-budget warnings, or budget planning.

`初始資金` and fund additions are balance/funding records, not spending-budget features.

### Tax Or Legal Compliance

V1 is a personal ledger and does not claim tax, legal, or business-accounting compliance.

Future reimbursement or tax-oriented exports should be built as report/export views over confirmed ledger data.

### Full Media Backup Export

V1 clean ledger export does not include image bytes.

Full media backup export is post-V1 unless it becomes a launch requirement before implementation.

### Local AI Model

V1 does not include a local/offline AI or OCR model.

Cloud AI/OCR can assist drafts when available, and manual entry must remain usable when AI/OCR fails.

### Complex Category Management

V1 does not require category merge UI.

V1 should support disabling, aliases, and manual recategorization first.

### Full Relationship Graph Editing

V1 does not need a full graph editor for meals, media, receipts, transactions, source payloads, and drafts.

Detail pages should show relationships in simple sections. Advanced graph editing is post-V1.

## Known Limitations

- PWA local-only data can be lost before cloud sync if browser storage is cleared.
- Signed URLs have eventual invalidation during their short TTL.
- AI/OCR results can be wrong and remain suggestions.
- Import mapping may require user review for ambiguous legacy labels.
- Multi-currency V1 reports group by currency and do not provide a single live-exchange-rate net worth number.
- Credit-card statement cycles, interest, and minimum payments are not modeled in V1.
- Provider invoice and bank records are represented only as source payloads or drafts in V1.

## Review Guidance

Do not block V1 PRs because they do not implement these non-goals.

Do block PRs that accidentally promise these behaviors, make future support harder, or weaken current accounting, privacy, sync, or export guarantees.

## References

- [Product requirements](product-requirements.md)
- [Implementation sequence](../engineering/implementation-sequence.md)
- [ADR 0002: PWA-first V1 delivery](../decisions/0002-pwa-first-v1-delivery.md)
