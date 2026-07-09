# ADR 0001: Ledger-First Product Model

## Status

Accepted

## Context

MealLedger supports meals, photos, receipt scans, AI/OCR, import, and future provider sync. Without a clear product priority, these features can pull the app toward a photo diary, food log, receipt vault, or automation dashboard.

The user's baseline need is a personal ledger that must not provide less accounting coverage than the existing spreadsheet.

## Decision

MealLedger is ledger-first.

Official ledger records are the source of truth for balances, exports, and reports. Meals, photos, scans, AI/OCR, imports, and external provider data are optional context or source inputs.

A transaction can exist without a photo. A meal can exist without a transaction. AI/OCR and import workflows create drafts or suggestions until user confirmation.

## Consequences

Accounting correctness has priority over capture convenience.

Clean ledger export must stay independent from image file size.

Feature specs should state whether a flow creates an official ledger record, draft, source payload, media asset, or link.

Meal and media features should remain helpful, reversible, and optional.

## References

- [Product requirements](../product/product-requirements.md)
- [Accounting rules](../v1/accounting-rules.md)
- [Capture media spec](../specs/capture-media/requirements.md)
