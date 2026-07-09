# Schema Core Tasks

## Task 1: Review Table Boundaries

Review proposed tables against product, accounting, data lifecycle, and technical operations documents.

Expected verification:

- Reviewer confirms V1 does not require production invoice or bank statement sync tables.

## Task 2: Draft Migration Plan

Create a migration sequence for profiles, accounts, categories, merchants, ledger records, drafts, media, links, audit, and idempotency.

Expected verification:

- Migration order has no circular dependency blockers.

## Task 3: Define Enums Or Check Constraints

Define stable kind/status values for ledger records, drafts, media, source payloads, and link intents.

Expected verification:

- Values match V1 accounting and lifecycle specs.

## Task 4: Define RLS Policies

Define ownership policies for direct user-owned tables and link tables.

Expected verification:

- RLS review covers every table.

## Task 5: Define Indexes

Define indexes for ledger lists, filters, search, drafts, media cleanup, and idempotency.

Expected verification:

- Query paths in technical operations have index coverage.

## Task 6: Define Seed Data Hook

Prepare for default taxonomy seed data without mixing it into schema-core.

Expected verification:

- Seed data can reference categories, tags, and aliases.

## Task 7: Write Schema Tests

Add schema tests or SQL verification for constraints, RLS, and idempotency.

Expected verification:

- RLS and uniqueness tests can run locally or in CI once Supabase tooling is active.
