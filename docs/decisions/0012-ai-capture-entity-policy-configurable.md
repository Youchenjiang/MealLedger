# ADR 0012: AI Capture Entity Policy Is Configurable Per Entity Type

## Status

Accepted

## Decision

Whether AI-assisted capture (口說記帳, Mode A today and Mode B later) may mention
entities that do not yet exist is a **user-configurable policy, chosen per
entity type** in Settings, not a fixed app rule.

Settings gains a voice/AI capture preferences section with one row per entity
type — **accounts** and **categories** first, extensible to future types. Each
row offers three options:

1. **只能歸類到現有 (existing-only)**: the AI may only pick from the user's
   existing accounts/categories. A value outside the lists is rejected with a
   clear reason (「帳戶『X』不存在。」). This is the current V1 behavior and the
   **default**, so existing users see no change until they opt in.
2. **詢問是否新增 (ask)**: the draft carries the new value, visibly marked as
   not-yet-existing. On confirm, the app asks the user whether to create it
   before writing; the record is written only if the user agrees.
3. **直接新增 (auto)**: on confirm, the app creates the entity and then writes
   the record in one flow.

Created accounts follow the default-wallet convention: the spoken name as the
account name and TWD as the currency, with no initial funding. Created
categories are appended to the user's custom categories. The user can rename,
edit, or delete either later in account/category management.

Entity creation is part of the **confirmed write**, never a side effect of the
AI call: AI output remains draft/suggestion data only until the user confirms,
per ADR 0003. The preference is stored locally
(`mealledger.ai.entity-policy`) and applies to both the existing AI panel and
the planned voice-capture modes.

## Context

The Mode A panel currently hard-rejects unknown accounts and categories. The
category whitelist also mixes hardcoded English defaults with the user's real
categories, which can surface categories the user never created (e.g. an
English "Lunch" next to a user-created 午餐). During design review it became
clear the strictness itself is the disputed point: speaking a new wallet name
mid-recording is natural, and users differ on how much they want flow speed
versus data hygiene. Rather than pin one behavior, the boundary is offered as a
setting — strict by default, with ask/auto as opt-in conveniences.

## Consequences

Becomes easier:

- Capture can create new accounts/categories in one flow when the user opts in,
  and the card visibly marks new entities (尚不存在) so they are not mistaken for
  existing ones.
- Mode B inherits the same policy and confirmation boundary, so both modes stay
  consistent.

Becomes harder:

- The system prompt varies per policy (strict whitelist vs. "use the existing
  name, or the new name the user said"), and parsing must carry new-entity
  provenance through to the card.
- The confirmation flow gains create/ask steps with their own states and tests.
- Account/category creation on write is a new side effect; it must reuse the
  existing account/category write paths so management views stay consistent.

## References

- [Settings requirements](../specs/settings/requirements.md)
- [Settings design](../specs/settings/design.md)
- [Voice capture requirements](../specs/voice-capture/requirements.md)
- [Voice capture plan](../product/voice-capture-plan.md)
- [AI ledger drafts requirements](../specs/ai-ledger-drafts/requirements.md)
- [Settings restructure plan](../product/settings-restructure-plan.md)
- [ADR 0003: Draft-first AI and import suggestions](0003-draft-first-ai-and-import-suggestions.md)
- [ADR 0009: Voice capture two modes](0009-voice-capture-two-modes.md)
- [ADR 0010: Mode B defaults to AI field correction](0010-mode-b-defaults-to-ai-correction.md)
