# App Shell Design

## Product Shape

The app opens directly into the working application, not a marketing landing page. The first viewport should make the product feel like a personal finance tool: calm, scannable, and built for repeated use.

The shell reserves product space for future ledger features while avoiding fake data that could be mistaken for real balances.

## Navigation

Primary navigation:

- Overview
- Ledger
- Capture
- Settings

Mobile should use a bottom navigation or compact app rail. Desktop can use a sidebar. The same route names should work in both layouts.

Suggested route paths:

- `/` or `/overview`
- `/ledger`
- `/capture`
- `/settings`

Meals and Imports are later product areas. They remain covered by their own specs and should not appear as primary app-shell navigation until their first usable workflow exists.

## Page Responsibilities

Overview shows:

- account summary placeholder
- confirmed ledger records placeholder
- draft review count
- sync/local-only status

Ledger shows:

- confirmed ledger list empty state
- local drafts waiting for review
- quick entry path back to Capture

Capture shows:

- manual transaction draft form
- scan receipt or invoice action
- meal photo action
- attachment action

Settings shows:

- auth/account placeholder
- sync status placeholder
- import/export safeguard copy

## Minimal Manual Draft Flow

The app-shell spec includes one real, local-only path so the shell is not a dead end:

1. The user opens Overview.
2. The user selects Start a record.
3. Capture shows a minimal manual transaction draft form.
4. Capture hands the user into a local draft preview.
5. The submitted record appears as a local draft in the Ledger review queue.
6. The user can discard a local draft from the Ledger review queue.
7. The confirmed ledger table stays empty because confirmation and official ledger writes belong to later specs.

The preview is intentionally not final accounting CRUD. It does not create official records, calculate balances, persist to Supabase, or export data. Its detailed fields, account/category setup affordances, record-kind validation, and local draft shape are defined and accepted by the Manual Ledger spec. App Shell only verifies that Capture, the review queue, and the empty confirmed-ledger state remain connected.

## State Model

The shell should work with a small local UI state model before real backend wiring:

- `authState`: signed out, signed in, loading
- `networkState`: online, offline
- `drafts`: local transaction drafts waiting for review

Initial implementation can use local component state as long as the component boundaries make future Supabase wiring straightforward. Local drafts must be visibly separate from confirmed ledger records.

## Accessibility And Responsiveness

Navigation controls should be keyboard reachable.

Current route should be visually indicated.

Icon buttons need accessible labels or tooltips.

Text must fit on mobile and desktop without overlap.

The shell may keep inline English copy until the localization spec is implemented. Layout and component sizing should still tolerate longer Traditional Chinese labels.

## Boundaries

This spec should not define database schema.

This spec should not claim acceptance of record-kind validation beyond the local-draft handoff. Domain validation belongs to the manual-ledger and schema-core specs.

This spec should not decide AI/OCR provider behavior.

This spec should link to later feature specs instead of embedding them.

## References

- [Development workflow](../../engineering/development-workflow.md)
- [Spec-driven workflow](../../engineering/spec-driven-workflow.md)
- [Product flows](../../product/flows.md)
- [Technical operations](../../v1/technical-ops.md)
