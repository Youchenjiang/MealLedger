# App Shell Design

## Product Shape

The app opens directly into the working application, not a marketing landing page. The first viewport should make the product feel like a personal finance tool: calm, scannable, and built for repeated use.

The shell reserves product space for future ledger features while avoiding fake data that could be mistaken for real balances.

## Navigation

Primary navigation:

- Overview
- Ledger
- Capture
- Meals
- Imports
- Settings

Mobile should use a bottom navigation or compact app rail. Desktop can use a sidebar. The same route names should work in both layouts.

Suggested route paths:

- `/` or `/overview`
- `/ledger`
- `/capture`
- `/meals`
- `/imports`
- `/settings`

## Page Responsibilities

Overview shows:

- account summary placeholder
- recent activity placeholder
- review queue entry
- sync/local-only status

Ledger shows:

- ledger list empty state
- quick entry placeholders
- filters placeholder

Capture shows:

- manual ledger entry action
- scan receipt or invoice action
- meal photo action
- attachment action

Meals shows:

- meal timeline empty state
- add meal placeholder

Imports shows:

- import history placeholder
- draft review placeholder
- CSV import placeholder

Settings shows:

- auth/account placeholder
- sync status placeholder
- export placeholder
- docs link placeholder

## State Model

The shell should work with a small local UI state model before real backend wiring:

- `authState`: signed out, signed in, loading
- `networkState`: online, offline
- `syncState`: synced, local-only, syncing, failed
- `reviewCount`

Initial implementation can use mock or static state as long as the component boundaries make future Supabase wiring straightforward.

## Accessibility And Responsiveness

Navigation controls should be keyboard reachable.

Current route should be visually indicated.

Icon buttons need accessible labels or tooltips.

Text must fit on mobile and desktop without overlap.

## Boundaries

This spec should not define database schema.

This spec should not implement ledger form validation.

This spec should not decide AI/OCR provider behavior.

This spec should link to later feature specs instead of embedding them.

## References

- [Development workflow](../../engineering/development-workflow.md)
- [Spec-driven workflow](../../engineering/spec-driven-workflow.md)
- [Product flows](../../product/flows.md)
- [Technical operations](../../v1/technical-ops.md)
