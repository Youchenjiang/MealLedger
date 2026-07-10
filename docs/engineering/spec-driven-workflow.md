# Spec-Driven Workflow

MealLedger uses a lightweight spec-driven workflow for risky or ambiguous work. The goal is to make AI-assisted implementation safer without turning every small change into process ceremony.

## Positioning

The project uses:

- Lightweight agile delivery for iteration.
- Spec-driven planning for medium or high-risk features.
- Risk-driven TDD for money, imports, exports, privacy, and sync.
- BMAD-style review roles as a checklist, not as a full required process.

Spec-driven work is required when a change can affect ledger correctness, data migration, privacy, sync, import/export behavior, or cross-module data contracts.

Spec-driven work is optional for small copy edits, visual polish, docs-only cleanup, narrow bug fixes with obvious behavior, and non-user-facing maintenance.

## Spec Folder Layout

Feature specs live under:

```text
docs/specs/<feature-name>/
  requirements.md
  design.md
  tasks.md
  test-plan.md
```

Use lowercase kebab-case for `<feature-name>`, such as:

```text
docs/specs/app-shell/
docs/specs/manual-ledger/
docs/specs/import-export/
docs/specs/media-capture/
```

## Requirements

`requirements.md` defines user-visible behavior and acceptance criteria.

Use concrete language. Prefer requirement lines shaped like:

```text
WHEN <trigger or context>
THE SYSTEM SHALL <observable behavior>
```

Each requirement should be testable or reviewable. Avoid implementation details unless they are product constraints.

For MealLedger, requirements must explicitly call out whether a flow creates:

- an official ledger record
- a draft
- a source payload
- a media asset
- a link between existing records

AI/OCR requirements must state that AI output stays draft-only unless the user confirms the result or a future approved rule explicitly permits auto-recording.

## Design

`design.md` records the implementation shape before code starts.

It should cover:

- data model changes
- API or edge function boundaries
- frontend state and navigation
- offline and sync behavior
- import/export shape when relevant
- privacy and deletion behavior when relevant
- rejected alternatives when they would be tempting later

Design should reference existing V1 specs instead of copying them.

## Tasks

`tasks.md` breaks the work into small PR-sized units.

Tasks should be ordered so the project can stop safely between PRs. Prefer vertical slices when possible, but split schema, domain logic, UI, and tests when the blast radius is high.

Each task should mention its expected verification command or review evidence.

Implementation tasks should add or update automated tests before commit when the spec has executable behavior. If the first slice is only scaffolding, the PR must still state why automated coverage is not yet meaningful.

## Test Plan

`test-plan.md` defines verification before implementation.

High-risk areas should list acceptance cases before code:

- ledger amounts
- transfers
- refunds
- fund additions
- unresolved expenses
- import/export
- RLS and auth
- media retention
- sync conflicts
- privacy deletion

UI shell work can use build checks and browser smoke tests only before executable behavior exists. Once a shell flow captures, validates, stores, or reviews user input, the spec must include automated tests and a coverage command.

## Review Roles

Use BMAD-style roles as a review checklist:

- Business analyst: are user requirements clear and non-contradictory?
- Product manager: is V1 scope controlled?
- Architect: are boundaries and data contracts stable?
- Developer: can tasks be implemented in small PRs?
- QA: are acceptance cases and regressions covered?

Not every PR needs all roles. Use the roles that match the risk.

## PR Rules

If a PR implements a spec, the PR description should link to the spec folder and state which tasks it completes.

If implementation discovers a spec error, update the spec in the same PR or in a preceding docs PR before changing behavior.

Do not let implementation silently override accounting, privacy, or import/export rules from the V1 specs.

## V1 Starting Specs

The first recommended feature specs are:

1. `docs/specs/app-shell/`
2. `docs/specs/manual-ledger/`
3. `docs/specs/import-export/`
4. `docs/specs/media-capture/`

Start with app shell only if the workflow and documentation index are already settled.
