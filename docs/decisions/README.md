# Architecture Decision Records

This folder stores decisions that should not be rediscovered in every PR review.

Use ADRs for decisions that are:

- hard to reverse
- likely to be questioned again
- cross-cutting across specs
- important for accounting, privacy, sync, storage, or delivery strategy

Use specs for feature behavior. Use ADRs for why the project chose one direction over another.

## Status Values

- `Proposed`
- `Accepted`
- `Superseded`

## Index

- [0001: Ledger-first product model](0001-ledger-first-product-model.md)
- [0002: PWA-first V1 delivery](0002-pwa-first-v1-delivery.md)
- [0003: Draft-first AI and import suggestions](0003-draft-first-ai-and-import-suggestions.md)
- [0004: Auth provider strategy](0004-auth-provider-strategy.md)
- [0005: All ledger record writes go through one atomic RPC boundary](0005-ledger-writes-atomic-rpc-boundary.md)
- [0006: Unified bottom navigation bar](0006-unified-bottom-navigation.md)
- [0007: Ledger record delete defaults to void, with optional hard delete](0007-ledger-record-delete-void-or-hard-delete.md)
- [0008: Negative balance policy is configurable and off by default](0008-configurable-negative-balance-policy.md)
- [0009: Voice capture as the primary capture flow with two modes](0009-voice-capture-two-modes.md)
- [0010: Mode B defaults to AI field correction with an offline fallback](0010-mode-b-defaults-to-ai-correction.md)
- [0011: Offline AI as an optional capability with independent per-feature paths](0011-offline-ai-optional-per-feature-paths.md)
- [Template](template.md)
