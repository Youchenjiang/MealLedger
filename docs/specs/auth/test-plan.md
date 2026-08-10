# Auth Test Plan

## Unit Tests

- `src/auth/authActions.test.ts` covers email/password validation, sign-in,
  sign-up, provider errors, missing sessions, and returned sessions.
- Password-reset request and recovery-session tests cover invalid email,
  provider failure, and successful password replacement.
- Google and Facebook OAuth tests cover redirect initiation, callback session
  validation, provider failure, and the unchanged local-data handoff boundary.
- `src/auth/AuthProvider.test.tsx` covers local-dev sign-in/out, password
  session adoption, sign-up session adoption, expired-session fallback to
  signed-out, and provider failure messages.
- `src/cloudPersistence/workspaceHandoff.test.ts` covers local record and audit
  ownership rebinding.

## Integration Tests

- `src/App.test.tsx` verifies the app opens directly into the local workspace,
  keeps normal local ledger flows available, and opens first-account setup only
  after the user chooses it from Ledger > Accounts.
- `src/App.auth.test.tsx` verifies the dedicated Account page, email/password
  sign-in, Google/Facebook provider actions, absence of the sign-in gate, and
  explicit local-data handoff summary before cloud ownership is claimed.
- Password visibility tests in `src/App.auth.test.tsx` verify every password
  field starts masked, each field's toggle flips only that field between
  `password` and `text`, the toggle label switches between `Show password`
  and `Hide password`, and the typed value survives the toggle for
  submission.
- Sign-up view tests verify the segmented switch to Create account, the
  confirm-password field, local rejection of mismatched passwords before any
  Supabase call, and the dedicated forgot-password view sending the reset
  link.
- Identity link/unlink tests in `src/auth/authActions.test.ts` cover the
  provider redirect initiation, unlink calls, and error paths.
- `src/App.auth.test.tsx` verifies the signed-in account lists sign-in
  methods, marks email/password as primary, and links and unlinks providers
  from the Account page.
- Cloud sync status must remain blocked as `Local data review required` until
  the user confirms handoff, then become `Cloud sync enabled` only after the
  handoff is accepted.

## Browser Smoke

- Run the review server with `npm run dev:5200`.
- Local-only user can create a ledger record and export it.
- Settings > Account exposes Email, Password, password reset, Google, and
  Facebook sign-in actions. LINE Login is absent.
- Ledger > Accounts exposes ledger-account controls. Settings also exposes an
  Import & export tab; export actions are separated from account sign-in.
- The Account page remains within the viewport on desktop and mobile.
- Mobile and desktop layouts keep local-only and verification actions distinct.
- No console or page errors occur in each state.

## Responsive And UX Review Evidence

The read-only UX, QA, and responsive reviews covered `/`, `/ledger`,
`/capture`, and `/settings` at desktop sizes `1440x900`,
`1280x800`, and `1024x768`, plus mobile sizes `320x800`, `360x800`,
`390x844`, and `414x896`.

- No blocking overlap, clipping, horizontal overflow, route-header jump, or
  console error was found.
- The narrow-screen cloud sign-in action now stays on one line; this is covered
  by the final E2E run.
- `Take photo` uses the browser camera boundary (`getUserMedia`); `Choose
  photos` remains the file-picker fallback when camera access is unavailable.
- The browser may autofill the account form with previously used credentials;
  the application initializes those fields empty and does not ship test
  credentials.

Known non-blocking follow-ups:

- A small desktop vertical overflow was observed once at `1280x800` but was not
  reproducible in the final automated run, so no speculative layout change was
  made.
- `/meals` and `/imports` remain safe non-routes; their V1 entry points are
  Capture and Settings respectively.

## Exit Gate

Auth implementation is not complete until the provider decision is recorded,
all provider-specific tests pass, local-only behavior remains available, and
the full project test/build commands pass:

- `npm run test`
- `npm run test:coverage`
- `npm run test:e2e`
- `npm run test:remote` when remote env is available
- `npm run build`
- `git diff --check`

Final verification:

- 37 test files and 264 tests passed.
- Coverage passed at 83.89% statements, 75.61% branches, 85.55% functions,
  and 86.88% lines.
- 10 Playwright desktop/mobile smoke tests passed.
- Remote Supabase persistence smoke passed for profile, accounts, references,
  ledger, transfer, idempotency, draft, source, media, and meal entities.
- Production build and `git diff --check` passed.
