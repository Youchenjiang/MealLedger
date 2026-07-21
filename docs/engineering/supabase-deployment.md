# Supabase Deployment Policy

This document is the source of truth for how MealLedger changes its Supabase
database and server-side configuration. The project uses the Supabase GitHub
integration to deploy production changes after `main` is updated.

## Source of Truth

- The Git repository is the source of truth for the production Supabase schema.
- Versioned migrations live in `supabase/migrations/`.
- Production changes must go through a reviewed pull request merged into
  `main`.
- The Supabase GitHub integration is the normal production deployment path.
- The Supabase Dashboard SQL Editor is not a normal production deployment
  path.

The repository layout is fixed for this integration: `supabase/` is directly
under the repository root, so Supabase Working directory is `.`.

## Normal Change Flow

1. Create a short-lived branch from `main`.
2. Add a new forward-only migration under `supabase/migrations/`.
3. Run schema contract tests and available local Supabase/RLS checks.
4. Review ownership, RLS, indexes, data preservation, and recovery impact in
   the pull request.
5. Merge only after required checks pass.
6. Let the Supabase GitHub integration apply new migrations to production.
7. Verify deployment and record follow-up work in the spec or pull request.

Never edit an already-applied migration. Fix a mistake with a new migration.
Never use a dashboard-only schema change that is absent from Git.

## Local and Remote CLI Rules

- `npx supabase db reset` and local RLS tests are allowed for local verification.
- `npx supabase db push` is allowed for explicitly linked development or test
  projects when that environment is not production.
- Do not run `npx supabase db push` against production as part of normal work
  after GitHub deployment is enabled. That bypasses review and can make the
  database differ from `main`.
- Read-only production inspection and migration-history verification are
  allowed after deployment.

## Emergency Exception

A direct production change is break-glass-only. It is allowed only when delay
could risk data loss, an outage, or a security incident. The operator must:

- record the reason and exact change in an issue;
- confirm a backup or recovery path;
- use the smallest safe change;
- add an equivalent forward-only migration to Git immediately afterward;
- verify that Git migration history and production schema agree; and
- document the incident before the next release.

## Automatic Deployment Scope

The integration deploys supported Supabase changes, especially new migrations.
It does not make application code, local `.env` files, or ignored credentials
part of the deployment contract. Secrets remain in Supabase project settings
or the appropriate server-side secret store and must never be committed.

Automatic preview branching is not part of the current Free-plan workflow.
The `Supabase changes only` option is therefore not required; production
deployment still follows the `main` merge rule above.

## Required Review Questions

Every PR that changes `supabase/` must answer:

- Does the migration preserve user data and remain forward-only?
- Are affected tables, RLS policies, ownership checks, and indexes covered?
- Is it safe to run after the migrations already recorded remotely?
- Does it require an environment secret or manual post-deploy step?
- What verification proves local and production migration histories agree?

