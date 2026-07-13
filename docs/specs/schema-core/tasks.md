# Schema Core Tasks

## Task 1: Review Table Boundaries — Complete

Review proposed tables against product, accounting, data lifecycle, and technical operations documents.

Expected verification:

- Reviewer confirms V1 does not require production invoice or bank statement sync tables.

## Task 2: Draft Migration Plan — Complete

Create a migration sequence for profiles, accounts, categories, merchants, ledger records, drafts, media, links, audit, and idempotency.

Expected verification:

- Migration order has no circular dependency blockers.

## Task 3: Define Enums Or Check Constraints — Complete

Define stable kind/status values for ledger records, drafts, media, source payloads, and link intents.

Expected verification:

- Values match V1 accounting and lifecycle specs.

## Task 4: Define RLS Policies — Complete

Define ownership policies for direct user-owned tables and link tables.

Expected verification:

- RLS review covers every table.

## Task 5: Define Indexes — Complete

Define indexes for ledger lists, filters, search, drafts, media cleanup, and idempotency.

Expected verification:

- Query paths in technical operations have index coverage.

## Task 6: Define Seed Data Hook — Complete

Prepare for default taxonomy seed data without mixing it into schema-core.

Expected verification:

- Seed data can reference categories, tags, and aliases.

## Task 7: Write Schema Tests — Complete

Add schema tests or SQL verification for constraints, RLS, and idempotency.

Expected verification:

- RLS and uniqueness tests can run locally or in CI once Supabase tooling is active.

## V1 Closeout Evidence

- Canonical SQL: `supabase/schema.sql` and `supabase/migrations/0001_schema_core.sql`.
- Contract checks: `src/schemaCore/schemaContract.test.ts`.
- TypeScript domain contracts: `src/schemaCore/contracts.ts`.
- Root and nested category names use a generated parent key so NULL roots are
  also protected by the canonical uniqueness constraint.
- Account currency immutability covers both source ledger records and transfer
  destination history.
- `npm run test` — 209 tests passed after the completed feature set.
- `npm run build` and `git diff --check` passed.

## Environment Boundary

Supabase CLI and a live RLS integration database are not installed in this workspace. Static SQL contract checks and migration review are the V1 verification boundary; live RLS execution is deferred until local Supabase is enabled.
