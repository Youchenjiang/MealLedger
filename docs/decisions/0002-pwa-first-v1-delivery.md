# ADR 0002: PWA-First V1 Delivery

## Status

Accepted

## Context

MealLedger needs quick iteration on ledger forms, schema, reports, import/export, and sync behavior. Native mobile persistence would improve long offline reliability, but introducing Capacitor or Flutter in V1 would increase delivery complexity before the ledger model is proven.

The project accepts that browser storage can be evicted and that PWA offline support is not a strong multi-day offline guarantee.

## Decision

V1 uses Vite, React, and TypeScript as a PWA.

Local state uses browser storage behind replaceable adapters. The app requests persistent storage when available and clearly marks local-only data.

Capacitor/native persistence remains a future option if strong multi-day offline capture becomes a launch requirement.

## Consequences

V1 can ship faster and share one web codebase.

The UI must clearly warn about unsynced local-only data.

Storage, upload, sync, and ledger repositories should be adapter-based so a later Capacitor migration does not require rewriting core UI or domain logic.

Marketing or product copy must not promise durable multi-day offline capture in V1.

## References

- [Technical operations](../v1/technical-ops.md)
- [Development workflow](../engineering/development-workflow.md)
- [Implementation sequence](../engineering/implementation-sequence.md)
