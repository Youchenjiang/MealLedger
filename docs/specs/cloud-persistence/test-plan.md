# Cloud Persistence Test Plan

## Unit

- Convert TWD/JPY and two-decimal currencies to exact minor units.
- Map every supported ledger kind without turning fund additions or paybacks
  into income.
- Map same-currency and cross-currency transfers with destination amounts.
- Map one refund to multiple original expenses.
- Preserve void state, version, tags, event, source label, and audit metadata.
- Reject unresolved reference IDs instead of silently producing a misleading
  official row.

## Repository Integration

- Creating an account without a ledger record still queues and persists the
  owned account reference.
- A successful account/record bundle calls tables in dependency order.
- Replaying the same idempotency key returns the original result and does not
  insert a second parent or fee record.
- Reusing a key with another request hash fails safely.
- A transfer child failure leaves the queue item pending/error and does not
  mark the local parent synced.
- A stale version returns a conflict result without overwriting the remote row.
- Transport failures are retryable; ownership and validation failures are not
  retried indefinitely.

## Local Fallback

- No Supabase configuration continues to save records locally.
- A missing session never displays a synced state.
- A cloud failure keeps the local record and queue item available.
- Existing clean CSV, JSON, and ZIP exports contain ledger fields only and no
  image bytes or base64 payloads.

## Browser Smoke

- Local-only mode can create and review a record without a network request.
- Configured-mode auth/loading/error states remain reachable.
- Offline/local-only status is visible when the cloud queue is pending.
- Desktop and mobile layouts do not expose raw Supabase errors or console
  errors.

## Required Commands

```text
npm run test
npm run test:coverage
npm run test:e2e
npm run build
git diff --check
git status --short
```

Real Supabase RLS integration tests are a separate environment-gated check;
they are not faked by frontend unit tests and are not a prerequisite until a
test project is configured.
